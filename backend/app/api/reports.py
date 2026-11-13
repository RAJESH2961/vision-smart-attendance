"""
Reports API router.

Endpoints:
- GET /api/reports/attendance-summary — Aggregated stats + trends + breakdowns
- GET /api/reports/student-wise      — Per-student attendance
- GET /api/reports/section-wise      — Per-section attendance
- GET /api/reports/branch-wise       — Per-branch attendance
- GET /api/reports/subject-wise      — Per-subject attendance
- GET /api/reports/export            — CSV download (filterable)
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_staff
from app.models.faculty import Faculty
from app.schemas.report import ReportResponse, StudentWiseRow
from app.services.report_service import (
    get_attendance_summary,
    get_daily_attendance_trend,
    get_monthly_attendance_trend,
    get_branch_wise_attendance,
    get_section_wise_attendance,
    get_subject_wise_attendance,
    get_subject_wise_for_student,
    get_student_wise_attendance,
    get_top_absentees,
    export_attendance_csv,
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/attendance-summary", response_model=ReportResponse)
async def attendance_summary(
    days: int = Query(30, description="Number of days for daily trend"),
    months: int = Query(6, description="Number of months for monthly trend"),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Get comprehensive attendance analytics."""
    return ReportResponse(
        summary=await get_attendance_summary(db, faculty_id=current_user.id),
        daily_trend=await get_daily_attendance_trend(db, days=days, faculty_id=current_user.id),
        monthly_trend=await get_monthly_attendance_trend(db, months=months),
        branch_wise=await get_branch_wise_attendance(db),
        section_wise=await get_section_wise_attendance(db),
        top_absentees=await get_top_absentees(db),
    )


@router.get("/student-wise", response_model=list[StudentWiseRow])
async def student_wise(
    year: int = Query(None),
    branch: str = Query(None),
    section: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Student-wise attendance report."""
    return await get_student_wise_attendance(db, year=year, branch=branch, section=section)


@router.get("/section-wise")
async def section_wise(
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Section-wise attendance report."""
    return await get_section_wise_attendance(db)


@router.get("/branch-wise")
async def branch_wise(
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Branch-wise attendance report."""
    return await get_branch_wise_attendance(db)


@router.get("/subject-wise")
async def subject_wise(
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Subject-wise attendance report."""
    return await get_subject_wise_attendance(db)


@router.get("/student/{student_id}/subject-wise")
async def student_subject_wise(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Subject-wise attendance for a specific student. Students can only view their own."""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return await get_subject_wise_for_student(db, student_id=student_id)


@router.get("/export")
async def export_csv(
    date: str = Query(None, description="YYYY-MM-DD"),
    subject: str = Query(None),
    year: int = Query(None),
    branch: str = Query(None),
    section: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Export attendance data as a CSV file download, with optional filters."""
    csv_content = await export_attendance_csv(
        db, date_str=date, subject=subject, year=year, branch=branch, section=section
    )

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"},
    )
