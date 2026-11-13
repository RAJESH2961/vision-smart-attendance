"""
Authentication API router.

Endpoints:
- POST /api/auth/login    — Authenticate (faculty email or student roll number)
- POST /api/auth/seed     — Create default admin + faculty accounts
- GET  /api/auth/me       — Current user profile (any role)
- GET  /api/auth/faculty  — List faculty accounts (admin)
- POST /api/auth/faculty  — Create a faculty account (admin)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, get_current_user,
    require_admin, hash_password,
)
from app.models.faculty import Faculty
from app.models.student import Student
from app.schemas.auth import (
    LoginRequest, TokenResponse, FacultyResponse, FacultyCreate,
    StudentLoginResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a user and return a JWT.
    - Staff (admin/faculty) log in with email
    - Students log in with roll number
    """
    ident = request.identifier.strip()

    # Try faculty by email first
    result = await db.execute(select(Faculty).where(Faculty.email == ident.lower()))
    faculty = result.scalar_one_or_none()
    if faculty and verify_password(request.password, faculty.password_hash):
        token = create_access_token(data={"sub": str(faculty.id), "role": faculty.role})
        return TokenResponse(access_token=token, role=faculty.role, name=faculty.name)

    # Try student by roll number
    result = await db.execute(select(Student).where(Student.roll_number == ident))
    student = result.scalar_one_or_none()
    if student and student.password_hash and verify_password(request.password, student.password_hash):
        token = create_access_token(data={"sub": str(student.id), "role": "student"})
        return TokenResponse(access_token=token, role="student", name=student.name)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed_default_users(db: AsyncSession = Depends(get_db)):
    """
    Create default admin and faculty accounts for first-time setup.
    Idempotent — upgrades/creates only what is missing.
    """
    created = []

    # Admin account
    result = await db.execute(select(Faculty).where(Faculty.email == "admin@college.edu"))
    admin = result.scalar_one_or_none()
    if not admin:
        db.add(Faculty(
            name="Admin", email="admin@college.edu",
            password_hash=hash_password("admin123"),
            role="admin", department="Administration",
        ))
        created.append("admin@college.edu / admin123")
    elif admin.role != "admin":
        admin.role = "admin"
        created.append("admin@college.edu promoted to admin")

    # Faculty account
    result = await db.execute(select(Faculty).where(Faculty.email == "faculty@college.edu"))
    if not result.scalar_one_or_none():
        db.add(Faculty(
            name="Demo Faculty", email="faculty@college.edu",
            password_hash=hash_password("faculty123"),
            role="faculty", department="CSE",
        ))
        created.append("faculty@college.edu / faculty123")

    await db.flush()
    return {"created": bool(created), "accounts": created}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Get the currently logged-in user's profile (staff or student)."""
    if current_user.role == "student":
        return StudentLoginResponse(
            id=current_user.id,
            name=current_user.name,
            roll_number=current_user.roll_number,
            role="student",
            year=current_user.year,
            branch=current_user.branch or current_user.department,
            section=current_user.section,
        )
    return FacultyResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department=current_user.department,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.get("/faculty", response_model=list[FacultyResponse])
async def list_faculty(
    db: AsyncSession = Depends(get_db),
    admin: Faculty = Depends(require_admin),
):
    """List all staff accounts (admin only)."""
    result = await db.execute(select(Faculty).order_by(Faculty.id))
    return [
        FacultyResponse(
            id=f.id, name=f.name, email=f.email, role=f.role,
            department=f.department,
            created_at=f.created_at.isoformat() if f.created_at else None,
        )
        for f in result.scalars().all()
    ]


@router.post("/faculty", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
async def create_faculty(
    data: FacultyCreate,
    db: AsyncSession = Depends(get_db),
    admin: Faculty = Depends(require_admin),
):
    """Create a new staff account (admin only)."""
    if data.role not in ("admin", "faculty"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'faculty'")

    existing = await db.execute(select(Faculty).where(Faculty.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    faculty = Faculty(
        name=data.name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=data.role,
        department=data.department,
    )
    db.add(faculty)
    await db.flush()
    await db.refresh(faculty)

    return FacultyResponse(
        id=faculty.id, name=faculty.name, email=faculty.email, role=faculty.role,
        department=faculty.department,
        created_at=faculty.created_at.isoformat() if faculty.created_at else None,
    )
