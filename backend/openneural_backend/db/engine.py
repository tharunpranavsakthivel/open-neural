"""Database engine configuration for OpenNeural backend.

Provides SQLAlchemy 2.0 async engine and session factory for SQLite database
operations. Configures WAL mode and foreign key constraints on every connection.

Exports:
    engine: The async SQLAlchemy engine instance.
    AsyncSession: AsyncSession class for type annotations.
    async_session: Factory function for creating AsyncSession instances.
    init_connection: Initialize database with PRAGMA settings.
"""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from openneural_backend.config import get_settings


def _get_db_url() -> str:
    """Build the SQLite async database URL from settings.

    Returns:
        str: SQLite+aiosqlite URL pointing to the configured database path.
    """
    settings = get_settings()
    # Use aiosqlite driver for async support
    return f"sqlite+aiosqlite:///{settings.db_path}"


# Create the async engine with connection initialization
engine = create_async_engine(
    _get_db_url(),
    echo=False,
    poolclass=NullPool,  # SQLite doesn't play well with connection pooling
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(conn, _connection_record) -> None:
    """Execute SQLite PRAGMA statements on every new connection.

    Sets:
        - journal_mode=WAL: Enables Write-Ahead Logging for better concurrency
            and prevents database corruption on crashes.
        - foreign_keys=ON: Enforces referential integrity via foreign key
            constraints across all tables.

    This listener is called synchronously on each new connection, which is
    safe for SQLite since PRAGMA statements are lightweight.

    Args:
        conn: The raw database connection (aiosqlite.Connection).
        _connection_record: Internal SQLAlchemy connection record (unused).
    """
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")


# Create async session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_connection() -> None:
    """Initialize database connection with required PRAGMA settings.

    This function should be called during application startup to ensure
    the first connection establishes the WAL mode and foreign key settings.
    The event listener ensures these are set on every subsequent connection.

    Returns:
        None
    """
    async with engine.connect() as conn:
        # Execute a simple query to trigger the connect event
        await conn.execute("SELECT 1")


__all__ = [
    "engine",
    "AsyncSession",
    "async_session",
    "init_connection",
]
