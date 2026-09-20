"""
Reports API router.

Endpoints:
- GET /api/reports/attendance-summary — Aggregated stats
- GET /api/reports/export              — CSV download
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.faculty import Faculty
from app.schemas.report import ReportResponse
from app.services.report_service import (
    get_attendance_summary,
    get_daily_attendance_trend,
    get_department_wise_attendance,
    get_top_absentees,
    export_attendance_csv,
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/attendance-summary", response_model=ReportResponse)
async def attendance_summary(
    days: int = Query(30, description="Number of days for daily trend"),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Get comprehensive attendance analytics."""
    summary = await get_attendance_summary(db, faculty_id=current_user.id)
    daily_trend = await get_daily_attendance_trend(db, days=days, faculty_id=current_user.id)
    department_wise = await get_department_wise_attendance(db)
    top_absentees = await get_top_absentees(db)

    return ReportResponse(
        summary=summary,
        daily_trend=daily_trend,
        department_wise=department_wise,
        top_absentees=top_absentees,
    )


@router.get("/export")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Export attendance data as a CSV file download."""
    csv_content = await export_attendance_csv(db)

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"},
    )
