"""
Student CRUD API router.

Endpoints:
- POST   /api/students            — Create student
- GET    /api/students            — List students (search, year/branch/section filters, pagination)
- GET    /api/students/meta       — Distinct years/branches/sections for dropdowns
- GET    /api/students/{id}       — Get student by ID
- GET    /api/students/{id}/stats — Student profile + attendance stats
- PUT    /api/students/{id}       — Update student (incl. moving sections)
- DELETE /api/students/{id}       — Delete student
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_staff, require_admin, hash_password
from app.models.faculty import Faculty
from app.models.student import Student
from app.models.attendance import Attendance
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentListResponse,
    StudentStatsResponse,
)

router = APIRouter(prefix="/api/students", tags=["Students"])


def _to_response(s: Student) -> StudentResponse:
    return StudentResponse(
        id=s.id,
        roll_number=s.roll_number,
        name=s.name,
        branch=s.branch or s.department,
        section=s.section,
        year=s.year,
        course=s.course,
        batch=s.batch,
        gender=s.gender,
        email=s.email,
        phone=s.phone,
        face_registered=s.face_registered,
        created_at=s.created_at.isoformat() if s.created_at else None,
    )


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Create a new student."""
    existing = await db.execute(
        select(Student).where(Student.roll_number == data.roll_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student with this roll number already exists",
        )

    if data.email:
        existing_email = await db.execute(
            select(Student).where(Student.email == data.email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A student with this email already exists",
            )

    values = data.model_dump()
    values["department"] = data.branch  # keep legacy column populated
    # Default portal password = roll number
    values["password_hash"] = hash_password(values.pop("password") or data.roll_number)
    student = Student(**values)
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return _to_response(student)


@router.get("", response_model=StudentListResponse)
async def list_students(
    search: str = Query(None, description="Search by name or roll number"),
    year: int = Query(None, description="Filter by year"),
    branch: str = Query(None, description="Filter by branch"),
    section: str = Query(None, description="Filter by section"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """List students with optional search, filters, and pagination."""
    query = select(Student)
    count_query = select(func.count(Student.id))

    if search:
        search_filter = or_(
            Student.name.ilike(f"%{search}%"),
            Student.roll_number.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if year:
        query = query.where(Student.year == year)
        count_query = count_query.where(Student.year == year)
    if branch:
        branch_filter = or_(Student.branch == branch, Student.department == branch)
        query = query.where(branch_filter)
        count_query = count_query.where(branch_filter)
    if section:
        query = query.where(Student.section == section)
        count_query = count_query.where(Student.section == section)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Student.roll_number).offset(offset).limit(page_size)

    result = await db.execute(query)
    students = result.scalars().all()

    return StudentListResponse(
        students=[_to_response(s) for s in students],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/meta")
async def get_students_meta(
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Distinct years, branches, sections, courses, batches and subjects for filter dropdowns."""
    from app.models.attendance_session import AttendanceSession
    from app.models.subject import Subject

    years = await db.execute(
        select(distinct(Student.year)).where(Student.year.isnot(None)).order_by(Student.year)
    )
    branches = await db.execute(
        select(distinct(Student.branch)).where(Student.branch.isnot(None)).order_by(Student.branch)
    )
    # Fall back to department values for legacy rows
    dept_rows = await db.execute(
        select(distinct(Student.department)).where(Student.branch.is_(None))
    )
    sections = await db.execute(
        select(distinct(Student.section)).where(Student.section.isnot(None)).order_by(Student.section)
    )
    courses = await db.execute(
        select(distinct(Student.course)).where(Student.course.isnot(None)).order_by(Student.course)
    )
    batches = await db.execute(
        select(distinct(Student.batch)).where(Student.batch.isnot(None)).order_by(Student.batch)
    )
    session_subjects = await db.execute(
        select(distinct(AttendanceSession.subject)).order_by(AttendanceSession.subject)
    )
    subject_rows = await db.execute(
        select(Subject.name).order_by(Subject.name)
    )

    branch_set = {r[0] for r in branches.all()}
    branch_set.update(r[0] for r in dept_rows.all() if r[0])
    subject_set = {r[0] for r in session_subjects.all() if r[0]}
    subject_set.update(r[0] for r in subject_rows.all() if r[0])

    return {
        "years": sorted(r[0] for r in years.all() if r[0] is not None),
        "branches": sorted(branch_set),
        "sections": [r[0] for r in sections.all() if r[0]],
        "courses": [r[0] for r in courses.all() if r[0]],
        "batches": [r[0] for r in batches.all() if r[0]],
        "subjects": sorted(subject_set),
    }


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get a single student by ID. Staff can view any; students only themselves."""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return _to_response(student)


@router.get("/{student_id}/stats", response_model=StudentStatsResponse)
async def get_student_stats(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get student profile with attendance statistics. Students can only view their own."""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats_result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
            func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
            func.sum(case((Attendance.status == "late", 1), else_=0)).label("late"),
        ).where(Attendance.student_id == student_id)
    )
    row = stats_result.one()
    total = row.total or 0
    present = row.present or 0
    absent = row.absent or 0
    late = row.late or 0
    pct = round(((present + late) / total) * 100, 1) if total else 0.0

    return StudentStatsResponse(
        student=_to_response(student),
        total_classes=total,
        present=present,
        absent=absent,
        late=late,
        attendance_percentage=pct,
    )


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Update student details (also used to move a student between sections)."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("email"):
        existing_email = await db.execute(
            select(Student).where(
                Student.email == update_data["email"],
                Student.id != student_id,
            )
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A student with this email already exists",
            )

    if update_data.get("password"):
        student.password_hash = hash_password(update_data.pop("password"))
    else:
        update_data.pop("password", None)
    for field, value in update_data.items():
        setattr(student, field, value)
    if "branch" in update_data:
        student.department = update_data["branch"]

    await db.flush()
    await db.refresh(student)
    return _to_response(student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_admin),
):
    """Delete a student and all their data (face embeddings, attendance)."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await db.delete(student)
    await db.flush()
