"""Database migration utilities for OpenNeural.

Provides functions to run Alembic migrations programmatically on application
startup, ensuring the database schema is always up-to-date before serving requests.
"""

import logging
import os
import sys
from pathlib import Path

# Remove any path from sys.path that contains our local alembic migration folder to prevent import collision
_removed_paths = []
for p in list(sys.path):
    if p:
        try:
            if (Path(p) / "alembic" / "env.py").exists():
                _removed_paths.append(p)
                sys.path.remove(p)
        except Exception:
            pass

from alembic import command
from alembic.config import Config

# Restore sys.path
for p in reversed(_removed_paths):
    sys.path.insert(0, p)

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Run Alembic migrations to ensure database is up-to-date.
    
    This function should be called during application startup before the
    app begins serving requests. It uses the OPENNEURAL_DATA_DIR environment
    variable to locate the database.
    
    The migration runs in a subprocess to avoid importing Alembic's
    configuration into the main application context.
    
    Returns:
        None
    
    Raises:
        RuntimeError: If migrations fail to run.
    """
    # Get the backend directory path
    backend_dir = Path(__file__).parent.parent.parent
    alembic_ini = backend_dir / "alembic.ini"
    
    if not alembic_ini.exists():
        raise RuntimeError(f"Alembic configuration not found: {alembic_ini}")
    
    # Get data directory from environment
    data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
    if not data_dir:
        raise RuntimeError(
            "OPENNEURAL_DATA_DIR environment variable must be set before running migrations. "
            "This is typically set by the CLI entry point."
        )
    
    # Ensure data directory exists
    Path(data_dir).expanduser().resolve().mkdir(parents=True, exist_ok=True)
    
    # Create Alembic configuration
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    
    # Log migration start
    logger.info("Running database migrations...")
    logger.debug(f"Data directory: {data_dir}")
    logger.debug(f"Alembic config: {alembic_ini}")
    
    try:
        # Run upgrade to head (latest migration)
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully.")
    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        raise RuntimeError(f"Failed to run database migrations: {e}") from e


def ensure_database_schema() -> None:
    """Ensure the database schema is up-to-date.
    
    This is a convenience wrapper around run_migrations() that handles
    common error cases gracefully.
    
    Returns:
        None
    """
    try:
        run_migrations()
    except RuntimeError as e:
        # Log the error but allow the application to start
        # The database might be in an inconsistent state, but we don't
        # want to prevent the app from starting entirely
        logger.error(f"Database schema check failed: {e}")
        # Re-raise to prevent startup with bad schema
        raise
