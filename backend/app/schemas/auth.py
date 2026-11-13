"""
Authentication request/response schemas.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    identifier: str  # Faculty email OR student roll number
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class FacultyResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str = "faculty"
    department: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class FacultyCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "faculty"  # admin | faculty
    department: Optional[str] = None


class StudentLoginResponse(BaseModel):
    """Response shape for /me when the caller is a student."""
    id: int
    name: str
    roll_number: str
    role: str = "student"
    year: int | None = None
    branch: str | None = None
    section: str | None = None
