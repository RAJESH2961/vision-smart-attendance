# Models package — import all models here for Alembic discovery
from app.models.faculty import Faculty
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.models.attendance_session import AttendanceSession
from app.models.attendance import Attendance

__all__ = [
    "Faculty",
    "Student",
    "FaceEmbedding",
    "AttendanceSession",
    "Attendance",
]
