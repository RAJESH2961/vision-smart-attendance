"""
Student request/response schemas.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class StudentCreate(BaseModel):
    roll_number: str
    name: str
    branch: str
    section: str
    year: int
    course: Optional[str] = None
    batch: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None  # Portal password (defaults to roll number)


class StudentUpdate(BaseModel):
    roll_number: Optional[str] = None
    name: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[int] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None


class StudentResponse(BaseModel):
    id: int
    roll_number: str
    name: str
    branch: Optional[str] = None
    section: str
    year: int
    course: Optional[str] = None
    batch: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    face_registered: int = 0
    created_at: str | None = None

    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    students: list[StudentResponse]
    total: int
    page: int
    page_size: int


class StudentStatsResponse(BaseModel):
    """Student profile page stats."""
    student: StudentResponse
    total_classes: int = 0
    present: int = 0
    absent: int = 0
    late: int = 0
    attendance_percentage: float = 0.0
