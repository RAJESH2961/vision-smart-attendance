"""
Async SQLAlchemy database engine, session factory, and base model.
Uses asyncpg driver for non-blocking PostgreSQL access.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# Create async engine — tuned for local dev
# server_settings is only valid for the asyncpg driver
_connect_args = (
    {"server_settings": {"application_name": "smart_attendance"}}
    if "asyncpg" in settings.DATABASE_URL
    else {}
)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # Local dev: smaller pool is fine; increase for production
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,         # Recycle connections every 5 min to avoid stale connections
    connect_args=_connect_args,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy models."""
    pass


async def get_db():
    """
    FastAPI dependency that provides an async database session.
    Automatically closes the session when the request completes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables. Used for development; prefer Alembic for production."""
    import app.models  # noqa: F401 - ensures all models are registered on Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_lightweight_migrations)


def _apply_lightweight_migrations(conn):
    """
    Add columns introduced after initial schema (create_all won't ALTER tables).
    Works on both PostgreSQL and SQLite.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(conn)
    new_columns = {
        "students": {
            "branch": "VARCHAR(100)",
            "password_hash": "VARCHAR(255)",
            "course": "VARCHAR(100)",
            "batch": "VARCHAR(20)",
            "gender": "VARCHAR(20)",
        },
        "faculties": {"role": "VARCHAR(20) DEFAULT 'faculty'"},
        "attendance_sessions": {
            "year": "INTEGER",
            "branch": "VARCHAR(100)",
            "total_students": "INTEGER DEFAULT 0",
        },
    }

    for table, cols in new_columns.items():
        if not inspector.has_table(table):
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        for col, ddl in cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))

    # Backfill branch from legacy department column
    if inspector.has_table("students"):
        cols = {c["name"] for c in inspector.get_columns("students")}
        if "branch" in cols and "department" in cols:
            conn.execute(
                text("UPDATE students SET branch = department WHERE branch IS NULL")
            )

    # Backfill roles: default 'faculty', promote the first account to admin
    if inspector.has_table("faculties"):
        cols = {c["name"] for c in inspector.get_columns("faculties")}
        if "role" in cols:
            conn.execute(text("UPDATE faculties SET role = 'faculty' WHERE role IS NULL"))
            conn.execute(text(
                "UPDATE faculties SET role = 'admin' "
                "WHERE id = (SELECT MIN(id) FROM faculties)"
            ))
