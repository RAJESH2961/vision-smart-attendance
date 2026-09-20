"""
Async SQLAlchemy database engine, session factory, and base model.
Uses asyncpg driver for non-blocking PostgreSQL access.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# Create async engine — tuned for local dev
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # Local dev: smaller pool is fine; increase for production
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,         # Recycle connections every 5 min to avoid stale connections
    connect_args={"server_settings": {"application_name": "smart_attendance"}},
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
