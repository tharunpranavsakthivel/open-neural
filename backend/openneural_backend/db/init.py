"""Database initialization module for OpenNeural backend.

Called on application startup to ensure the data directory structure
exists, database schema is migrated, and SQLite is properly configured.
"""

import logging
from collections.abc import Sequence
from pathlib import Path

import aiosqlite

from openneural_backend.config import Settings
from openneural_backend.db.migrations import run_migrations

logger = logging.getLogger(__name__)


# Required subdirectories within the data directory
REQUIRED_SUBDIRECTORIES: Sequence[str] = [
    "snapshots",
    "pipelines",
    "experiments",
    "exports",
    "logs",
]


async def ensure_data_directories(data_dir: Path | None = None) -> None:
    """Ensure the data directory and all required subdirectories exist.

    Creates the data directory and all subdirectories if they don't exist.
    This is safe to call multiple times - it uses exist_ok=True.

    Args:
        data_dir: Path to the data directory. If None, uses the path from
            Settings.get().data_dir.

    Returns:
        None

    Raises:
        RuntimeError: If unable to create any directory.
    """
    if data_dir is None:
        settings = Settings.get()
        data_dir = settings.data_dir

    logger.info(f"Ensuring data directories exist at: {data_dir}")

    # Create root data directory
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created/verified root data directory: {data_dir}")
    except OSError as e:
        raise RuntimeError(f"Failed to create data directory {data_dir}: {e}") from e

    # Create all required subdirectories
    for subdir_name in REQUIRED_SUBDIRECTORIES:
        subdir_path = data_dir / subdir_name
        try:
            subdir_path.mkdir(parents=True, exist_ok=True)
            logger.debug(f"Created/verified subdirectory: {subdir_path}")
        except OSError as e:
            raise RuntimeError(
                f"Failed to create subdirectory {subdir_path}: {e}"
            ) from e

    logger.info("All data directories verified.")


async def apply_database_migrations() -> None:
    """Apply pending Alembic database migrations.

    Runs 'alembic upgrade head' to ensure the database schema is up-to-date.
    This function is async but runs the synchronous Alembic command in a
    thread pool to avoid blocking the event loop.

    Returns:
        None

    Raises:
        RuntimeError: If migrations fail to apply.
    """
    logger.info("Applying database migrations...")
    try:
        # run_migrations is synchronous, but we can call it directly
        # since this is already an async function and FastAPI will handle it
        run_migrations()
        logger.info("Database migrations applied successfully.")
    except Exception as e:
        logger.error(f"Failed to apply database migrations: {e}")
        raise RuntimeError(f"Database migration failed: {e}") from e


async def verify_wal_mode(db_path: Path | None = None) -> None:
    """Verify that SQLite WAL mode is active.

    Checks the database's journal_mode pragma to ensure WAL is enabled.
    WAL mode is required for proper concurrency and crash recovery.

    Args:
        db_path: Path to the SQLite database file. If None, uses the path from
            Settings.get().db_path.

    Returns:
        None

    Raises:
        RuntimeError: If WAL mode is not active or database cannot be accessed.
    """
    if db_path is None:
        settings = Settings.get()
        db_path = settings.db_path

    logger.info(f"Verifying WAL mode for database: {db_path}")

    # Check if database file exists
    if not db_path.exists():
        # Database doesn't exist yet, which is fine - it will be created
        # with WAL mode when the first connection is made
        logger.info("Database file does not exist yet, skipping WAL verification.")
        return

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            # Check current journal mode
            async with db.execute("PRAGMA journal_mode") as cursor:
                row = await cursor.fetchone()
                if row is None:
                    raise RuntimeError("Failed to query journal_mode pragma")
                current_mode = row[0].upper()

            if current_mode != "WAL":
                # Try to enable WAL mode
                logger.warning(
                    f"Journal mode is '{current_mode}', expected 'WAL'. Enabling WAL..."
                )
                async with db.execute("PRAGMA journal_mode=WAL") as cursor:
                    row = await cursor.fetchone()
                    if row is None:
                        raise RuntimeError("Failed to set journal_mode to WAL")
                    new_mode = row[0].upper()
                    if new_mode != "WAL":
                        raise RuntimeError(
                            f"Failed to enable WAL mode. Current mode: {new_mode}"
                        )
                logger.info("WAL mode enabled successfully.")
            else:
                logger.debug("WAL mode is already active.")

            # Also verify foreign keys are enabled (best practice check)
            async with db.execute("PRAGMA foreign_keys") as cursor:
                row = await cursor.fetchone()
                if row and row[0] == 1:
                    logger.debug("Foreign key constraints are enabled.")
                else:
                    logger.warning("Foreign key constraints may not be enabled.")

    except aiosqlite.Error as e:
        raise RuntimeError(f"Database error while verifying WAL mode: {e}") from e

    logger.info("WAL mode verification complete.")


async def initialize_database() -> None:
    """Initialize the OpenNeural database on application startup.

    Performs all required startup initialization:
    1. Ensures data directory structure exists
    2. Applies pending Alembic migrations
    3. Verifies WAL mode is active

    This function should be called once during application startup,
    before any database operations are performed.

    Returns:
        None

    Raises:
        RuntimeError: If any initialization step fails.
    """
    logger.info("Initializing OpenNeural database...")

    # Step 1: Ensure directories exist
    await ensure_data_directories()

    # Step 2: Apply database migrations
    await apply_database_migrations()

    # Step 3: Verify WAL mode
    await verify_wal_mode()

    logger.info("Database initialization complete.")


def initialize_database_sync() -> None:
    """Synchronous wrapper for database initialization.

    This is a convenience function for contexts where async/await
    cannot be used directly (e.g., in some startup scripts).

    Returns:
        None

    Raises:
        RuntimeError: If initialization fails.
    """
    import asyncio

    try:
        asyncio.run(initialize_database())
    except RuntimeError as e:
        logger.error(f"Database initialization failed: {e}")
        raise
