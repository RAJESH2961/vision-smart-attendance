"""
Report service — aggregation queries for analytics.
"""

import csv
import io
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional

from sqlalchemy import select, func, case, and_, or_, distinct, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.attendance_session import AttendanceSession
from app.models.student import Student

logger = logging.getLogger(__name__)


def _branch_col():
    """Branch column with fallback to legacy department."""
    return func.coalesce(Student.branch, Student.department)


async def get_attendance_summary(db: AsyncSession, faculty_id: Optional[int] = None) -> dict:
    """Get overall attendance summary stats."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0

    session_query = select(func.count(AttendanceSession.id))
    if faculty_id:
        session_query = session_query.where(AttendanceSession.faculty_id == faculty_id)
    total_sessions = (await db.execute(session_query)).scalar() or 0

    today_filter = and_(
        AttendanceSession.start_time >= today_start,
        AttendanceSession.start_time < today_end,
    )
    today_sessions_query = select(func.count(AttendanceSession.id)).where(today_filter)
    if faculty_id:
        today_sessions_query = today_sessions_query.where(
            AttendanceSession.faculty_id == faculty_id
        )
    total_classes_today = (await db.execute(today_sessions_query)).scalar() or 0

    today_session_ids = select(AttendanceSession.id).where(today_filter)
    if faculty_id:
        today_session_ids = today_session_ids.where(
            AttendanceSession.faculty_id == faculty_id
        )

    # Present/absent today based on today's session records
    present_query = select(func.count(Attendance.id)).where(
        and_(
            Attendance.session_id.in_(today_session_ids),
            Attendance.status.in_(["present", "late"]),
        )
    )
    present_today = (await db.execute(present_query)).scalar() or 0

    absent_query = select(func.count(Attendance.id)).where(
        and_(
            Attendance.session_id.in_(today_session_ids),
            Attendance.status == "absent",
        )
    )
    absent_today = (await db.execute(absent_query)).scalar() or 0

    total_marked = present_today + absent_today
    attendance_percentage = (
        round((present_today / total_marked) * 100, 1) if total_marked > 0 else 0
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

        session_query = select(AttendanceSession.id).where(
            and_(
                AttendanceSession.start_time >= day_start,
                AttendanceSession.start_time < day_end,
            )
        )
        if faculty_id:
            session_query = session_query.where(AttendanceSession.faculty_id == faculty_id)

        present_query = select(func.count(Attendance.id)).where(
            and_(
                Attendance.session_id.in_(session_query),
                Attendance.status.in_(["present", "late"]),
            )
        )
        present = (await db.execute(present_query)).scalar() or 0

        absent_query = select(func.count(Attendance.id)).where(
            and_(
                Attendance.session_id.in_(session_query),
                Attendance.status == "absent",
            )
        )
        absent = (await db.execute(absent_query)).scalar() or 0

        total = present + absent
        percentage = round((present / total) * 100, 1) if total > 0 else 0

        results.append({
            "date": target_date.isoformat(),
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": percentage,
        })

    return results


async def get_monthly_attendance_trend(db: AsyncSession, months: int = 6) -> list[dict]:
    """Get monthly aggregated attendance for the last N months."""
    results = []
    today = date.today()

    for i in range(months - 1, -1, -1):
        # Subtract i months from today
        y, m = today.year, today.month
        m -= i
        while m <= 0:
            m += 12
            y -= 1
        month_start = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            month_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(y, m + 1, 1, tzinfo=timezone.utc)

        session_ids = select(AttendanceSession.id).where(
            and_(
                AttendanceSession.start_time >= month_start,
                AttendanceSession.start_time < month_end,
            )
        )

        present = (await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.session_id.in_(session_ids),
                    Attendance.status.in_(["present", "late"]),
                )
            )
        )).scalar() or 0
        absent = (await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.session_id.in_(session_ids),
                    Attendance.status == "absent",
                )
            )
        )).scalar() or 0

        total = present + absent
        results.append({
            "month": month_start.strftime("%b %Y"),
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": round((present / total) * 100, 1) if total else 0,
        })

    return results


async def _group_attendance(db: AsyncSession, group_col) -> list[dict]:
    """Attendance grouped by an arbitrary column/expression."""
    stats = await db.execute(
        select(
            group_col.label("gname"),
            func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
            func.sum(case((Attendance.status == "late", 1), else_=0)).label("late"),
            func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
        )
        .select_from(Attendance)
        .join(Student, Attendance.student_id == Student.id)
        .group_by(group_col)
    )

    results = []
    for row in stats.all():
        if row.gname is None:
            continue
        present = row.present or 0
        late = row.late or 0
        absent = row.absent or 0
        total = present + late + absent
        results.append({
            "name": str(row.gname),
            "present": present,
            "absent": absent,
            "late": late,
            "total": total,
            "percentage": round(((present + late) / total) * 100, 1) if total else 0,
        })
    return sorted(results, key=lambda r: r["name"])


async def get_branch_wise_attendance(db: AsyncSession) -> list[dict]:
    return await _group_attendance(db, _branch_col())


async def get_section_wise_attendance(db: AsyncSession) -> list[dict]:
    """Attendance grouped by 'Year-Branch-Section' class label."""
    label = func.concat(
        "Y", cast(Student.year, String), " ",
        _branch_col(), "-", Student.section
    )
    return await _group_attendance(db, label)


async def get_subject_wise_attendance(db: AsyncSession) -> list[dict]:
    """Attendance grouped by subject (from sessions)."""
    subjects = await db.execute(select(distinct(AttendanceSession.subject)))
    results = []
    for (subj,) in subjects.all():
        if not subj:
            continue
        session_ids = select(AttendanceSession.id).where(AttendanceSession.subject == subj)
        stats = await db.execute(
            select(
                func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
                func.sum(case((Attendance.status == "late", 1), else_=0)).label("late"),
                func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
            ).where(Attendance.session_id.in_(session_ids))
        )
        row = stats.one()
        present = row.present or 0
        late = row.late or 0
        absent = row.absent or 0
        total = present + late + absent
        results.append({
            "name": subj,
            "present": present,
            "absent": absent,
            "late": late,
            "total": total,
            "percentage": round(((present + late) / total) * 100, 1) if total else 0,
        })
    return results


async def get_student_wise_attendance(
    db: AsyncSession,
    year: Optional[int] = None,
    branch: Optional[str] = None,
    section: Optional[str] = None,
) -> list[dict]:
    """Per-student attendance totals, optionally filtered by class."""
    query = (
        select(
            Student.id,
            Student.name,
            Student.roll_number,
            Student.year,
            _branch_col().label("branch"),
            Student.section,
            func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
            func.sum(case((Attendance.status == "late", 1), else_=0)).label("late"),
            func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
        )
        .outerjoin(Attendance, Attendance.student_id == Student.id)
        .group_by(Student.id, Student.name, Student.roll_number, Student.year, Student.branch, Student.department, Student.section)
        .order_by(Student.roll_number)
    )
    if year:
        query = query.where(Student.year == year)
    if branch:
        query = query.where(or_(Student.branch == branch, Student.department == branch))
    if section:
        query = query.where(Student.section == section)

    rows = (await db.execute(query)).all()
    return [
        {
            "student_id": r.id,
            "student_name": r.name,
            "roll_number": r.roll_number,
            "year": r.year,
            "branch": r.branch,
            "section": r.section,
            "present": r.present or 0,
            "absent": r.absent or 0,
            "late": r.late or 0,
            "total_classes": (r.present or 0) + (r.absent or 0) + (r.late or 0),
            "percentage": round(
                (((r.present or 0) + (r.late or 0)) / ((r.present or 0) + (r.absent or 0) + (r.late or 0))) * 100, 1
            ) if ((r.present or 0) + (r.absent or 0) + (r.late or 0)) else 0.0,
        }
        for r in rows
    ]


async def get_top_absentees(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Get students with most absences."""
    total_sessions = (await db.execute(select(func.count(AttendanceSession.id)))).scalar() or 0
    if total_sessions == 0:
        return []

    query = (
        select(
            Student.id,
            Student.name,
            Student.roll_number,
            _branch_col().label("branch"),
            func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent_count"),
            func.count(Attendance.id).label("total_records"),
        )
        .outerjoin(Attendance, Attendance.student_id == Student.id)
        .group_by(Student.id, Student.name, Student.roll_number, Student.branch, Student.department)
        .order_by(func.sum(case((Attendance.status == "absent", 1), else_=0)).desc())
        .limit(limit)
    )

    rows = (await db.execute(query)).all()
    absentees = []
    for row in rows:
        absent = row.absent_count or 0
        total = row.total_records or total_sessions
        absentees.append({
            "student_id": row.id,
            "student_name": row.name,
            "roll_number": row.roll_number,
            "branch": row.branch,
            "total_absent": absent,
            "total_classes": total,
            "absence_percentage": round((absent / total) * 100, 1) if total else 0,
        })
    return absentees


