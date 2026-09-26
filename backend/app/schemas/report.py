"""
Report/analytics response schemas.
"""

from pydantic import BaseModel
from typing import Optional


class AttendanceSummary(BaseModel):
    total_sessions: int = 0
    total_students: int = 0
    present_today: int = 0
    absent_today: int = 0
    attendance_percentage: float = 0.0
    total_classes_today: int = 0


class DailyAttendance(BaseModel):
    date: str
    present: int
    absent: int
    total: int
    percentage: float


class MonthlyAttendance(BaseModel):
    month: str  # e.g. "2026-09"
    present: int
    absent: int
    total: int
    percentage: float


class GroupAttendance(BaseModel):
    """Attendance grouped by branch/section/subject."""
    name: str
    present: int
    absent: int
    late: int = 0
    total: int
    percentage: float


class StudentWiseRow(BaseModel):
    student_id: int
    student_name: str
    roll_number: str
    year: Optional[int] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    present: int = 0
    absent: int = 0
    late: int = 0
    total_classes: int = 0
    percentage: float = 0.0


class TopAbsentee(BaseModel):
    student_id: int
    student_name: str
    roll_number: str
    branch: Optional[str] = None
    total_absent: int
    total_classes: int
    absence_percentage: float


class ReportResponse(BaseModel):
    summary: AttendanceSummary
    daily_trend: list[DailyAttendance] = []
    monthly_trend: list[MonthlyAttendance] = []
    branch_wise: list[GroupAttendance] = []
    section_wise: list[GroupAttendance] = []
    top_absentees: list[TopAbsentee] = []
