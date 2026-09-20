"""
Faculty model — represents a teacher/professor who uses the attendance system.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Faculty(Base):
    __tablename__ = "faculties"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    attendance_sessions = relationship(
        "AttendanceSession", back_populates="faculty", lazy="selectin"
    )

    def __repr__(self):
        return f"<Faculty(id={self.id}, name='{self.name}', email='{self.email}')>"
