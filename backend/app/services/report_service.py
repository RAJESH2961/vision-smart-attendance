"""
Report service — aggregation queries for analytics.
"""

import csv
import io
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional

from sqlalchemy import select, func, case, and_, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.attendance_session import AttendanceSession
from app.models.student import Student

logger = logging.getLogger(__name__)


async def get_attendance_summary(db: AsyncSession, faculty_id: Optional[int] = None) -> dict:
    """Get overall attendance summary stats."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Total students
    total_students_result = await db.execute(select(func.count(Student.id)))
    total_students = total_students_result.scalar() or 0

    # Total sessions
    session_query = select(func.count(AttendanceSession.id))
    if faculty_id:
        session_query = session_query.where(AttendanceSession.faculty_id == faculty_id)
    total_sessions_result = await db.execute(session_query)
    total_sessions = total_sessions_result.scalar() or 0

    # Today's sessions
    today_sessions_query = select(func.count(AttendanceSession.id)).where(
        and_(
            AttendanceSession.start_time >= today_start,
            AttendanceSession.start_time < today_end,
        )
    )
    if faculty_id:
        today_sessions_query = today_sessions_query.where(
            AttendanceSession.faculty_id == faculty_id
        )
    today_sessions_result = await db.execute(today_sessions_query)
    total_classes_today = today_sessions_result.scalar() or 0

    # Today's attendance: get session IDs for today
    today_session_ids_query = select(AttendanceSession.id).where(
        and_(
            AttendanceSession.start_time >= today_start,
            AttendanceSession.start_time < today_end,
        )
    )
    if faculty_id:
        today_session_ids_query = today_session_ids_query.where(
            AttendanceSession.faculty_id == faculty_id
        )

    # Present today (distinct students marked present in today's sessions)
    present_query = (
        select(func.count(distinct(Attendance.student_id)))
        .where(
            and_(
                Attendance.session_id.in_(today_session_ids_query),
                Attendance.status == "present",
            )
        )
    )
    present_result = await db.execute(present_query)
    present_today = present_result.scalar() or 0

    absent_today = max(0, total_students - present_today)

    attendance_percentage = (
        round((present_today / total_students) * 100, 1) if total_students > 0 else 0
    )

    return {
        "total_sessions": total_sessions,
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": absent_today,
        "attendance_percentage": attendance_percentage,
        "total_classes_today": total_classes_today,
    }


async def get_daily_attendance_trend(
    db: AsyncSession, days: int = 30, faculty_id: Optional[int] = None
) -> list[dict]:
    """Get daily attendance counts for the last N days."""
    results = []
    today = date.today()

    for i in range(days - 1, -1, -1):
        target_date = today - timedelta(days=i)
        day_start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        # Get sessions for this day
        session_query = select(AttendanceSession.id).where(
            and_(
                AttendanceSession.start_time >= day_start,
                AttendanceSession.start_time < day_end,
            )
        )
        if faculty_id:
            session_query = session_query.where(AttendanceSession.faculty_id == faculty_id)

        # Count present
        present_query = select(func.count(distinct(Attendance.student_id))).where(
            and_(
                Attendance.session_id.in_(session_query),
                Attendance.status == "present",
            )
        )
        present_result = await db.execute(present_query)
        present = present_result.scalar() or 0

        # Total students
        total_result = await db.execute(select(func.count(Student.id)))
        total = total_result.scalar() or 0

        absent = max(0, total - present)
        percentage = round((present / total) * 100, 1) if total > 0 else 0

        results.append({
            "date": target_date.isoformat(),
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": percentage,
        })

    return results


async def get_department_wise_attendance(db: AsyncSession) -> list[dict]:
    """Get attendance breakdown by department."""
    # Get all departments
    dept_result = await db.execute(select(distinct(Student.department)))
    departments = [row[0] for row in dept_result.all()]

    results = []
    for dept in departments:
        # Total students in department
        total_result = await db.execute(
            select(func.count(Student.id)).where(Student.department == dept)
        )
        total = total_result.scalar() or 0

        # Students with attendance (present)
        present_result = await db.execute(
            select(func.count(distinct(Attendance.student_id)))
            .join(Student, Attendance.student_id == Student.id)
            .where(
                and_(
                    Student.department == dept,
                    Attendance.status == "present",
                )
            )
        )
        present = present_result.scalar() or 0
        absent = max(0, total - present)
        percentage = round((present / total) * 100, 1) if total > 0 else 0

        results.append({
            "department": dept,
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": percentage,
        })

    return results


async def get_top_absentees(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Get students with most absences."""
    # Total sessions
    total_sessions_result = await db.execute(select(func.count(AttendanceSession.id)))
    total_sessions = total_sessions_result.scalar() or 0

    if total_sessions == 0:
        return []

    # Get all students with their present count
    query = (
        select(
            Student.id,
            Student.name,
            Student.roll_number,
            Student.department,
            func.count(Attendance.id).label("present_count"),
        )
        .outerjoin(Attendance, and_(
            Attendance.student_id == Student.id,
            Attendance.status == "present",
        ))
        .group_by(Student.id, Student.name, Student.roll_number, Student.department)
        .order_by(func.count(Attendance.id).asc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    absentees = []
    for row in rows:
        present_count = row.present_count or 0
        absent_count = total_sessions - present_count
        absence_pct = round((absent_count / total_sessions) * 100, 1) if total_sessions > 0 else 0

        absentees.append({
            "student_id": row.id,
            "student_name": row.name,
            "roll_number": row.roll_number,
            "department": row.department,
            "total_absent": absent_count,
            "total_classes": total_sessions,
            "absence_percentage": absence_pct,
        })

    return absentees


async def export_attendance_csv(db: AsyncSession) -> str:
    """Export all attendance records as CSV string."""
    query = (
        select(
            AttendanceSession.start_time,
            AttendanceSession.subject,
            AttendanceSession.classroom,
            Student.roll_number,
            Student.name,
            Student.department,
            Student.section,
            Attendance.status,
            Attendance.confidence,
            Attendance.recognized_at,
        )
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
        .join(Student, Attendance.student_id == Student.id)
        .order_by(AttendanceSession.start_time.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Subject", "Classroom", "Roll Number", "Name",
        "Department", "Section", "Status", "Confidence", "Recognized At"
    ])

    for row in rows:
        writer.writerow([
            row.start_time.strftime("%Y-%m-%d") if row.start_time else "",
            row.subject,
            row.classroom,
            row.roll_number,
            row.name,
            row.department,
            row.section,
            row.status,
            f"{row.confidence:.2f}" if row.confidence else "",
            row.recognized_at.strftime("%Y-%m-%d %H:%M:%S") if row.recognized_at else "",
        ])

    return output.getvalue()