async def get_subject_wise_for_student(
    db: AsyncSession, student_id: int
) -> list[dict]:
    """Per-subject attendance breakdown for a single student."""
    query = (
        select(
            AttendanceSession.subject,
            func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
            func.sum(case((Attendance.status == "late", 1), else_=0)).label("late"),
            func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
        )
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
        .where(Attendance.student_id == student_id)
        .group_by(AttendanceSession.subject)
        .order_by(AttendanceSession.subject)
    )
    rows = (await db.execute(query)).all()
    results = []
    for r in rows:
        present = r.present or 0
        late = r.late or 0
        absent = r.absent or 0
        total = present + late + absent
        results.append({
            "subject": r.subject or "Unknown",
            "present": present,
            "absent": absent,
            "late": late,
            "total": total,
            "percentage": round(((present + late) / total) * 100, 1) if total else 0.0,
        })
    return results


async def export_attendance_csv(
    db: AsyncSession,
    date_str: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    branch: Optional[str] = None,
    section: Optional[str] = None,
) -> str:
    """Export attendance records as CSV, with optional filters."""
    query = (
        select(
            AttendanceSession.start_time,
            AttendanceSession.subject,
            AttendanceSession.classroom,
            AttendanceSession.year.label("session_year"),
            AttendanceSession.branch.label("session_branch"),
            AttendanceSession.section.label("session_section"),
            Student.roll_number,
            Student.name,
            Attendance.status,
            Attendance.confidence,
            Attendance.recognized_at,
        )
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
        .join(Student, Attendance.student_id == Student.id)
        .order_by(AttendanceSession.start_time.desc())
    )

    if date_str:
        day = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        query = query.where(
            and_(
                AttendanceSession.start_time >= day,
                AttendanceSession.start_time < day + timedelta(days=1),
            )
        )
    if subject:
        query = query.where(AttendanceSession.subject == subject)
    if year:
        query = query.where(AttendanceSession.year == year)
    if branch:
        query = query.where(AttendanceSession.branch == branch)
    if section:
        query = query.where(AttendanceSession.section == section)

    rows = (await db.execute(query)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Subject", "Classroom", "Year", "Branch", "Section",
        "Roll Number", "Name", "Status", "Confidence", "Recognized At"
    ])

    for row in rows:
        writer.writerow([
            row.start_time.strftime("%Y-%m-%d") if row.start_time else "",
            row.subject,
            row.classroom,
            row.session_year or "",
            row.session_branch or "",
            row.session_section or "",
            row.roll_number,
            row.name,
            row.status,
            f"{row.confidence:.2f}" if row.confidence else "",
            row.recognized_at.strftime("%Y-%m-%d %H:%M:%S") if row.recognized_at else "",
        ])

    return output.getvalue()
