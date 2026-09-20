"""
Student model — represents a student enrolled in the institution.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    roll_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    section = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False)
    email = Column(String(150), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    face_registered = Column(Integer, default=0)  # Number of face embeddings registered
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships — lazy='noload' prevents auto-loading on list queries (avoid N+1)
    face_embeddings = relationship(
        "FaceEmbedding", back_populates="student", cascade="all, delete-orphan", lazy="noload"
    )
    attendances = relationship(
        "Attendance", back_populates="student", cascade="all, delete-orphan", lazy="noload"
    )

    def __repr__(self):
        return f"<Student(id={self.id}, roll='{self.roll_number}', name='{self.name}')>"
