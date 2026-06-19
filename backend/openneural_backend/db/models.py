"""SQLAlchemy ORM models for OpenNeural backend.

Defines all database models matching the TDD schema specifications.
All models use declarative base and support async operations.
"""

import uuid
from datetime import datetime
from typing import Literal, Optional

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Real,
    Text,
    func,
    event,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from openneural_backend.db.engine import engine


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


# =============================================================================
# Schema Migration Model
# =============================================================================


class SchemaMigration(Base):
    """Tracks applied database schema migrations.

    Used by Alembic to track which migrations have been applied to the database.
    Ensures schema versioning and enables safe database upgrades.

    Attributes:
        version: Migration version identifier (primary key).
        applied_at: UTC timestamp when the migration was applied.
    """

    __tablename__ = "schema_migrations"

    version: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        doc="Migration version identifier",
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        doc="UTC timestamp when migration was applied",
    )


# =============================================================================
# Auth Model
# =============================================================================


class Auth(Base):
    """Local authentication credentials for the application.

    Stores a single bcrypt-hashed password for the local application session.
    OpenNeural MVP is single-user, single-machine; this table holds the
    one password hash needed to unlock the app.

    Attributes:
        id: UUID primary key.
        password_hash: Bcrypt-hashed password (cost factor 12+).
        created_at: Timestamp when the auth record was created.
        updated_at: Timestamp when the auth record was last modified.
    """

    __tablename__ = "auth"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="UUID primary key",
    )
    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Bcrypt hash of the local password (cost factor 12+)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        doc="Timestamp when record was created",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        doc="Timestamp when record was last updated",
    )


# Register event listener for updated_at trigger
@event.listens_for(Auth, "before_update")
def _set_auth_updated_at(mapper, connection, target):
    """Auto-update the updated_at timestamp on Auth update."""
    target.updated_at = datetime.utcnow()


# =============================================================================
# Project Model
# =============================================================================


