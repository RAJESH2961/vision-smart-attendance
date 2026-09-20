"""
AttendanceSession model — represents a single attendance-taking session.
A session is created when a faculty starts attendance, and closed when it ends.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    faculty_id = Column(
        Integer,
        ForeignKey("faculties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject = Column(String(100), nullable=False)
    classroom = Column(String(50), nullable=False)
    section = Column(String(10), nullable=False)
    duration = Column(Integer, default=20)  # Duration in seconds
    start_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default=SessionStatus.PENDING.value)
    total_recognized = Column(Integer, default=0)
    total_unknown = Column(Integer, default=0)

    # Relationships
    faculty = relationship("Faculty", back_populates="attendance_sessions")
    attendances = relationship(
        "Attendance", back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self):
        return f"<AttendanceSession(id={self.id}, subject='{self.subject}', status='{self.status}')>"
