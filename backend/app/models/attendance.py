"""
Attendance model — individual attendance record for a student in a session.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("attendance_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), default="present")  # present, absent, late
    confidence = Column(Float, nullable=True)  # Recognition confidence score (0-1)
    recognized_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    session = relationship("AttendanceSession", back_populates="attendances")
    student = relationship("Student", back_populates="attendances")

    def __repr__(self):
        return f"<Attendance(id={self.id}, student_id={self.student_id}, status='{self.status}')>"
