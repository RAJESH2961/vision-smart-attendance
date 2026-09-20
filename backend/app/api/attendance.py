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
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
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
)
from app.services.attendance_service import (
    start_attendance_session,
    active_sessions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.post("/session/start", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def start_session(
    data: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Start a new attendance recognition session."""
    session = AttendanceSession(
        faculty_id=current_user.id,
        subject=data.subject,
        classroom=data.classroom,
        section=data.section,
        duration=data.duration,
        status=SessionStatus.PENDING.value,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    # Initialize active session tracking
    active_sessions[session.id] = {"stop": False, "clients": []}

    # Launch the background recognition task
    asyncio.create_task(start_attendance_session(session.id))

    return SessionResponse(
        id=session.id,
        faculty_id=session.faculty_id,
        subject=session.subject,
        classroom=session.classroom,
        section=session.section,
        duration=session.duration,
        start_time=session.start_time,
        end_time=session.end_time,
        status=session.status,
        total_recognized=session.total_recognized,
        total_unknown=session.total_unknown,
    )


@router.get("/session/{session_id}/status", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
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
        elapsed_seconds=round(elapsed, 1),
        remaining_seconds=round(remaining, 1),
    )


@router.post("/session/{session_id}/stop")
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
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
    current_user: Faculty = Depends(get_current_user),
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
        "session": SessionResponse(
            id=session.id,
            faculty_id=session.faculty_id,
            subject=session.subject,
            classroom=session.classroom,
            section=session.section,
            duration=session.duration,
            start_time=session.start_time,
            end_time=session.end_time,
            status=session.status,
            total_recognized=session.total_recognized,
            total_unknown=session.total_unknown,
        ),
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
    current_user: Faculty = Depends(get_current_user),
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


@router.get("/student/{student_id}", response_model=AttendanceHistoryResponse)
async def get_student_attendance(
    student_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Get attendance history for a specific student."""
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
    current_user: Faculty = Depends(get_current_user),
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
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """List all attendance sessions for the current faculty."""
    count_result = await db.execute(
        select(func.count(AttendanceSession.id)).where(
            AttendanceSession.faculty_id == current_user.id
        )
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.faculty_id == current_user.id)
        .order_by(AttendanceSession.start_time.desc())
        .offset(offset)
        .limit(page_size)
    )
    sessions = result.scalars().all()

    return {
        "sessions": [
            SessionResponse(
                id=s.id,
                faculty_id=s.faculty_id,
                subject=s.subject,
                classroom=s.classroom,
                section=s.section,
                duration=s.duration,
                start_time=s.start_time,
                end_time=s.end_time,
                status=s.status,
                total_recognized=s.total_recognized,
                total_unknown=s.total_unknown,
            )
            for s in sessions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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
