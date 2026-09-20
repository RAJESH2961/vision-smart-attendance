"""
Student request/response schemas.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class StudentCreate(BaseModel):
    roll_number: str
    name: str
    department: str
    section: str
    year: int
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class StudentUpdate(BaseModel):
    roll_number: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    section: Optional[str] = None
    year: Optional[int] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class StudentResponse(BaseModel):
    id: int
    roll_number: str
    name: str
    department: str
    section: str
    year: int
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
