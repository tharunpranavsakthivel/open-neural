"""Database module for OpenNeural backend.

Provides database engine, session management, ORM models, migrations,
initialization, transactions, and connection handling for the SQLite backend.

Exports:
    engine: The async SQLAlchemy engine instance.
    AsyncSession: AsyncSession class for type annotations.
    async_session: Factory function for creating AsyncSession instances.
    init_connection: Initialize database connection with PRAGMA settings.
    initialize_database: Full database initialization (dirs, migrations, WAL).
    ensure_data_directories: Create required data directories.
    apply_database_migrations: Apply Alembic migrations.
    verify_wal_mode: Verify SQLite WAL mode is active.
    atomic_transaction: Context manager for atomic database transactions.
    atomic_transaction_with_result: Transaction context with session persistence.
    atomic: Decorator to wrap functions in atomic transactions.
    service_method: Decorator for service class methods with transactions.
    with_transaction: Convenience function to execute operations in transactions.
    Base: Declarative base class for ORM models.
    SchemaMigration: Schema migration tracking model.
    Auth: Authentication model.
    Project: Project model.
    DatasetSnapshot: Dataset snapshot model.
    Pipeline: Preprocessing pipeline model.
    Experiment: ML experiment model.
    Run: Training run model.
    Evaluation: Evaluation results model.
    SubgroupAnalysis: Subgroup analysis model.
    Export: Export artifact model.
    run_migrations: Low-level migration execution function.
"""

from openneural_backend.db.engine import (
    AsyncSession,
    async_session,
    engine,
    init_connection,
)
from openneural_backend.db.init import (
    apply_database_migrations,
    ensure_data_directories,
    initialize_database,
    verify_wal_mode,
)
from openneural_backend.db.migrations import run_migrations
from openneural_backend.db.models import (
    Auth,
    Base,
    DatasetSnapshot,
    Evaluation,
    Experiment,
    Export,
    Pipeline,
    Project,
    Run,
    SchemaMigration,
    SubgroupAnalysis,
)
from openneural_backend.db.transaction import (
    atomic,
    atomic_transaction,
    atomic_transaction_with_result,
    service_method,
    with_transaction,
)

__all__ = [
    "engine",
    "AsyncSession",
    "async_session",
    "init_connection",
    "initialize_database",
    "ensure_data_directories",
    "apply_database_migrations",
    "verify_wal_mode",
    "atomic_transaction",
    "atomic_transaction_with_result",
    "atomic",
    "service_method",
    "with_transaction",
    "Base",
    "SchemaMigration",
    "Auth",
    "Project",
    "DatasetSnapshot",
    "Pipeline",
    "Experiment",
    "Run",
    "Evaluation",
    "SubgroupAnalysis",
    "Export",
    "run_migrations",
]
