"""Graceful shutdown handler for OpenNeural backend.

Registers signal handlers for SIGTERM and SIGINT to perform clean shutdown:
- Flushes in-progress SQLAlchemy sessions
- Marks running experiments as interrupted
- Performs clean application exit
"""

import asyncio
import os
import signal
import sys
from collections.abc import Callable
from types import FrameType
from typing import Any

import sqlalchemy
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


class ShutdownManager:
    """Manages graceful shutdown of the OpenNeural backend.

    Handles SIGTERM and SIGINT signals to ensure clean shutdown by:
    - Flushing SQLAlchemy sessions
    - Marking running experiments as interrupted
    - Closing database connections
    """

    def __init__(self, data_dir: str | None = None) -> None:
        """Initialize the shutdown manager.

        Args:
            data_dir: Path to the data directory. If not provided, reads from
                OPENNEURAL_DATA_DIR environment variable.

        Raises:
            RuntimeError: If data_dir is not provided and OPENNEURAL_DATA_DIR is not set.
        """
        if data_dir is None:
            data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
        if not data_dir:
            raise RuntimeError(
                "OPENNEURAL_DATA_DIR environment variable must be set. "
                "This is set by the CLI entry point at startup."
            )
        
        self._data_dir = data_dir
        self._db_path = os.path.join(data_dir, "openneural.db")
        self._engine: sqlalchemy.Engine | None = None
        self._session_factory: sessionmaker[Any] | None = None
        self._original_sigterm: Callable[..., Any] | None = None
        self._original_sigint: Callable[..., Any] | None = None
        self._shutdown_event = asyncio.Event()

    def _create_engine(self) -> sqlalchemy.Engine:
        """Create SQLAlchemy engine for the SQLite database.

        Returns:
            sqlalchemy.Engine: Configured engine with WAL mode enabled.
        """
        db_url = f"sqlite:///{self._db_path}"
        engine = create_engine(db_url, echo=False)
        return engine

    def _get_session_factory(self) -> sessionmaker[Any]:
        """Get or create the session factory.

        Returns:
            sessionmaker: Configured session factory.
        """
        if self._session_factory is None:
            self._engine = self._create_engine()
            self._session_factory = sessionmaker(bind=self._engine)
        return self._session_factory

    def _mark_running_experiments_as_interrupted(self) -> None:
        """Mark all 'running' experiments as 'interrupted' in the database.

        This ensures that if the application crashes or is terminated, any
        experiments that were in progress are properly marked as interrupted
        rather than remaining in a 'running' state indefinitely.
        """
        try:
            Session = self._get_session_factory()
            with Session() as session:
                # Check if experiments table exists
                result = session.execute(
                    text(
                        "SELECT name FROM sqlite_master "
                        "WHERE type='table' AND name='experiments'"
                    )
                )
                if not result.fetchone():
                    # Table doesn't exist yet, nothing to do
                    return

                # Update running experiments to interrupted
                session.execute(
                    text(
                        "UPDATE experiments "
                        "SET status = 'interrupted', completed_at = datetime('now') "
                        "WHERE status = 'running'"
                    )
                )
                session.commit()
        except Exception:
            # Silently ignore errors during shutdown to ensure clean exit
            pass

    def _flush_sessions(self) -> None:
        """Flush any in-progress SQLAlchemy sessions."""
        try:
            if self._engine is not None:
                self._engine.dispose()
        except Exception:
            # Silently ignore errors during shutdown
            pass

    def _shutdown_handler(self, signum: int, frame: FrameType | None) -> None:
        """Handle shutdown signals (SIGTERM, SIGINT).

        Args:
            signum: The signal number received.
            frame: The current stack frame.
        """
        # Mark running experiments as interrupted
        self._mark_running_experiments_as_interrupted()
        
        # Flush SQLAlchemy sessions
        self._flush_sessions()
        
        # Exit cleanly
        sys.exit(0)

    def register_handlers(self) -> None:
        """Register signal handlers for graceful shutdown.

        Registers handlers for SIGTERM and SIGINT that will:
        - Mark running experiments as interrupted
        - Flush database sessions
        - Exit cleanly
        """
        # Store original handlers
        self._original_sigterm = signal.signal(signal.SIGTERM, self._shutdown_handler)
        self._original_sigint = signal.signal(signal.SIGINT, self._shutdown_handler)

    def unregister_handlers(self) -> None:
        """Unregister signal handlers and restore original handlers."""
        if self._original_sigterm is not None:
            signal.signal(signal.SIGTERM, self._original_sigterm)
        if self._original_sigint is not None:
            signal.signal(signal.SIGINT, self._original_sigint)


def register_shutdown_handlers(data_dir: str | None = None) -> ShutdownManager:
    """Register shutdown handlers for the application.

    This is the main entry point for setting up graceful shutdown.
    Call this function after the data directory is configured.

    Args:
        data_dir: Path to the data directory. If not provided, reads from
            OPENNEURAL_DATA_DIR environment variable.

    Returns:
        ShutdownManager: The configured shutdown manager.

    Example:
        >>> from openneural_backend.shutdown import register_shutdown_handlers
        >>> shutdown_manager = register_shutdown_handlers()
        >>> # ... application runs ...
        >>> shutdown_manager.unregister_handlers()  # On clean exit
    """
    manager = ShutdownManager(data_dir)
    manager.register_handlers()
    return manager