class Project(Base):
    """Represents an ML project with associated task type.

    A project groups together experiments, snapshots, and pipelines
    for a specific machine learning task.

    Attributes:
        id: UUID primary key (TEXT).
        name: Project name (TEXT NOT NULL).
        task_type: Type of ML task - either 'classification' or 'regression'.
        created_at: Timestamp when project was created.
        updated_at: Timestamp when project was last modified (auto-updates).
    """

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    task_type: Mapped[Literal["classification", "regression"]] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    snapshots: Mapped[list["DatasetSnapshot"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    pipelines: Mapped[list["Pipeline"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    experiments: Mapped[list["Experiment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "task_type IN ('classification', 'regression')",
            name="ck_project_task_type",
        ),
    )


# Register event listener for updated_at trigger
@event.listens_for(Project, "before_update")
def _set_project_updated_at(mapper, connection, target):
    """Auto-update the updated_at timestamp on Project update."""
    target.updated_at = datetime.utcnow()


# =============================================================================
# DatasetSnapshot Model
# =============================================================================


class DatasetSnapshot(Base):
    """Immutable, versioned dataset snapshot for reproducibility.

    Stores metadata about an imported dataset including schema inference,
    checksums, and file references. Snapshots are immutable and bound to
    a specific project.

    Attributes:
        id: UUID primary key.
        project_id: Foreign key to the parent project.
        version_label: Monotonically incrementing label (e.g., "Snapshot v1").
        original_path: Original file path provided by user.
        stored_path: Path within OpenNeural's managed storage.
        file_name: Original file name.
        file_size_bytes: File size in bytes.
        row_count: Number of rows in the dataset.
        col_count: Number of columns in the dataset.
        schema_json: JSON string containing inferred schema.
        checksum_sha256: SHA-256 checksum for integrity verification.
        created_at: Timestamp when snapshot was created.
    """

    __tablename__ = "dataset_snapshots"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_label: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    original_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    stored_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    row_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    col_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    schema_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    checksum_sha256: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="snapshots")
    pipelines: Mapped[list["Pipeline"]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id", "version_label",
            name="uq_snapshot_project_version",
        ),
    )


# =============================================================================
# Pipeline Model
# =============================================================================


class Pipeline(Base):
    """Preprocessing pipeline configuration for a dataset snapshot.

    Stores the ordered sequence of preprocessing blocks as JSON, along with
    validation status and metadata.

    Attributes:
        id: UUID primary key.
        project_id: Foreign key to the parent project.
        snapshot_id: Foreign key to the bound dataset snapshot.
        name: Optional human-readable pipeline name.
        config_json: JSON-serialized pipeline configuration.
        validated: Boolean flag indicating if pipeline passed validation.
        created_at: Timestamp when pipeline was created.
    """

    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    snapshot_id: Mapped[str] = mapped_column(
        ForeignKey("dataset_snapshots.id"),
        nullable=False,
    )
    name: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    config_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    validated: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="pipelines")
    snapshot: Mapped["DatasetSnapshot"] = relationship(back_populates="pipelines")
    experiments: Mapped[list["Experiment"]] = relationship(
        back_populates="pipeline",
        cascade="all, delete-orphan",
    )


# =============================================================================
# Experiment Model
# =============================================================================


class Experiment(Base):
    """ML experiment containing multiple training runs.

    An experiment groups together all runs for a specific pipeline configuration,
    including AutoML search results. Each experiment tracks its status and
    links to all associated runs.

    Attributes:
        id: UUID primary key.
        project_id: Foreign key to the parent project.
        pipeline_id: Foreign key to the pipeline configuration used.
        experiment_id_human: Human-readable ID (e.g., "exp_cxp8_1015").
        automl_enabled: Whether AutoML was enabled for this experiment.
        optimize_metric: Metric optimized during training (e.g., "f1").
        automl_config_json: JSON-serialized AutoML configuration.
        candidate_models: Comma-separated list of candidate model types.
        status: Current experiment status (created, running, done, cancelled, interrupted).
        created_at: Timestamp when experiment was created.
        started_at: Timestamp when training started (nullable).
        completed_at: Timestamp when training completed (nullable).
    """

    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    pipeline_id: Mapped[str] = mapped_column(
        ForeignKey("pipelines.id"),
        nullable=False,
    )
    experiment_id_human: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )
    automl_enabled: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    optimize_metric: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    automl_config_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    candidate_models: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[Literal["created", "running", "done", "cancelled", "interrupted"]] = mapped_column(
        Text,
        nullable=False,
        default="created",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="experiments")
    pipeline: Mapped["Pipeline"] = relationship(back_populates="experiments")
    runs: Mapped[list["Run"]] = relationship(
        back_populates="experiment",
        cascade="all, delete-orphan",
    )
    exports: Mapped[list["Export"]] = relationship(
        back_populates="experiment",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'running', 'done', 'cancelled', 'interrupted')",
            name="ck_experiment_status",
        ),
    )


# =============================================================================
# Run Model
# =============================================================================


