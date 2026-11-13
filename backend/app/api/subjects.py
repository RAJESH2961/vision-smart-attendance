"""
Subject management API router.
Faculty/admins can create subjects in advance; they are used for attendance sessions and filtering.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_staff
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse, SubjectListResponse

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


def _to_response(s: Subject) -> SubjectResponse:
    return SubjectResponse(
        id=s.id,
        code=s.code,
        name=s.name,
        course=s.course,
        branch=s.branch,
        year=s.year,
        semester=s.semester,
        faculty_id=s.faculty_id,
        created_at=s.created_at.isoformat() if s.created_at else None,
    )


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    data: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """Create a new subject/course mapping."""
    existing = await db.execute(select(Subject).where(Subject.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Subject code already exists")

    subject = Subject(**data.model_dump(), faculty_id=current_user.id)
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return _to_response(subject)


@router.get("", response_model=SubjectListResponse)
async def list_subjects(
    course: str = Query(None),
    branch: str = Query(None),
    year: int = Query(None),
    semester: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    """List pre-configured subjects, optionally filtered by course/branch/year/semester."""
    query = select(Subject)
    count_query = select(func.count(Subject.id))

    filters = []
    if course:
        filters.append(Subject.course == course)
    if branch:
        filters.append(Subject.branch == branch)
    if year:
        filters.append(Subject.year == year)
    if semester:
        filters.append(Subject.semester == semester)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(Subject.year, Subject.branch, Subject.code).offset(offset).limit(page_size)
    )
    subjects = result.scalars().all()

    return SubjectListResponse(subjects=[_to_response(s) for s in subjects], total=total)


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _to_response(subject)


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    await db.flush()
    await db.refresh(subject)
    return _to_response(subject)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(require_staff),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.delete(subject)
    await db.flush()
