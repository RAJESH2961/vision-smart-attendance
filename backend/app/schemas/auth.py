"""
Authentication request/response schemas.
"""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FacultyResponse(BaseModel):
    id: int
    name: str
    email: str
    department: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True
