"""Database module for OpenNeural backend.

Provides database engine, session management, ORM models, migrations, and
connection handling for the SQLite backend.

Exports:
    engine: The async SQLAlchemy engine instance.
    AsyncSession: AsyncSession class for type annotations.
    async_session: Factory function for creating AsyncSession instances.
    init_connection: Initialize database connection with PRAGMA settings.
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
    ensure_database_schema: Run database migrations on startup.
    run_migrations: Low-level migration execution function.
"""

from openneural_backend.db.engine import (
    AsyncSession,
    async_session,
    engine,
    init_connection,
)
from openneural_backend.db.migrations import (
    ensure_database_schema,
    run_migrations,
)
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

__all__ = [
    "engine",
    "AsyncSession",
    "async_session",
    "init_connection",
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
    "ensure_database_schema",
    "run_migrations",
]
