"""
FaceEmbedding model — stores facial recognition embeddings for each student.
Embeddings are 512-dimensional vectors from InsightFace stored as JSON arrays.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 512-dim embedding vector stored as JSON array of floats
    embedding = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    student = relationship("Student", back_populates="face_embeddings")

    def __repr__(self):
        return f"<FaceEmbedding(id={self.id}, student_id={self.student_id})>"
