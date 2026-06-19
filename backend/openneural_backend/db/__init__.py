"""Database module for OpenNeural backend.

Provides database engine, session management, and connection handling
for the SQLite backend.

Exports:
    engine: The async SQLAlchemy engine instance.
    AsyncSession: AsyncSession class for type annotations.
    async_session: Factory function for creating AsyncSession instances.
    init_connection: Initialize database connection with PRAGMA settings.
"""

from openneural_backend.db.engine import (
    AsyncSession,
    async_session,
    engine,
    init_connection,
)

__all__ = [
    "engine",
    "AsyncSession",
    "async_session",
    "init_connection",
]
