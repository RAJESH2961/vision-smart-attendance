"""
Smart Attendance System — FastAPI Application Entry Point.

Configures:
- CORS middleware
- Logging
- API routers
- Database initialization
- InsightFace model preloading
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables, get_db
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.faces import router as faces_router
from app.api.attendance import router as attendance_router
from app.api.reports import router as reports_router
from app.api.subjects import router as subjects_router

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 Starting Smart Attendance System...")

    # Create database tables (dev convenience — use Alembic in production)
    await create_tables()
    logger.info("✅ Database tables created/verified")

    # Backfill student portal passwords (default: roll number)
    try:
        from app.core.database import AsyncSessionLocal
        from app.core.security import hash_password
        from app.models.student import Student
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Student).where(Student.password_hash.is_(None)))
            students = result.scalars().all()
            for s in students:
                s.password_hash = hash_password(s.roll_number)
            if students:
                await db.commit()
                logger.info(f"✅ Backfilled portal passwords for {len(students)} student(s)")
    except Exception as e:
        logger.warning(f"⚠️ Student password backfill skipped: {e}")

    # Pre-load InsightFace model (optional — lazy loads on first use)
    try:
        from app.services.face_service import face_service
        face_service.initialize()
        logger.info("✅ InsightFace model loaded")
    except Exception as e:
        logger.warning(f"⚠️ InsightFace model not loaded (will lazy-load): {e}")

    yield

    logger.info("👋 Shutting down Smart Attendance System...")


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Attendance System",
    description="AI-powered classroom attendance using facial recognition",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(students_router)
app.include_router(faces_router)
app.include_router(attendance_router)
app.include_router(reports_router)
app.include_router(subjects_router)


# ── Health Check ──────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "healthy",
        "service": "Smart Attendance System",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


@app.get("/api/health/db", tags=["Health"])
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"database": "connected"}
    except Exception as e:
        return {"database": "disconnected", "error": str(e)}
