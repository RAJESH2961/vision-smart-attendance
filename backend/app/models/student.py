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
    department = Column(String(100), nullable=False)  # Legacy field, mirrors branch
    branch = Column(String(100), nullable=True, index=True)  # CSE, ECE, CSM, AIML, etc.
    section = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False)
    course = Column(String(100), nullable=True)  # B.Tech, M.Tech, MBA, MCA...
    batch = Column(String(20), nullable=True)   # e.g. 2021-2025
    gender = Column(String(20), nullable=True)
    email = Column(String(150), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    face_registered = Column(Integer, default=0)  # Number of face embeddings registered
    password_hash = Column(String(255), nullable=True)  # Student portal login
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
