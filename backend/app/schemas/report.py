"""
Report/analytics response schemas.
"""

from pydantic import BaseModel


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


class DepartmentAttendance(BaseModel):
    department: str
    present: int
    absent: int
    total: int
    percentage: float


class TopAbsentee(BaseModel):
    student_id: int
    student_name: str
    roll_number: str
    department: str
    total_absent: int
    total_classes: int
    absence_percentage: float


class ReportResponse(BaseModel):
    summary: AttendanceSummary
    daily_trend: list[DailyAttendance] = []
    department_wise: list[DepartmentAttendance] = []
    top_absentees: list[TopAbsentee] = []
