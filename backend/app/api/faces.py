"""
Face registration API router.

Endpoints:
- POST /api/students/{id}/faces — Upload face images and generate embeddings
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.faculty import Faculty
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.services.face_service import face_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["Face Registration"])


@router.post("/{student_id}/faces", status_code=status.HTTP_201_CREATED)
async def register_faces(
    student_id: int,
    files: list[UploadFile] = File(..., description="Face images (JPEG/PNG)"),
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """
    Register a student's face by uploading multiple images.
    
    Accepts multipart/form-data with multiple image files.
    Extracts face embeddings using InsightFace and stores them in the database.
    """
    # Verify student exists
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image files provided",
        )

    # Read all image bytes
    images_bytes = []
    for file in files:
        content = await file.read()
        if content:
            images_bytes.append(content)

    if not images_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid image files found",
        )

    logger.info(f"Processing {len(images_bytes)} images for student {student_id}")

    # Extract embeddings using face service
    try:
        embeddings = face_service.register_faces(images_bytes)
    except Exception as e:
        logger.exception(f"Face embedding extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face embedding extraction failed: {str(e)}",
        )

    if not embeddings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No faces detected in the provided images. Please ensure the face is clearly visible.",
        )

    # Delete existing embeddings for this student (re-registration)
    existing = await db.execute(
        select(FaceEmbedding).where(FaceEmbedding.student_id == student_id)
    )
    for emb in existing.scalars().all():
        await db.delete(emb)

    # Store new embeddings
    stored_count = 0
    for embedding_list in embeddings:
        face_emb = FaceEmbedding(
            student_id=student_id,
            embedding=embedding_list,
        )
        db.add(face_emb)
        stored_count += 1

    # Update student's face_registered count
    student.face_registered = stored_count
    await db.flush()

    logger.info(f"Stored {stored_count} embeddings for student {student_id}")

    return {
        "message": "Face registration successful",
        "student_id": student_id,
        "embeddings_stored": stored_count,
        "images_processed": len(images_bytes),
    }


@router.get("/{student_id}/faces/status")
async def get_face_status(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Faculty = Depends(get_current_user),
):
    """Check if a student has registered face embeddings."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    embedding_count = await db.execute(
        select(FaceEmbedding).where(FaceEmbedding.student_id == student_id)
    )
    count = len(embedding_count.scalars().all())

    return {
        "student_id": student_id,
        "has_face": count > 0,
        "embedding_count": count,
    }
