"""
Attendance API router.

Endpoints:
- POST /api/attendance/session/start           — Start attendance session
- GET  /api/attendance/session/{id}/status      — Get session status
- POST /api/attendance/session/{id}/stop        — Stop session early
- GET  /api/attendance/session/{id}/results     — Get session results
- GET  /api/attendance/today                    — Today's attendance
- GET  /api/attendance/student/{id}             — Student attendance history
- PUT  /api/attendance/{id}                     — Manual correction
- WS   /api/attendance/session/{id}/live        — Live WebSocket stream
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_staff
from app.models.faculty import Faculty
from app.models.student import Student
from app.models.attendance import Attendance
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.schemas.attendance import (
    SessionStartRequest,
    SessionResponse,
    SessionStatusResponse,
    AttendanceRecord,
    AttendanceUpdateRequest,
    AttendanceHistoryResponse,
    HistoryRecord,
    HistoryListResponse,
)
from app.services.attendance_service import (
    start_attendance_session,
    active_sessions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


def _session_response(s: AttendanceSession) -> SessionResponse:
    return SessionResponse(
        id=s.id,
        faculty_id=s.faculty_id,
        subject=s.subject,
        classroom=s.classroom,
        section=s.section,
        year=s.year,
        branch=s.branch,
        duration=s.duration,
        start_time=s.start_time,
        end_time=s.end_time,
        status=s.status,
        total_recognized=s.total_recognized,
        total_unknown=s.total_unknown,
        total_students=s.total_students or 0,
    )


@router.post("/session/start", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def start_session(
    data: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Start a new attendance recognition session."""
    # Count expected students for the selected class (Year → Branch → Section)
    class_query = select(func.count(Student.id))
    if data.year:
        class_query = class_query.where(Student.year == data.year)
    if data.branch:
        class_query = class_query.where(Student.branch == data.branch)
    if data.section:
        class_query = class_query.where(Student.section == data.section)
    total_students = (await db.execute(class_query)).scalar() or 0

    session = AttendanceSession(
        faculty_id=current_user.id,
        subject=data.subject,
        classroom=data.classroom,
        section=data.section,
        year=data.year,
        branch=data.branch,
        duration=data.duration,
        total_students=total_students,
        status=SessionStatus.PENDING.value,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    # Initialize active session tracking
    active_sessions[session.id] = {"stop": False, "clients": []}

    # Launch the background recognition task
    asyncio.create_task(start_attendance_session(session.id))

    return _session_response(session)


@router.get("/session/{session_id}/status", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Get the current status of an attendance session."""
    result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    elapsed = 0.0
    remaining = float(session.duration)
    if session.start_time:
        elapsed = (datetime.now(timezone.utc) - session.start_time).total_seconds()
        remaining = max(0, session.duration - elapsed)

    return SessionStatusResponse(
        id=session.id,
        status=session.status,
        total_recognized=session.total_recognized,
        total_unknown=session.total_unknown,
        total_students=session.total_students or 0,
        elapsed_seconds=round(elapsed, 1),
        remaining_seconds=round(remaining, 1),
    )


@router.post("/session/{session_id}/stop")
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Stop an attendance session early."""
    if session_id in active_sessions:
        active_sessions[session_id]["stop"] = True

    result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.COMPLETED.value
    session.end_time = datetime.now(timezone.utc)
    await db.flush()

    return {"message": "Session stopped", "session_id": session_id}


@router.get("/session/{session_id}/results")
async def get_session_results(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Get final results of an attendance session."""
    result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all attendance records for this session
    att_result = await db.execute(
        select(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .where(Attendance.session_id == session_id)
        .order_by(Attendance.recognized_at)
    )
    records = att_result.all()

    return {
        "session": _session_response(session),
        "records": [
            AttendanceRecord(
                id=att.id,
                session_id=att.session_id,
                student_id=att.student_id,
                student_name=student.name,
                student_roll=student.roll_number,
                status=att.status,
                confidence=att.confidence,
                recognized_at=att.recognized_at,
            )
            for att, student in records
        ],
    }


@router.get("/today", response_model=AttendanceHistoryResponse)
async def get_today_attendance(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Get today's attendance records."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Get today's session IDs
    session_ids_query = select(AttendanceSession.id).where(
        and_(
            AttendanceSession.start_time >= today_start,
            AttendanceSession.start_time < today_end,
        )
    )

    # Count
    count_result = await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.session_id.in_(session_ids_query)
        )
    )
    total = count_result.scalar() or 0

    # Fetch records
    offset = (page - 1) * page_size
    att_result = await db.execute(
        select(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .where(Attendance.session_id.in_(session_ids_query))
        .order_by(Attendance.recognized_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    records = att_result.all()

    return AttendanceHistoryResponse(
        records=[
            AttendanceRecord(
                id=att.id,
                session_id=att.session_id,
                student_id=att.student_id,
                student_name=student.name,
                student_roll=student.roll_number,
                status=att.status,
                confidence=att.confidence,
                recognized_at=att.recognized_at,
            )
            for att, student in records
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/me", response_model=AttendanceHistoryResponse)
async def get_my_attendance(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Student role: get own attendance history."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student access only")
    return await get_student_attendance(student_id=current_user.id, page=page, page_size=page_size, db=db, current_user=current_user)


@router.get("/student/{student_id}", response_model=AttendanceHistoryResponse)
async def get_student_attendance(
    student_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get attendance history for a specific student. Students can only view their own."""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    # Verify student exists
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Count
    count_result = await db.execute(
        select(func.count(Attendance.id)).where(Attendance.student_id == student_id)
    )
    total = count_result.scalar() or 0

    # Fetch
    offset = (page - 1) * page_size
    att_result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.recognized_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    records = att_result.scalars().all()

    return AttendanceHistoryResponse(
        records=[
            AttendanceRecord(
                id=att.id,
                session_id=att.session_id,
                student_id=att.student_id,
                student_name=student.name,
                student_roll=student.roll_number,
                status=att.status,
                confidence=att.confidence,
                recognized_at=att.recognized_at,
            )
            for att in records
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.put("/{attendance_id}", response_model=AttendanceRecord)
async def update_attendance(
    attendance_id: int,
    data: AttendanceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Manually correct an attendance record (e.g., mark absent → present)."""
    result = await db.execute(select(Attendance).where(Attendance.id == attendance_id))
    attendance = result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    attendance.status = data.status
    await db.flush()
    await db.refresh(attendance)

    # Get student info
    student_result = await db.execute(
        select(Student).where(Student.id == attendance.student_id)
    )
    student = student_result.scalar_one_or_none()

    return AttendanceRecord(
        id=attendance.id,
        session_id=attendance.session_id,
        student_id=attendance.student_id,
        student_name=student.name if student else None,
        student_roll=student.roll_number if student else None,
        status=attendance.status,
        confidence=attendance.confidence,
        recognized_at=attendance.recognized_at,
    )


@router.get("/sessions")
async def list_sessions(
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """List all attendance sessions for the current faculty."""
    base = select(AttendanceSession).where(
        AttendanceSession.faculty_id == current_user.id
    )
    count_q = select(func.count(AttendanceSession.id)).where(
        AttendanceSession.faculty_id == current_user.id
    )

    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            day_filter = and_(
                AttendanceSession.start_time >= day,
                AttendanceSession.start_time < day + timedelta(days=1),
            )
            base = base.where(day_filter)
            count_q = count_q.where(day_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        base.order_by(AttendanceSession.start_time.desc())
        .offset(offset)
        .limit(page_size)
    )
    sessions = result.scalars().all()

    return {
        "sessions": [_session_response(s) for s in sessions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/history", response_model=HistoryListResponse)
async def get_attendance_history(
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    subject: str = Query(None),
    year: int = Query(None),
    branch: str = Query(None),
    section: str = Query(None),
    search: str = Query(None, description="Search student name or roll number"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Attendance history with date/subject/year/branch/section filters."""
    base = (
        select(Attendance, Student, AttendanceSession)
        .join(Student, Attendance.student_id == Student.id)
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
    )
    count_base = (
        select(func.count(Attendance.id))
        .join(Student, Attendance.student_id == Student.id)
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
    )

    filters = []
    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            filters.append(AttendanceSession.start_time >= day)
            filters.append(AttendanceSession.start_time < day + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    if subject:
        filters.append(AttendanceSession.subject == subject)
    if year:
        filters.append(AttendanceSession.year == year)
    if branch:
        filters.append(AttendanceSession.branch == branch)
    if section:
        filters.append(AttendanceSession.section == section)
    if search:
        filters.append(
            or_(
                Student.name.ilike(f"%{search}%"),
                Student.roll_number.ilike(f"%{search}%"),
            )
        )

    for f in filters:
        base = base.where(f)
        count_base = count_base.where(f)

    total = (await db.execute(count_base)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        base.order_by(AttendanceSession.start_time.desc(), Attendance.recognized_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.all()

    return HistoryListResponse(
        records=[
            HistoryRecord(
                id=att.id,
                session_id=att.session_id,
                student_id=att.student_id,
                student_name=student.name,
                student_roll=student.roll_number,
                status=att.status,
                confidence=att.confidence,
                recognized_at=att.recognized_at,
                subject=session.subject,
                classroom=session.classroom,
                year=session.year,
                branch=session.branch,
                section=session.section,
                session_date=session.start_time,
            )
            for att, student, session in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.websocket("/session/{session_id}/live")
async def live_session_ws(websocket: WebSocket, session_id: int):
    """
    WebSocket endpoint for live attendance session streaming.
    Sends frames and recognition results in real-time.
    """
    await websocket.accept()

    # Add client to active session
    if session_id not in active_sessions:
        active_sessions[session_id] = {"stop": False, "clients": []}
    active_sessions[session_id]["clients"].append(websocket)

    try:
        while True:
            # Keep connection alive, listen for stop commands
            data = await websocket.receive_text()
            if data == "stop":
                active_sessions[session_id]["stop"] = True
                break
    except WebSocketDisconnect:
        pass
    finally:
        if session_id in active_sessions:
            clients = active_sessions[session_id]["clients"]
            if websocket in clients:
                clients.remove(websocket)
