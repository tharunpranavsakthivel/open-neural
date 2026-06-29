"""Alembic environment configuration for OpenNeural backend.

Configures Alembic to work with the OpenNeural async SQLAlchemy setup,
using the runtime DATA_DIR path from the Settings configuration.
"""

import asyncio
import os
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add the parent directory to sys.path to import the backend module
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the Base metadata and models
from openneural_backend.db.models import Base
from openneural_backend.config import Settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_database_url() -> str:
    """Construct the database URL from runtime settings.
    
    Uses the OPENNEURAL_DATA_DIR environment variable to determine
    the SQLite database path. This ensures migrations run against
    the same database as the application.
    
    Returns:
        str: SQLAlchemy database URL for SQLite.
    """
    # Get data directory from environment or use default
    data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
    
    if data_dir:
        # Use the provided data directory
        db_path = Path(data_dir).expanduser().resolve() / "openneural.db"
    else:
        # Default fallback - use ~/.openneural for standalone migration runs
        db_path = Path.home() / ".openneural" / "openneural.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Return SQLite URL (synchronous version for Alembic)
    return f"sqlite:///{db_path}"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.
    
    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    
    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Enable foreign key support for SQLite
        render_as_batch=True,  # Required for SQLite ALTER operations
    )

    with context.begin_transaction():
        # Enable foreign keys for SQLite
        context.execute("PRAGMA foreign_keys=ON")
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations with the provided connection.
    
    Args:
        connection: SQLAlchemy connection to use for migrations.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Enable foreign key support for SQLite
        render_as_batch=True,  # Required for SQLite ALTER operations
    )

    with context.begin_transaction():
        # Enable foreign keys for SQLite
        context.execute("PRAGMA foreign_keys=ON")
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using async engine.
    
    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    # Get database URL and convert to async driver version
    url = get_database_url().replace("sqlite:///", "sqlite+aiosqlite:///")
    
    # Create async engine
    async_engine = async_engine_from_config(
        {"sqlalchemy.url": url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with async_engine.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await async_engine.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.
    
    For OpenNeural, we use the async migration path to match
    the application's async database setup.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, run_async_migrations())
            future.result()
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