class Run(Base):
    """Single model training run within an experiment.

    Represents one trained model candidate, including hyperparameters,
    cross-validation metrics, test metrics, and artifact references.

    Attributes:
        id: UUID primary key.
        experiment_id: Foreign key to the parent experiment.
        model_type: Type of model trained (e.g., "xgboost", "random_forest").
        hyperparams_json: JSON-serialized hyperparameters used.
        cv_metrics_json: JSON-serialized cross-validation metrics (nullable).
        test_metrics_json: JSON-serialized test set metrics (nullable).
        training_time_sec: Duration of training in seconds (nullable).
        artifact_model_onnx: Path to ONNX model artifact (nullable).
        artifact_model_jlib: Path to joblib model artifact (nullable).
        status: Current run status (queued, running, done, failed).
        started_at: Timestamp when run started (nullable).
        completed_at: Timestamp when run completed (nullable).
    """

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    experiment_id: Mapped[str] = mapped_column(
        ForeignKey("experiments.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    hyperparams_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    cv_metrics_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    test_metrics_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    training_time_sec: Mapped[Optional[float]] = mapped_column(
        Real,
        nullable=True,
    )
    artifact_model_onnx: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    artifact_model_jlib: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[Literal["queued", "running", "done", "failed"]] = mapped_column(
        Text,
        nullable=False,
        default="queued",
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Relationships
    experiment: Mapped["Experiment"] = relationship(back_populates="runs")
    evaluations: Mapped[list["Evaluation"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_runs_experiment_id", "experiment_id"),
        CheckConstraint(
            "status IN ('queued', 'running', 'done', 'failed')",
            name="ck_run_status",
        ),
    )


# =============================================================================
# Evaluation Model
# =============================================================================


class Evaluation(Base):
    """Model evaluation results on a specific data split.

    Stores computed metrics, confusion matrix, and threshold settings
    for a trained model's performance evaluation.

    Attributes:
        id: UUID primary key.
        run_id: Foreign key to the associated training run.
        split: Data split used for evaluation ('val' or 'test').
        metrics_json: JSON-serialized evaluation metrics.
        confusion_matrix_json: JSON-serialized confusion matrix (nullable).
        threshold: Classification threshold used (default 0.5).
        created_at: Timestamp when evaluation was created.
    """

    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    run_id: Mapped[str] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    split: Mapped[Literal["val", "test"]] = mapped_column(
        Text,
        nullable=False,
    )
    metrics_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    confusion_matrix_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    threshold: Mapped[float] = mapped_column(
        Real,
        nullable=False,
        default=0.5,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    # Relationships
    run: Mapped["Run"] = relationship(back_populates="evaluations")
    subgroup_analyses: Mapped[list["SubgroupAnalysis"]] = relationship(
        back_populates="evaluation",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "split IN ('val', 'test')",
            name="ck_evaluation_split",
        ),
    )


# =============================================================================
# SubgroupAnalysis Model
# =============================================================================


class SubgroupAnalysis(Base):
    """Performance analysis for a specific data slice/subgroup.

    Stores metrics computed on a subset of the data defined by slice criteria,
    enabling fairness and bias analysis.

    Attributes:
        id: UUID primary key.
        evaluation_id: Foreign key to the parent evaluation.
        slice_name: Human-readable name of the slice.
        slice_config: JSON-serialized slice configuration.
        n: Sample count in this slice.
        metrics_json: JSON-serialized metrics for this slice.
    """

    __tablename__ = "subgroup_analyses"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    evaluation_id: Mapped[str] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        nullable=False,
    )
    slice_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    slice_config: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    n: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    metrics_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Relationships
    evaluation: Mapped["Evaluation"] = relationship(back_populates="subgroup_analyses")


# =============================================================================
# Export Model
# =============================================================================


class Export(Base):
    """Exported artifact record for an experiment.

    Tracks all exported files including models, pipelines, reports,
    and prediction files with checksums for integrity verification.

    Attributes:
        id: UUID primary key.
        experiment_id: Foreign key to the parent experiment.
        artifact_type: Type of artifact (model_onnx, model_joblib, pipeline, report, predictions).
        file_path: Path to the exported file.
        file_size_bytes: Size of the exported file in bytes.
        checksum_sha256: SHA-256 checksum for integrity verification.
        created_at: Timestamp when export was created.
    """

    __tablename__ = "exports"

    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    experiment_id: Mapped[str] = mapped_column(
        ForeignKey("experiments.id"),
        nullable=False,
    )
    artifact_type: Mapped[
        Literal["model_onnx", "model_joblib", "pipeline", "report", "predictions"]
    ] = mapped_column(
        Text,
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    checksum_sha256: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    # Relationships
    experiment: Mapped["Experiment"] = relationship(back_populates="exports")

    __table_args__ = (
        CheckConstraint(
            "artifact_type IN ('model_onnx', 'model_joblib', 'pipeline', 'report', 'predictions')",
            name="ck_export_artifact_type",
        ),
    )
