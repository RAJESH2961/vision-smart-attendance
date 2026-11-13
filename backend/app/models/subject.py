"""
Subject model — courses/subjects configured in advance by faculty.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    course = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    faculty_id = Column(
        Integer,
        ForeignKey("faculties.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    faculty = relationship("Faculty", lazy="selectin")

    def __repr__(self):
        return f"<Subject(code='{self.code}', name='{self.name}')>"
