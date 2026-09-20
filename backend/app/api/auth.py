"""
Authentication API router.

Endpoints:
- POST /api/auth/login — Authenticate and receive JWT
- GET  /api/auth/me    — Get current logged-in faculty profile
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.models.faculty import Faculty
from app.schemas.auth import LoginRequest, TokenResponse, FacultyResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate faculty with email and password, return JWT token."""
    result = await db.execute(select(Faculty).where(Faculty.email == request.email))
    faculty = result.scalar_one_or_none()

    if not faculty or not verify_password(request.password, faculty.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(data={"sub": str(faculty.id)})
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=FacultyResponse)
async def get_me(current_user: Faculty = Depends(get_current_user)):
    """Get the currently authenticated faculty member's profile."""
    return FacultyResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        department=current_user.department,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.post("/seed", include_in_schema=False)
async def seed_faculty(db: AsyncSession = Depends(get_db)):
    """
    Development-only endpoint: Create a default faculty account.
    Remove in production.
    """
    existing = await db.execute(select(Faculty).where(Faculty.email == "admin@university.edu"))
    if existing.scalar_one_or_none():
        return {"message": "Default faculty already exists"}

    faculty = Faculty(
        name="Dr. Admin",
        email="admin@university.edu",
        password_hash=hash_password("password123"),
        department="Computer Science",
    )
    db.add(faculty)
    await db.commit()
    return {"message": "Default faculty created", "email": "admin@university.edu", "password": "password123"}
