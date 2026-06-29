"""Initial database migration for OpenNeural.

Creates all 10 tables as defined in the TDD:
- schema_migrations (Alembic's own table, handled separately)
- auth
- projects
- dataset_snapshots
- pipelines
- experiments
- runs
- evaluations
- subgroup_analyses
- exports
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create all tables for the OpenNeural database schema.

    Creates all 10 tables with their constraints, indexes, and foreign keys
    as defined in the TDD (Technical Design Document).
    """
    # Note: schema_migrations is managed by Alembic itself

    # =========================================================================
    # 1. Auth table
    # =========================================================================
    op.create_table(
        "auth",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
    )

    # =========================================================================
    # 2. Projects table
    # =========================================================================
    op.create_table(
        "projects",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("task_type", sa.Text, nullable=False),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "task_type IN ('classification', 'regression')", name="ck_project_task_type"
        ),
    )

    # =========================================================================
    # 3. Dataset Snapshots table
    # =========================================================================
    op.create_table(
        "dataset_snapshots",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_id", sa.Text, nullable=False),
        sa.Column("version_label", sa.Text, nullable=False),
        sa.Column("original_path", sa.Text, nullable=False),
        sa.Column("stored_path", sa.Text, nullable=False),
        sa.Column("file_name", sa.Text, nullable=False),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        sa.Column("row_count", sa.Integer, nullable=False),
        sa.Column("col_count", sa.Integer, nullable=False),
        sa.Column("schema_json", sa.Text, nullable=False),
        sa.Column("checksum_sha256", sa.Text, nullable=False),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "project_id", "version_label", name="uq_snapshot_project_version"
        ),
    )

    # =========================================================================
    # 4. Pipelines table
    # =========================================================================
    op.create_table(
        "pipelines",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_id", sa.Text, nullable=False),
        sa.Column("snapshot_id", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=True),
        sa.Column("config_json", sa.Text, nullable=False),
        sa.Column("validated", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["snapshot_id"], ["dataset_snapshots.id"]),
    )

    # =========================================================================
    # 5. Experiments table
    # =========================================================================
    op.create_table(
        "experiments",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_id", sa.Text, nullable=False),
        sa.Column("pipeline_id", sa.Text, nullable=False),
        sa.Column("experiment_id_human", sa.Text, nullable=False, unique=True),
        sa.Column("automl_enabled", sa.Integer, nullable=False, server_default="1"),
        sa.Column("optimize_metric", sa.Text, nullable=False),
        sa.Column("automl_config_json", sa.Text, nullable=False),
        sa.Column("candidate_models", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="created"),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"]),
        sa.CheckConstraint(
            "status IN ('created', 'running', 'done', 'cancelled', 'interrupted')",
            name="ck_experiment_status",
        ),
    )

    # =========================================================================
    # 6. Runs table
    # =========================================================================
    op.create_table(
        "runs",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("experiment_id", sa.Text, nullable=False),
        sa.Column("model_type", sa.Text, nullable=False),
        sa.Column("hyperparams_json", sa.Text, nullable=False),
        sa.Column("cv_metrics_json", sa.Text, nullable=True),
        sa.Column("test_metrics_json", sa.Text, nullable=True),
        sa.Column("training_time_sec", sa.REAL, nullable=True),
        sa.Column("artifact_model_onnx", sa.Text, nullable=True),
        sa.Column("artifact_model_jlib", sa.Text, nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(
            ["experiment_id"], ["experiments.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'done', 'failed')",
            name="ck_run_status",
        ),
    )

    # Create index on runs.experiment_id
    op.create_index("idx_runs_experiment_id", "runs", ["experiment_id"])

    # =========================================================================
    # 7. Evaluations table
    # =========================================================================
    op.create_table(
        "evaluations",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("run_id", sa.Text, nullable=False),
        sa.Column("split", sa.Text, nullable=False),
        sa.Column("metrics_json", sa.Text, nullable=False),
        sa.Column("confusion_matrix_json", sa.Text, nullable=True),
        sa.Column("threshold", sa.REAL, nullable=False, server_default="0.5"),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "split IN ('val', 'test')",
            name="ck_evaluation_split",
        ),
    )

    # =========================================================================
    # 8. Subgroup Analyses table
    # =========================================================================
    op.create_table(
        "subgroup_analyses",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("evaluation_id", sa.Text, nullable=False),
        sa.Column("slice_name", sa.Text, nullable=False),
        sa.Column("slice_config", sa.Text, nullable=False),
        sa.Column("n", sa.Integer, nullable=False),
        sa.Column("metrics_json", sa.Text, nullable=False),
        sa.ForeignKeyConstraint(
            ["evaluation_id"], ["evaluations.id"], ondelete="CASCADE"
        ),
    )

    # =========================================================================
    # 9. Exports table
    # =========================================================================
    op.create_table(
        "exports",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("experiment_id", sa.Text, nullable=False),
        sa.Column("artifact_type", sa.Text, nullable=False),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        sa.Column("checksum_sha256", sa.Text, nullable=False),
        sa.Column(
            "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"]),
        sa.CheckConstraint(
            "artifact_type IN ('model_onnx', 'model_joblib', 'pipeline', 'report', 'predictions')",
            name="ck_export_artifact_type",
        ),
    )


def downgrade() -> None:
    """Revert all tables created by this migration.

    Drops all tables in reverse order to respect foreign key constraints.
    """
    # Drop tables in reverse order to respect FK constraints
    op.drop_table("exports")
    op.drop_table("subgroup_analyses")
    op.drop_table("evaluations")
    op.drop_table("runs")
    op.drop_table("experiments")
    op.drop_table("pipelines")
    op.drop_table("dataset_snapshots")
    op.drop_table("projects")
    op.drop_table("auth")
