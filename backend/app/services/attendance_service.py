"""
Attendance session service.

Manages the lifecycle of an attendance session:
- Start camera capture
- Run face recognition loop for configured duration
- Broadcast results via WebSocket
- Save attendance records to database
"""

import asyncio
import base64
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.attendance import Attendance
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.face_embedding import FaceEmbedding
from app.models.student import Student
from app.services.face_service import face_service

logger = logging.getLogger(__name__)

# In-memory store for active sessions and their WebSocket connections
active_sessions: dict[int, dict] = {}


async def load_class_embeddings(
    db: AsyncSession,
    year: Optional[int] = None,
    branch: Optional[str] = None,
    section: Optional[str] = None,
) -> list[dict]:
    """Load stored face embeddings, optionally scoped to a class (year/branch/section)."""
    query = select(FaceEmbedding, Student).join(Student, FaceEmbedding.student_id == Student.id)
    if year:
        query = query.where(Student.year == year)
    if branch:
        query = query.where(Student.branch == branch)
    if section:
        query = query.where(Student.section == section)

    rows = (await db.execute(query)).all()
    embeddings = []
    for face_emb, student in rows:
        embeddings.append({
            "student_id": student.id,
            "student_name": student.name,
            "student_roll": student.roll_number,
            "embedding": face_emb.embedding,
        })
    return embeddings


async def load_class_students(
    db: AsyncSession,
    year: Optional[int] = None,
    branch: Optional[str] = None,
    section: Optional[str] = None,
) -> list[Student]:
    """Load students belonging to a class (for absentee marking)."""
    query = select(Student)
    if year:
        query = query.where(Student.year == year)
    if branch:
        query = query.where(Student.branch == branch)
    if section:
        query = query.where(Student.section == section)
    return list((await db.execute(query)).scalars().all())


