"""
Subject request/response schemas.
"""

from pydantic import BaseModel
from typing import Optional


class SubjectCreate(BaseModel):
    code: str
    name: str
    course: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None


class SubjectResponse(BaseModel):
    id: int
    code: str
    name: str
    course: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    faculty_id: Optional[int] = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class SubjectListResponse(BaseModel):
    subjects: list[SubjectResponse]
    total: int
