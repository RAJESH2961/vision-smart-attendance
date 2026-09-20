"""
Attendance request/response schemas.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionStartRequest(BaseModel):
    subject: str
    classroom: str
    section: str
    duration: int = 20  # seconds


class SessionResponse(BaseModel):
    id: int
    faculty_id: int
    subject: str
    classroom: str
    section: str
    duration: int
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str
    total_recognized: int = 0
    total_unknown: int = 0

    class Config:
        from_attributes = True


class SessionStatusResponse(BaseModel):
    id: int
    status: str
    total_recognized: int
    total_unknown: int
    elapsed_seconds: float = 0
    remaining_seconds: float = 0


class AttendanceRecord(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_name: str | None = None
    student_roll: str | None = None
    status: str
    confidence: float | None = None
    recognized_at: datetime | None = None

    class Config:
        from_attributes = True


class AttendanceUpdateRequest(BaseModel):
    status: str  # present, absent, late


class AttendanceHistoryResponse(BaseModel):
    records: list[AttendanceRecord]
    total: int
    page: int
    page_size: int


class RecognitionResult(BaseModel):
    """Real-time recognition result sent via WebSocket."""
    student_id: int | None = None
    student_name: str | None = None
    student_roll: str | None = None
    confidence: float = 0.0
    is_unknown: bool = False
    bbox: list[int] = []  # [x1, y1, x2, y2]