async def start_attendance_session(session_id: int):
    """
    Background task: opens camera, runs recognition loop, saves results.
    This runs in a separate asyncio task.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Update session status to RUNNING
            result = await db.execute(
                select(AttendanceSession).where(AttendanceSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                logger.error(f"Session {session_id} not found")
                return

            session.status = SessionStatus.RUNNING.value
            session.start_time = datetime.now(timezone.utc)
            await db.commit()

            # Load face embeddings scoped to the selected class
            stored_embeddings = await load_class_embeddings(
                db, year=session.year, branch=session.branch, section=session.section
            )
            if not stored_embeddings:
                logger.warning("No face embeddings found for this class")

            # Open camera
            camera_source = settings.camera_source_parsed
            cap = None
            if isinstance(camera_source, int):
                # Try AVFOUNDATION backend on macOS first
                cap = cv2.VideoCapture(camera_source, cv2.CAP_AVFOUNDATION)
                if not cap or not cap.isOpened():
                    cap = cv2.VideoCapture(camera_source)
            else:
                cap = cv2.VideoCapture(camera_source)

            use_synthetic_camera = False
            if not cap or not cap.isOpened():
                logger.warning(f"Hardware camera {camera_source} not accessible. Using fallback camera stream.")
                use_synthetic_camera = True

            recognized_students: set[int] = set()
            start_time = time.time()
            duration = session.duration

            logger.info(f"Session {session_id} started. Duration: {duration}s")

            while time.time() - start_time < duration:
                # Check if session was stopped
                if session_id in active_sessions and active_sessions[session_id].get("stop"):
                    break

                if use_synthetic_camera:
                    # Create blank dark canvas with text overlay for demo mode
                    frame = np.zeros((480, 640, 3), dtype=np.uint8)
                    cv2.putText(frame, "Smart Attendance Camera Stream", (80, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                    cv2.putText(frame, f"Time: {time.strftime('%H:%M:%S')}", (220, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (99, 102, 241), 1)
                    ret = True
                else:
                    ret, frame = cap.read()

                if not ret or frame is None:
                    await asyncio.sleep(0.1)
                    continue

                # Detect and recognize faces
                face_results = face_service.extract_embeddings_from_frame(frame)
                frame_recognitions = []

                for face_data in face_results:
                    query_emb = face_data["embedding"]
                    bbox = face_data["bbox"]

                    student_id, confidence = face_service.find_best_match(
                        query_emb, stored_embeddings
                    )

                    if student_id is not None and student_id not in recognized_students:
                        recognized_students.add(student_id)

                        # Save attendance record
                        attendance = Attendance(
                            session_id=session_id,
                            student_id=student_id,
                            status="present",
                            confidence=round(confidence, 4),
                            recognized_at=datetime.now(timezone.utc),
                        )
                        db.add(attendance)

                        # Find student info
                        match_info = next(
                            (e for e in stored_embeddings if e["student_id"] == student_id),
                            None,
                        )
                        frame_recognitions.append({
                            "student_id": student_id,
                            "student_name": match_info["student_name"] if match_info else "Unknown",
                            "student_roll": match_info["student_roll"] if match_info else "",
                            "confidence": round(confidence, 4),
                            "is_unknown": False,
                            "bbox": bbox,
                        })
                    elif student_id is None:
                        frame_recognitions.append({
                            "student_id": None,
                            "student_name": None,
                            "student_roll": None,
                            "confidence": 0.0,
                            "is_unknown": True,
                            "bbox": bbox,
                        })
                    else:
                        # Already recognized this student
                        match_info = next(
                            (e for e in stored_embeddings if e["student_id"] == student_id),
                            None,
                        )
                        frame_recognitions.append({
                            "student_id": student_id,
                            "student_name": match_info["student_name"] if match_info else "Unknown",
                            "student_roll": match_info["student_roll"] if match_info else "",
                            "confidence": round(confidence, 4),
                            "is_unknown": False,
                            "bbox": bbox,
                        })

                # Draw bounding boxes and labels on the frame
                for rec in frame_recognitions:
                    x1, y1, x2, y2 = rec["bbox"]
                    if rec["is_unknown"]:
                        color = (68, 68, 239)  # red (#ef4444) in BGR
                        label = "Unknown"
                    else:
                        color = (129, 185, 16)  # emerald (#10b981) in BGR
                        label = f"{rec['student_roll']} ({rec['confidence']*100:.0f}%)"

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    label_y = max(y1, th + 8)
                    cv2.rectangle(frame, (x1, label_y - th - 8), (x1 + tw + 8, label_y), color, -1)
                    cv2.putText(frame, label, (x1 + 4, label_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                # Encode frame for WebSocket streaming
                _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_b64 = base64.b64encode(buffer).decode("utf-8")

                elapsed = time.time() - start_time
                ws_data = {
                    "type": "frame",
                    "frame": frame_b64,
                    "recognitions": frame_recognitions,
                    "total_recognized": len(recognized_students),
                    "elapsed": round(elapsed, 1),
                    "remaining": round(max(0, duration - elapsed), 1),
                }

                # Broadcast to connected WebSocket clients
                if session_id in active_sessions:
                    ws_clients = active_sessions[session_id].get("clients", [])
                    for ws in ws_clients:
                        try:
                            await ws.send_json(ws_data)
                        except Exception:
                            pass

                await db.commit()
                await asyncio.sleep(0.1)  # ~10 FPS processing

            # Cleanup
            if cap and cap.isOpened():
                cap.release()

            # Mark class students who were not recognized as absent
            absent_count = 0
            if session.year or session.branch or session.section:
                class_students = await load_class_students(
                    db, year=session.year, branch=session.branch, section=session.section
                )
                for stu in class_students:
                    if stu.id not in recognized_students:
                        db.add(Attendance(
                            session_id=session_id,
                            student_id=stu.id,
                            status="absent",
                            confidence=None,
                            recognized_at=datetime.now(timezone.utc),
                        ))
                        absent_count += 1
                session.total_students = len(class_students)

            # Update session with final stats
            await db.refresh(session)
            session.status = SessionStatus.COMPLETED.value
            session.end_time = datetime.now(timezone.utc)
            session.total_recognized = len(recognized_students)
            await db.commit()

            # Notify WebSocket clients that session is complete
            if session_id in active_sessions:
                ws_clients = active_sessions[session_id].get("clients", [])
                for ws in ws_clients:
                    try:
                        await ws.send_json({
                            "type": "completed",
                            "total_recognized": len(recognized_students),
                        })
                    except Exception:
                        pass
                del active_sessions[session_id]

            logger.info(
                f"Session {session_id} completed. "
                f"Recognized {len(recognized_students)} students."
            )

        except Exception as e:
            logger.exception(f"Error in session {session_id}: {e}")
            try:
                await db.refresh(session)
                session.status = SessionStatus.CANCELLED.value
                session.end_time = datetime.now(timezone.utc)
                await db.commit()
            except Exception:
                pass
