"""
Student CRUD API router.

Endpoints:
- POST   /api/students       — Create student
- GET    /api/students       — List students (with search, filter, pagination)
- GET    /api/students/{id}  — Get student by ID
- PUT    /api/students/{id}  — Update student
- DELETE /api/students/{id}  — Delete student
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.faculty import Faculty
from app.models.student import Student
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentListResponse,
)

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Create a new student."""
    # Check if roll number already exists
    existing = await db.execute(
        select(Student).where(Student.roll_number == data.roll_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student with this roll number already exists",
        )

    student = Student(**data.model_dump())
    db.add(student)
    await db.flush()
    await db.refresh(student)

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        department=student.department,
        section=student.section,
        year=student.year,
        email=student.email,
        phone=student.phone,
        face_registered=student.face_registered,
        created_at=student.created_at.isoformat() if student.created_at else None,
    )


@router.get("", response_model=StudentListResponse)
async def list_students(
    search: str = Query(None, description="Search by name or roll number"),
    department: str = Query(None, description="Filter by department"),
    section: str = Query(None, description="Filter by section"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """List students with optional search, filter, and pagination."""
    query = select(Student)
    count_query = select(func.count(Student.id))

    # Search filter
    if search:
        search_filter = or_(
            Student.name.ilike(f"%{search}%"),
            Student.roll_number.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Department filter
    if department:
        query = query.where(Student.department == department)
        count_query = count_query.where(Student.department == department)

    # Section filter
    if section:
        query = query.where(Student.section == section)
        count_query = count_query.where(Student.section == section)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Student.roll_number).offset(offset).limit(page_size)

    result = await db.execute(query)
    students = result.scalars().all()

    return StudentListResponse(
        students=[
            StudentResponse(
                id=s.id,
                roll_number=s.roll_number,
                name=s.name,
                department=s.department,
                section=s.section,
                year=s.year,
                email=s.email,
                phone=s.phone,
                face_registered=s.face_registered,
                created_at=s.created_at.isoformat() if s.created_at else None,
            )
            for s in students
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Get a single student by ID."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        department=student.department,
        section=student.section,
        year=student.year,
        email=student.email,
        phone=student.phone,
        face_registered=student.face_registered,
        created_at=student.created_at.isoformat() if student.created_at else None,
    )


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Update student details."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    await db.flush()
    await db.refresh(student)

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        department=student.department,
        section=student.section,
        year=student.year,
        email=student.email,
        phone=student.phone,
        face_registered=student.face_registered,
        created_at=student.created_at.isoformat() if student.created_at else None,
    )


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Delete a student and all their data (face embeddings, attendance)."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await db.delete(student)
    await db.flush()
