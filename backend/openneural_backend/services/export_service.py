"""Export service for OpenNeural backend.

Provides artifact export functionality for models, pipelines, evaluation reports,
and test predictions. All methods handle file operations, checksum generation,
and database export record creation per the OpenNeural TDD/SRS specifications.

Exposes:
    export_model_onnx(run_id, dest_dir): Export model in ONNX format.
    export_model_joblib(run_id, dest_dir): Export model in joblib format.
    export_pipeline_joblib(run_id, dest_dir): Export fitted pipeline in joblib format.
    export_report_pdf(experiment_id, dest_dir): Generate and export evaluation PDF report.
    export_predictions_csv(run_id, dest_dir): Export test-set predictions as CSV.
    export_all(experiment_id, dest_dir, formats): Export all artifacts for an experiment.
    generate_manifest(dest_dir, exported_files): Generate JSON manifest with checksums.
"""

import hashlib
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import joblib
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from sqlalchemy import select

from openneural_backend.config import Settings
from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Experiment, Export, Run

# Configure logger for this module
logger = logging.getLogger(__name__)


def _compute_file_checksum(file_path: Path) -> str:
    """Compute SHA-256 checksum for a file.

    Per SRS NFR-SEC-04: All exported artifacts must include SHA-256 checksums
    for external verification.

    Args:
        file_path: Path to the file to checksum.

    Returns:
        str: Hex-encoded SHA-256 checksum.

    Raises:
        FileNotFoundError: If the file does not exist.
        IOError: If the file cannot be read.
    """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def _copy_with_checksum(source: Path, dest: Path) -> tuple[int, str]:
    """Copy a file and compute its checksum.

    Args:
        source: Source file path.
        dest: Destination file path.

    Returns:
        tuple[int, str]: File size in bytes and SHA-256 checksum.

    Raises:
        FileNotFoundError: If the source file does not exist.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Copy file while computing checksum
    sha256_hash = hashlib.sha256()
    bytes_copied = 0

    with open(source, "rb") as src_f:
        with open(dest, "wb") as dst_f:
            for chunk in iter(lambda: src_f.read(8192), b""):
                sha256_hash.update(chunk)
                dst_f.write(chunk)
                bytes_copied += len(chunk)

    checksum = sha256_hash.hexdigest()
    return bytes_copied, checksum


async def _get_run_and_experiment(run_id: str) -> tuple[Run, Experiment]:
    """Fetch run and its associated experiment from the database.

    Args:
        run_id: UUID of the run.

    Returns:
        tuple[Run, Experiment]: The run and experiment objects.

    Raises:
        RunNotFoundError: If the run does not exist.
        ExperimentNotFoundError: If the experiment does not exist.
    """
    async with async_session() as session:
        # Fetch the run
        run_stmt = select(Run).where(Run.id == run_id)
        run_result = await session.execute(run_stmt)
        run = run_result.scalar_one_or_none()

        if run is None:
            raise RunNotFoundError(run_id)

        # Fetch the experiment
        exp_stmt = select(Experiment).where(Experiment.id == run.experiment_id)
        exp_result = await session.execute(exp_stmt)
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise ExperimentNotFoundError(run.experiment_id)

        return run, experiment


async def _get_experiment(experiment_id: str) -> Experiment:
    """Fetch experiment from the database.

    Args:
        experiment_id: UUID of the experiment.

    Returns:
        Experiment: The experiment object.

    Raises:
        ExperimentNotFoundError: If the experiment does not exist.
    """
    async with async_session() as session:
        exp_stmt = select(Experiment).where(Experiment.id == experiment_id)
        exp_result = await session.execute(exp_stmt)
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise ExperimentNotFoundError(experiment_id)

        return experiment


async def _create_export_record(
    experiment_id: str,
    artifact_type: Literal["model_onnx", "model_joblib", "pipeline", "report", "predictions"],
    file_path: Path,
) -> Export:
    """Create an export record in the database.

    Args:
        experiment_id: UUID of the experiment.
        artifact_type: Type of exported artifact.
        file_path: Path to the exported file.

    Returns:
        Export: The created export record.
    """
    async with async_session() as session:
        file_size = file_path.stat().st_size
        checksum = _compute_file_checksum(file_path)

        export = Export(
            experiment_id=experiment_id,
            artifact_type=artifact_type,
            file_path=str(file_path),
            file_size_bytes=file_size,
            checksum_sha256=checksum,
        )
        session.add(export)
        await session.commit()
        await session.refresh(export)

        return export


def _get_experiment_dir(experiment_id: str) -> Path:
    """Get the experiments directory for a given experiment.

    Per TDD section 4.5: File Storage Layout
    {data_dir}/experiments/{experiment_id}/

    Args:
        experiment_id: UUID of the experiment.

    Returns:
        Path: Path to the experiment directory.
    """
    settings = Settings.get()
    return settings.data_dir / "experiments" / experiment_id


def _get_run_dir(experiment_id: str, run_id: str) -> Path:
    """Get the runs directory for a given run.

    Per TDD section 4.5: File Storage Layout
    {data_dir}/experiments/{experiment_id}/runs/{run_id}/

    Args:
        experiment_id: UUID of the experiment.
        run_id: UUID of the run.

    Returns:
        Path: Path to the run directory.
    """
    return _get_experiment_dir(experiment_id) / "runs" / run_id


async def export_model_onnx(run_id: str, dest_dir: str | Path) -> dict[str, Any]:
    """Export model in ONNX format.

    Loads the fitted model from model.joblib, attempts ONNX conversion via
    skl2onnx.convert_sklearn with target_opset=17, and writes to the destination.
    Per SRS FR-EXP-01: ONNX export is supported for models where conversion is available.
    Per TDD 4.3: ONNX export via skl2onnx with fallback to joblib.

    If conversion fails (unsupported model), logs a warning and skips ONNX export
    without raising an error.

    Args:
        run_id: UUID of the run to export from.
        dest_dir: Destination directory path for the exported file.

    Returns:
        dict: Export result containing:
            - artifact_type: "model_onnx"
            - file_path: Absolute path to the exported file.
            - file_size_bytes: Size of the exported file.
            - checksum_sha256: SHA-256 checksum for integrity verification.
            - status: "success" or "skipped"
            - message: Human-readable status message.

    Raises:
        RunNotFoundError: If the run does not exist.
        ArtifactNotFoundError: If the joblib model artifact is not available.
        ExportError: If the export fails due to I/O or permission issues.
    """
    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        run, experiment = await _get_run_and_experiment(run_id)

        # Get run directory for model artifact
        run_dir = _get_run_dir(experiment.id, run_id)
        model_path = run_dir / "model.joblib"

        if not model_path.exists():
            raise ArtifactNotFoundError(run_id, "model.joblib")

        # Load the fitted model
        try:
            model = joblib.load(model_path)
        except Exception as e:
            raise ExportError(f"Failed to load model from {model_path}: {e}")

        # Prepare destination file path
        dest_file = dest_path / f"{run.model_type}.onnx"
        dest_path.mkdir(parents=True, exist_ok=True)

        # Attempt ONNX conversion
        try:
            # Infer initial types - assume float32 input features
            # This is a reasonable default for sklearn models
            # The input shape will be (batch_size, n_features)
            # We'll need to determine n_features from the model
            n_features = None

            # Try to get n_features from common sklearn attributes
            if hasattr(model, "n_features_in_"):
                n_features = model.n_features_in_
            elif hasattr(model, "coef_"):
                # Linear models have coef_ attribute
                n_features = model.coef_.shape[-1] if len(model.coef_.shape) > 0 else model.coef_.shape[0]
            elif hasattr(model, "feature_importances_"):
                # Tree-based models
                n_features = len(model.feature_importances_)
            else:
                # Default to a placeholder - ONNX conversion may still work
                # if the model stores shape info internally
                n_features = 1

            if n_features is None:
                n_features = 1

            initial_type = [("float_input", FloatTensorType([None, n_features]))]

            # Convert to ONNX with opset 17 (per TDD NFR-PORT-03)
            onnx_model = convert_sklearn(
                model,
                initial_types=initial_type,
                target_opset=17,
            )

            # Write ONNX model to file
            with open(dest_file, "wb") as f:
                f.write(onnx_model.SerializeToString())

            # Compute checksum and file size
            file_size = dest_file.stat().st_size
            checksum = _compute_file_checksum(dest_file)

            # Create export record
            await _create_export_record(experiment.id, "model_onnx", dest_file)

            return {
                "artifact_type": "model_onnx",
                "file_path": str(dest_file),
                "file_size_bytes": file_size,
                "checksum_sha256": checksum,
                "status": "success",
                "message": f"ONNX model exported successfully to {dest_file}",
            }

        except Exception as e:
            # Conversion failed (unsupported model) - log warning and skip
            logger.warning(
                f"ONNX conversion failed for {run.model_type} (run {run_id[:8]}): {e}. "
                f"Skipping ONNX export. Model can still be exported in joblib format."
            )

            return {
                "artifact_type": "model_onnx",
                "file_path": None,
                "file_size_bytes": 0,
                "checksum_sha256": None,
                "status": "skipped",
                "message": f"ONNX conversion not supported for {run.model_type}: {e}",
            }

    except (RunNotFoundError, ArtifactNotFoundError):
        raise
    except ExportError:
        raise
    except Exception as e:
        raise ExportError(f"Failed to export ONNX model: {e}")


async def export_model_joblib(run_id: str, dest_dir: str | Path) -> dict[str, Any]:
    """Export model in joblib format.

    Copies model.joblib from the run artifact directory to the specified destination.
    Per SRS FR-EXP-01: joblib export is available for all models as a fallback.

    Args:
        run_id: UUID of the run to export from.
        dest_dir: Destination directory path for the exported file.

    Returns:
        dict: Export result containing:
            - artifact_type: "model_joblib"
            - file_path: Absolute path to the exported file.
            - file_size_bytes: Size of the exported file.
            - checksum_sha256: SHA-256 checksum for integrity verification.
            - status: "success" or "failed"
            - message: Human-readable status message.

    Raises:
        RunNotFoundError: If the run does not exist.
        ArtifactNotFoundError: If the model.joblib artifact is not available.
        ExportError: If the export fails due to I/O or permission issues.
    """
    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        run, experiment = await _get_run_and_experiment(run_id)

        # Get run directory for model artifact
        run_dir = _get_run_dir(experiment.id, run_id)
        model_path = run_dir / "model.joblib"

        if not model_path.exists():
            raise ArtifactNotFoundError(run_id, "model.joblib")

        # Copy file to destination: {dest_dir}/{model_type}.joblib
        dest_file = dest_path / f"{run.model_type}.joblib"
        file_size, checksum = _copy_with_checksum(model_path, dest_file)

        # Create export record
        await _create_export_record(experiment.id, "model_joblib", dest_file)

        return {
            "artifact_type": "model_joblib",
            "file_path": str(dest_file),
            "file_size_bytes": file_size,
            "checksum_sha256": checksum,
            "status": "success",
            "message": f"Joblib model exported successfully to {dest_file}",
        }

    except (RunNotFoundError, ArtifactNotFoundError):
        raise
    except Exception as e:
        raise ExportError(f"Failed to export joblib model: {e}")


async def export_pipeline_joblib(run_id: str, dest_dir: str | Path) -> dict[str, Any]:
    """Export fitted preprocessing pipeline in joblib format.

    Exports the joblib-serialized scikit-learn Pipeline object to the specified destination.
    Per SRS FR-EXP-02: The fitted pipeline is exported for downstream use.

    Args:
        run_id: UUID of the run to export from.
        dest_dir: Destination directory path for the exported file.

    Returns:
        dict: Export result containing:
            - artifact_type: "pipeline"
            - file_path: Absolute path to the exported file.
            - file_size_bytes: Size of the exported file.
            - checksum_sha256: SHA-256 checksum for integrity verification.
            - status: "success" or "failed"
            - message: Human-readable status message.

    Raises:
        RunNotFoundError: If the run does not exist.
        ArtifactNotFoundError: If the pipeline artifact is not available.
        ExportError: If the export fails due to I/O or permission issues.
    """
    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        run, experiment = await _get_run_and_experiment(run_id)

        # Get run directory for pipeline artifact
        run_dir = _get_run_dir(experiment.id, run_id)
        pipeline_path = run_dir / "pipeline.joblib"

        if not pipeline_path.exists():
            raise ArtifactNotFoundError(run_id, "pipeline")

        # Copy file to destination: {dest_dir}/pipeline.joblib
        dest_file = dest_path / "pipeline.joblib"
        file_size, checksum = _copy_with_checksum(pipeline_path, dest_file)

        # Create export record
        await _create_export_record(experiment.id, "pipeline", dest_file)

        return {
            "artifact_type": "pipeline",
            "file_path": str(dest_file),
            "file_size_bytes": file_size,
            "checksum_sha256": checksum,
            "status": "success",
            "message": f"Pipeline exported successfully to {dest_file}",
        }

    except (RunNotFoundError, ArtifactNotFoundError):
        raise
    except Exception as e:
        raise ExportError(f"Failed to export pipeline: {e}")


async def export_report_pdf(experiment_id: str, dest_dir: str | Path) -> dict[str, Any]:
    """Generate and export evaluation report as PDF.

    Creates a structured PDF report using reportlab with the following sections:
    - Cover page with experiment ID and timestamp
    - Experiment metadata table
    - Dataset snapshot info (version label, row count, schema summary)
    - Pipeline configuration summary (ordered block list with params)
    - Metric summary table (all metrics)
    - Confusion matrix (rendered as a colored grid)
    - Subgroup analysis table (with fairness flag indicators)
    - Decision threshold selection note
    
    Per SRS FR-EXP-03: Evaluation report is generated as a structured PDF.

    Args:
        experiment_id: UUID of the experiment to generate report for.
        dest_dir: Destination directory path for the exported file.

    Returns:
        dict: Export result containing:
            - artifact_type: "report"
            - file_path: Absolute path to the exported file.
            - file_size_bytes: Size of the exported file.
            - checksum_sha256: SHA-256 checksum for integrity verification.
            - status: "success" or "failed"
            - message: Human-readable status message.

    Raises:
        ExperimentNotFoundError: If the experiment does not exist.
        ExportError: If the report generation fails.
    """
    from openneural_backend.db.models import (
        DatasetSnapshot,
        Evaluation,
        Pipeline,
        SubgroupAnalysis,
    )

    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        async with async_session() as session:
            # Fetch experiment with related data
            exp_stmt = (
                select(Experiment)
                .where(Experiment.id == experiment_id)
            )
            exp_result = await session.execute(exp_stmt)
            experiment = exp_result.scalar_one_or_none()

            if experiment is None:
                raise ExperimentNotFoundError(experiment_id)

            # Fetch pipeline
            pipeline_stmt = select(Pipeline).where(Pipeline.id == experiment.pipeline_id)
            pipeline_result = await session.execute(pipeline_stmt)
            pipeline = pipeline_result.scalar_one_or_none()

            # Fetch snapshot
            if pipeline:
                snapshot_stmt = select(DatasetSnapshot).where(
                    DatasetSnapshot.id == pipeline.snapshot_id
                )
                snapshot_result = await session.execute(snapshot_stmt)
                snapshot = snapshot_result.scalar_one_or_none()
            else:
                snapshot = None

            # Fetch best run and evaluation
            best_run_stmt = (
                select(Run)
                .where(Run.experiment_id == experiment_id)
                .where(Run.status == "done")
                .where(Run.test_metrics_json.isnot(None))
            )
            best_run_result = await session.execute(best_run_stmt)
            runs = best_run_result.scalars().all()

            best_run = None
            best_metrics = None
            if runs:
                # Find best run by optimization metric
                optimize_metric = experiment.optimize_metric
                runs_with_scores = []
                for run in runs:
                    try:
                        metrics = json.loads(run.test_metrics_json)
                        score = metrics.get(optimize_metric, float("-inf"))
                        if optimize_metric in ("rmse", "mae"):
                            runs_with_scores.append((run, metrics, -score))
                        else:
                            runs_with_scores.append((run, metrics, score))
                    except (json.JSONDecodeError, TypeError):
                        continue

                if runs_with_scores:
                    runs_with_scores.sort(key=lambda x: x[2], reverse=True)
                    best_run, best_metrics, _ = runs_with_scores[0]

            # Fetch evaluation and subgroup analysis if available
            evaluation = None
            subgroup_analyses = []
            if best_run:
                eval_stmt = (
                    select(Evaluation)
                    .where(Evaluation.run_id == best_run.id)
                    .where(Evaluation.split == "test")
                )
                eval_result = await session.execute(eval_stmt)
                evaluation = eval_result.scalar_one_or_none()

                if evaluation:
                    subg_stmt = select(SubgroupAnalysis).where(
                        SubgroupAnalysis.evaluation_id == evaluation.id
                    )
                    subg_result = await session.execute(subg_stmt)
                    subgroup_analyses = subg_result.scalars().all()

            # Generate PDF report to {dest_dir}/report.pdf
            dest_file = dest_path / "report.pdf"
            dest_path.mkdir(parents=True, exist_ok=True)

            doc = SimpleDocTemplate(
                str(dest_file),
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18,
            )

            styles = getSampleStyleSheet()
            story = []

            # ============================================
            # COVER PAGE
            # ============================================
            story.append(Spacer(1, 100))
            
            # Title
            story.append(Paragraph(
                "OpenNeural Evaluation Report",
                styles["Heading1"]
            ))
            story.append(Spacer(1, 30))
            
            # Experiment ID
            story.append(Paragraph(
                f"<b>Experiment ID:</b> {experiment.experiment_id_human}",
                styles["Heading2"]
            ))
            story.append(Spacer(1, 12))
            
            # Timestamp
            report_timestamp = datetime.utcnow().isoformat()
            story.append(Paragraph(
                f"<b>Report Generated:</b> {report_timestamp}",
                styles["Normal"]
            ))
            story.append(Spacer(1, 12))
            
            # Experiment UUID
            story.append(Paragraph(
                f"<b>UUID:</b> {experiment.id}",
                styles["Normal"]
            ))
            
            # Page break after cover
            story.append(Spacer(1, 400))

            # ============================================
            # EXPERIMENT METADATA TABLE
            # ============================================
            story.append(Paragraph("Experiment Metadata", styles["Heading2"]))
            story.append(Spacer(1, 12))
            
            metadata = [
                ["Field", "Value"],
                ["Experiment ID", experiment.id],
                ["Human ID", experiment.experiment_id_human],
                ["Task Type", experiment.project.task_type if hasattr(experiment, 'project') else "N/A"],
                ["Status", experiment.status],
                ["Created At", experiment.created_at.isoformat()],
                ["Optimization Metric", experiment.optimize_metric],
                ["AutoML Enabled", "Yes" if experiment.automl_enabled else "No"],
            ]
            if experiment.started_at:
                metadata.append(["Started At", experiment.started_at.isoformat()])
            if experiment.completed_at:
                metadata.append(["Completed At", experiment.completed_at.isoformat()])

            metadata_table = Table(metadata)
            metadata_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 12),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ]))
            story.append(metadata_table)
            story.append(Spacer(1, 20))

            # ============================================
            # DATASET SNAPSHOT INFO
            # ============================================
            if snapshot:
                story.append(Paragraph("Dataset Snapshot", styles["Heading2"]))
                story.append(Spacer(1, 12))
                
                snapshot_data = [
                    ["Field", "Value"],
                    ["Snapshot ID", snapshot.id],
                    ["Version Label", snapshot.version_label],
                    ["File Name", snapshot.file_name],
                    ["File Size", f"{snapshot.file_size_bytes:,} bytes"],
                    ["Row Count", f"{snapshot.row_count:,}"],
                    ["Column Count", snapshot.col_count],
                    ["Created At", snapshot.created_at.isoformat()],
                ]
                snapshot_table = Table(snapshot_data)
                snapshot_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                ]))
                story.append(snapshot_table)
                story.append(Spacer(1, 12))

                # Schema Summary
                try:
                    schema = json.loads(snapshot.schema_json)
                    if schema and isinstance(schema, list):
                        story.append(Paragraph("Schema Summary", styles["Heading3"]))
                        story.append(Spacer(1, 6))
                        
                        schema_data = [["Column", "Type", "Null %", "Unique Count"]]
                        for col_info in schema[:20]:  # Limit to first 20 columns
                            schema_data.append([
                                col_info.get("name", "N/A"),
                                col_info.get("inferred_type", "N/A"),
                                f"{col_info.get('null_pct', 0):.1f}%",
                                str(col_info.get("unique_count", "N/A")),
                            ])
                        
                        if len(schema) > 20:
                            schema_data.append([f"... and {len(schema) - 20} more columns", "", "", ""])
                        
                        schema_table = Table(schema_data)
                        schema_table.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                            ("GRID", (0, 0), (-1, -1), 1, colors.black),
                        ]))
                        story.append(schema_table)
                except json.JSONDecodeError:
                    pass
                
                story.append(Spacer(1, 20))

            # ============================================
            # PIPELINE CONFIGURATION SUMMARY
            # ============================================
            if pipeline:
                story.append(Paragraph("Pipeline Configuration", styles["Heading2"]))
                story.append(Spacer(1, 12))
                
                try:
                    pipeline_config = json.loads(pipeline.config_json)
                    blocks = pipeline_config.get("blocks", [])
                    
                    if blocks:
                        pipeline_data = [["Step", "Block Type", "Parameters"]]
                        for i, block in enumerate(blocks, 1):
                            block_type = block.get("type", "unknown")
                            params = block.get("params", {})
                            params_str = ", ".join(f"{k}={v}" for k, v in params.items())
                            if len(params_str) > 50:
                                params_str = params_str[:47] + "..."
                            pipeline_data.append([str(i), block_type, params_str])

                        pipeline_table = Table(pipeline_data, colWidths=[50, 150, 250])
                        pipeline_table.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                            ("GRID", (0, 0), (-1, -1), 1, colors.black),
                        ]))
                        story.append(pipeline_table)
                    else:
                        story.append(Paragraph("No pipeline blocks configured.", styles["Normal"]))
                except json.JSONDecodeError:
                    story.append(Paragraph("Unable to parse pipeline configuration", styles["Normal"]))
                
                story.append(Spacer(1, 20))

            # ============================================
            # METRIC SUMMARY TABLE
            # ============================================
            if best_run and best_metrics:
                story.append(Paragraph("Model Performance Metrics", styles["Heading2"]))
                story.append(Paragraph(f"Best Model: <b>{best_run.model_type}</b>", styles["Normal"]))
                story.append(Spacer(1, 12))

                metrics_data = [["Metric", "Value"]]
                for metric_name, metric_value in best_metrics.items():
                    if isinstance(metric_value, float):
                        metrics_data.append([metric_name, f"{metric_value:.4f}"])
                    elif isinstance(metric_value, list):
                        metrics_data.append([metric_name, f"{len(metric_value)} items"])
                    else:
                        metrics_data.append([metric_name, str(metric_value)])

                if best_run.training_time_sec:
                    metrics_data.append(["Training Time", f"{best_run.training_time_sec:.2f}s"])

                metrics_table = Table(metrics_data)
                metrics_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                ]))
                story.append(metrics_table)
                story.append(Spacer(1, 20))

            # ============================================
            # CONFUSION MATRIX (COLORED GRID)
            # ============================================
            if evaluation and evaluation.confusion_matrix_json:
                try:
                    cm = json.loads(evaluation.confusion_matrix_json)
                    story.append(Paragraph("Confusion Matrix", styles["Heading2"]))
                    
                    if evaluation.threshold:
                        story.append(Paragraph(
                            f"Decision Threshold: {evaluation.threshold:.2f}",
                            styles["Normal"]
                        ))
                    story.append(Spacer(1, 12))

                    # Handle binary confusion matrix
                    if "tn" in cm:
                        tn, fp, fn, tp = cm.get("tn", 0), cm.get("fp", 0), cm.get("fn", 0), cm.get("tp", 0)
                        cm_data = [
                            ["", "Predicted: Negative", "Predicted: Positive"],
                            ["Actual: Negative", str(tn), str(fp)],
                            ["Actual: Positive", str(fn), str(tp)],
                        ]
                        
                        # Calculate max value for color scaling
                        max_val = max(tn, fp, fn, tp) if any([tn, fp, fn, tp]) else 1
                        
                        cm_table = Table(cm_data)
                        cm_table.setStyle(TableStyle([
                            # Header row
                            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                            ("BACKGROUND", (0, 0), (0, -1), colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("TEXTCOLOR", (0, 0), (0, -1), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                            ("GRID", (0, 0), (-1, -1), 1, colors.black),
                            # Data cells with color gradient based on value
                            ("BACKGROUND", (1, 1), (1, 1), colors.Color(1, 1 - tn/max_val, 1 - tn/max_val)),
                            ("BACKGROUND", (2, 1), (2, 1), colors.Color(1, 1 - fp/max_val, 1 - fp/max_val)),
                            ("BACKGROUND", (1, 2), (1, 2), colors.Color(1, 1 - fn/max_val, 1 - fn/max_val)),
                            ("BACKGROUND", (2, 2), (2, 2), colors.Color(1, 1 - tp/max_val, 1 - tp/max_val)),
                        ]))
                    else:
                        # Multiclass - show full matrix
                        matrix = cm.get("matrix", [[]])
                        labels = cm.get("labels", [])
                        cm_data = [[""] + labels]
                        for i, label in enumerate(labels):
                            row = [label] + [str(x) for x in matrix[i]]
                            cm_data.append(row)

                        cm_table = Table(cm_data)
                        cm_table.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                            ("BACKGROUND", (0, 0), (0, -1), colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("TEXTCOLOR", (0, 0), (0, -1), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 9),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                            ("GRID", (0, 0), (-1, -1), 1, colors.black),
                        ]))
                    
                    story.append(cm_table)
                    story.append(Spacer(1, 20))
                except json.JSONDecodeError:
                    pass

            # ============================================
            # SUBGROUP ANALYSIS TABLE
            # ============================================
            if subgroup_analyses:
                story.append(Paragraph("Subgroup Analysis", styles["Heading2"]))
                story.append(Spacer(1, 6))

                # Add fairness explanation
                story.append(Paragraph(
                    "<i>Fairness Warning: Groups with F1 score > 0.15 below overall F1 are flagged.</i>",
                    styles["Normal"]
                ))
                story.append(Spacer(1, 6))

                subgroup_data = [["Slice", "Samples", "F1", "Recall", "Precision", "Fairness Flag"]]
                
                # Get overall F1 for comparison
                overall_f1 = best_metrics.get("f1", 1.0) if best_metrics else 1.0
                
                for sg in subgroup_analyses:
                    try:
                        sg_metrics = json.loads(sg.metrics_json)
                        sg_f1 = sg_metrics.get("f1", 0)
                        
                        # Fairness flag (per SRS FR-EVAL-07: F1 more than 0.15 below overall)
                        fairness_warning = sg_f1 < (overall_f1 - 0.15)
                        flag_text = "⚠️ LOW F1" if fairness_warning else "✓ OK"
                        flag_color = colors.orange if fairness_warning else colors.green
                        
                        subgroup_data.append([
                            sg.slice_name,
                            str(sg.n),
                            f"{sg_f1:.4f}",
                            f"{sg_metrics.get('recall', 0):.4f}",
                            f"{sg_metrics.get('precision', 0):.4f}",
                            flag_text,
                        ])
                    except json.JSONDecodeError:
                        continue

                if len(subgroup_data) > 1:
                    sg_table = Table(subgroup_data)
                    
                    # Build table style
                    table_style = [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("ALIGN", (1, 1), (1, -1), "RIGHT"),  # Samples column right-aligned
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 10),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                        ("GRID", (0, 0), (-1, -1), 1, colors.black),
                    ]
                    
                    # Add conditional coloring for fairness flags
                    for i, row in enumerate(subgroup_data[1:], start=1):
                        if len(row) >= 6:
                            flag_text = row[5]
                            if "⚠️" in flag_text:
                                table_style.append(("BACKGROUND", (0, i), (-1, i), colors.Color(1, 0.9, 0.9)))
                                table_style.append(("TEXTCOLOR", (5, i), (5, i), colors.red))
                            else:
                                table_style.append(("BACKGROUND", (0, i), (-1, i), colors.Color(0.9, 1, 0.9)))
                    
                    sg_table.setStyle(TableStyle(table_style))
                    story.append(sg_table)
                    story.append(Spacer(1, 20))

            # ============================================
            # DECISION THRESHOLD SELECTION NOTE
            # ============================================
            if evaluation and evaluation.threshold is not None:
                story.append(Paragraph("Decision Threshold Selection", styles["Heading2"]))
                story.append(Spacer(1, 6))
                
                threshold_note = f"""
                The classification decision threshold is set to <b>{evaluation.threshold:.2f}</b>.
                This threshold was used to compute the confusion matrix and all classification metrics above.
                
                <i>Note:</i> The default threshold is 0.5 for binary classification. Adjusting this threshold
                can trade off between precision and recall based on your application's requirements.
                """
                story.append(Paragraph(threshold_note, styles["Normal"]))
                story.append(Spacer(1, 20))

            # ============================================
            # FOOTER
            # ============================================
            story.append(Spacer(1, 40))
            story.append(Paragraph(
                "— End of Report —",
                styles["Normal"]
            ))
            story.append(Paragraph(
                f"Generated by OpenNeural v0.1.0 | {report_timestamp}",
                styles["Normal"]
            ))

            # Build PDF
            doc.build(story)

            # Create export record
            await _create_export_record(experiment.id, "report", dest_file)

            file_size = dest_file.stat().st_size
            checksum = _compute_file_checksum(dest_file)

            return {
                "artifact_type": "report",
                "file_path": str(dest_file),
                "file_size_bytes": file_size,
                "checksum_sha256": checksum,
                "status": "success",
                "message": f"Report exported successfully to {dest_file}",
            }

    except ExperimentNotFoundError:
        raise
    except Exception as e:
        raise ExportError(f"Failed to export report: {e}")


async def export_predictions_csv(run_id: str, dest_dir: str | Path) -> dict[str, Any]:
    """Export test-set predictions as CSV.

    Loads stored predictions Parquet and writes CSV with columns:
    - row_index: Original row index from the dataset
    - predicted_label: Predicted class label
    - true_label: Actual class label
    - prob_{class}: One column per class with probability scores
    
    Per SRS FR-EXP-04: CSV file contains row index, predicted label, true label,
    and per-class probability scores.

    Args:
        run_id: UUID of the run to export predictions from.
        dest_dir: Destination directory path for the exported file.

    Returns:
        dict: Export result containing:
            - artifact_type: "predictions"
            - file_path: Absolute path to the exported file.
            - file_size_bytes: Size of the exported file.
            - checksum_sha256: SHA-256 checksum for integrity verification.
            - status: "success" or "failed"
            - message: Human-readable status message.

    Raises:
        RunNotFoundError: If the run does not exist.
        ArtifactNotFoundError: If the predictions file is not available.
        ExportError: If the export fails.
    """
    import numpy as np
    
    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        run, experiment = await _get_run_and_experiment(run_id)

        # Get run directory for predictions file
        run_dir = _get_run_dir(experiment.id, run_id)
        predictions_path = run_dir / "predictions.parquet"

        if not predictions_path.exists():
            raise ArtifactNotFoundError(run_id, "predictions")

        # Read Parquet file
        df = pd.read_parquet(predictions_path)

        # Build output DataFrame with required columns
        output_df = pd.DataFrame()
        
        # Add row_index
        if "row_index" in df.columns:
            output_df["row_index"] = df["row_index"]
        else:
            # Generate sequential row indices
            output_df["row_index"] = range(len(df))
        
        # Add predicted_label
        if "y_pred" in df.columns:
            output_df["predicted_label"] = df["y_pred"]
        elif "predicted_label" in df.columns:
            output_df["predicted_label"] = df["predicted_label"]
        else:
            raise ExportError("Predictions file missing 'y_pred' or 'predicted_label' column")
        
        # Add true_label
        if "y_true" in df.columns:
            output_df["true_label"] = df["y_true"]
        elif "true_label" in df.columns:
            output_df["true_label"] = df["true_label"]
        else:
            output_df["true_label"] = None  # May not be available for inference-only exports
        
        # Add probability columns: prob_{class}
        # Check if y_proba exists and is array-like
        if "y_proba" in df.columns:
            y_proba_values = df["y_proba"].values
            
            if len(y_proba_values) > 0 and isinstance(y_proba_values[0], (np.ndarray, list)):
                # y_proba is array of probability vectors
                # Determine unique classes
                unique_classes = sorted(set(output_df["predicted_label"].dropna().unique()))
                
                # If binary classification with 2-class probabilities
                if len(y_proba_values[0]) == 2:
                    # Binary: prob_0 and prob_1 (or use class names if available)
                    class_labels = unique_classes if len(unique_classes) == 2 else [0, 1]
                    for i, class_label in enumerate(class_labels):
                        col_name = f"prob_{class_label}"
                        output_df[col_name] = [proba[i] if len(proba) > i else None for proba in y_proba_values]
                elif len(y_proba_values[0]) > 2:
                    # Multiclass: prob_{class} for each class
                    class_labels = unique_classes if len(unique_classes) == len(y_proba_values[0]) else list(range(len(y_proba_values[0])))
                    for i, class_label in enumerate(class_labels):
                        col_name = f"prob_{class_label}"
                        output_df[col_name] = [proba[i] if len(proba) > i else None for proba in y_proba_values]
                else:
                    # Single probability (binary case with just positive class)
                    output_df["prob_1"] = [proba[0] if isinstance(proba, (np.ndarray, list)) else proba for proba in y_proba_values]
            elif len(y_proba_values) > 0:
                # y_proba is a scalar per row (binary classification)
                output_df["prob_1"] = y_proba_values
                # Compute prob_0 as 1 - prob_1 for binary case
                output_df["prob_0"] = 1 - output_df["prob_1"]
        
        # Export to CSV: {dest_dir}/predictions.csv
        dest_file = dest_path / "predictions.csv"
        dest_path.mkdir(parents=True, exist_ok=True)
        output_df.to_csv(dest_file, index=False)

        # Create export record
        await _create_export_record(experiment.id, "predictions", dest_file)

        file_size = dest_file.stat().st_size
        checksum = _compute_file_checksum(dest_file)

        return {
            "artifact_type": "predictions",
            "file_path": str(dest_file),
            "file_size_bytes": file_size,
            "checksum_sha256": checksum,
            "status": "success",
            "message": f"Predictions exported successfully to {dest_file}",
        }

    except (RunNotFoundError, ArtifactNotFoundError):
        raise
    except ExportError:
        raise
    except Exception as e:
        raise ExportError(f"Failed to export predictions: {e}")


async def export_all(
    experiment_id: str,
    dest_dir: str | Path,
    formats: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Export all artifacts for an experiment.

    Exports model, pipeline, report, and predictions for the best run in the experiment.
    Per SRS FR-EXP-05: "Export All" action triggers all four exports in a single operation.

    Args:
        experiment_id: UUID of the experiment to export from.
        dest_dir: Destination directory path for the exported files.
        formats: Optional dict specifying formats per artifact type.
            e.g., {"model": ["onnx", "joblib"]} to export both ONNX and joblib.
            If not specified, exports all available formats.

    Returns:
        dict: Export results containing:
            - exports: List of individual export results.
            - manifest_path: Path to the generated manifest file.
            - status: "success" or "partial_failure" if some exports failed.
            - message: Human-readable status summary.

    Raises:
        ExperimentNotFoundError: If the experiment does not exist.
        ExportError: If all exports fail.
    """
    from sqlalchemy import select

    dest_path = Path(dest_dir).expanduser().resolve()
    dest_path.mkdir(parents=True, exist_ok=True)

    try:
        experiment = await _get_experiment(experiment_id)

        # Find best run
        async with async_session() as session:
            runs_stmt = (
                select(Run)
                .where(Run.experiment_id == experiment_id)
                .where(Run.status == "done")
                .where(Run.test_metrics_json.isnot(None))
            )
            runs_result = await session.execute(runs_stmt)
            runs = runs_result.scalars().all()

            if not runs:
                raise ExportError(f"No completed runs found for experiment {experiment_id}")

            # Find best run by optimization metric
            optimize_metric = experiment.optimize_metric
            runs_with_scores = []
            for run in runs:
                try:
                    metrics = json.loads(run.test_metrics_json)
                    score = metrics.get(optimize_metric, float("-inf"))
                    if optimize_metric in ("rmse", "mae"):
                        runs_with_scores.append((run, -score))
                    else:
                        runs_with_scores.append((run, score))
                except (json.JSONDecodeError, TypeError):
                    continue

            if not runs_with_scores:
                raise ExportError(f"No runs with valid metrics found for experiment {experiment_id}")

            runs_with_scores.sort(key=lambda x: x[1], reverse=True)
            best_run = runs_with_scores[0][0]

        exports = []
        errors = []

        # Determine model formats to export
        model_formats = formats.get("model", ["onnx", "joblib"]) if formats else ["onnx", "joblib"]

        # Export model(s)
        for fmt in model_formats:
            try:
                if fmt == "onnx":
                    result = await export_model_onnx(best_run.id, dest_path)
                    exports.append(result)
                elif fmt == "joblib":
                    result = await export_model_joblib(best_run.id, dest_path)
                    exports.append(result)
            except ArtifactNotFoundError:
                # If ONNX is not available, skip it (some models don't support ONNX)
                if fmt == "onnx":
                    errors.append(f"ONNX model not available for {best_run.model_type}")
                else:
                    errors.append(f"Export failed: could not write {fmt} model to {dest_path}")
            except Exception as e:
                errors.append(f"Export failed: could not write {fmt} model to {dest_path} - {e}")

        # Export pipeline
        try:
            result = await export_pipeline_joblib(best_run.id, dest_path)
            exports.append(result)
        except Exception as e:
            errors.append(f"Export failed: could not write pipeline to {dest_path}/pipeline.joblib - {e}")

        # Export report
        try:
            result = await export_report_pdf(experiment_id, dest_path)
            exports.append(result)
        except Exception as e:
            errors.append(f"Export failed: could not write report to {dest_path}/report.pdf - {e}")

        # Export predictions
        try:
            result = await export_predictions_csv(best_run.id, dest_path)
            exports.append(result)
        except Exception as e:
            errors.append(f"Export failed: could not write predictions to {dest_path}/predictions.csv - {e}")

        # Generate manifest
        manifest_path = await generate_manifest(dest_path, experiment_id, exports)

        # Determine overall status
        if len(errors) == 0:
            status = "success"
            message = f"All artifacts exported successfully to {dest_path}"
        elif len(exports) > 0:
            status = "partial_failure"
            message = f"Some artifacts exported with {len(errors)} errors: {'; '.join(errors)}"
        else:
            raise ExportError(f"All exports failed: {'; '.join(errors)}")

        return {
            "exports": exports,
            "manifest_path": str(manifest_path),
            "status": status,
            "message": message,
            "errors": errors if errors else None,
        }

    except ExperimentNotFoundError:
        raise
    except ExportError:
        raise
    except Exception as e:
        raise ExportError(f"Failed to export all artifacts: {e}")


async def generate_manifest(
    dest_dir: str | Path,
    experiment_id: str,
    exported_files: list[dict],
) -> Path:
    """Generate JSON manifest file listing all exported artifacts with checksums.

    For each exported file, computes SHA-256 checksum and writes export_manifest.json
    containing metadata about the export operation and all artifacts.
    
    Per SRS NFR-SEC-04: Exported artifact files carry a manifest file listing their
    SHA-256 checksums for external verification.

    Args:
        dest_dir: Directory where the manifest will be written.
        experiment_id: UUID of the experiment being exported.
        exported_files: List of export result dicts containing file_path and checksum_sha256.

    Returns:
        Path: Path to the generated manifest file.

    Raises:
        ExportError: If manifest generation fails.
    """
    dest_path = Path(dest_dir).expanduser().resolve()

    try:
        # Build manifest structure per task spec
        manifest = {
            "exported_at": datetime.utcnow().isoformat(),
            "experiment_id": experiment_id,
            "artifacts": [],
        }

        for export in exported_files:
            if export.get("status") == "success":
                # Recompute checksum if not provided (ensures integrity)
                file_path = Path(export.get("file_path")) if export.get("file_path") else None
                checksum = export.get("checksum_sha256")
                
                if file_path and file_path.exists() and not checksum:
                    checksum = _compute_file_checksum(file_path)
                
                manifest["artifacts"].append({
                    "type": export.get("artifact_type"),
                    "path": str(file_path) if file_path else None,
                    "size_bytes": export.get("file_size_bytes"),
                    "checksum_sha256": checksum,
                })

        manifest_path = dest_path / "export_manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        return manifest_path

    except Exception as e:
        raise ExportError(f"Failed to generate manifest: {e}")


class RunNotFoundError(Exception):
    """Raised when a run is not found."""

    def __init__(self, run_id: str) -> None:
        """Initialize with the missing run ID.

        Args:
            run_id: The ID of the run that was not found.
        """
        self.run_id = run_id
        super().__init__(f"Run not found: {run_id}")


class ExperimentNotFoundError(Exception):
    """Raised when an experiment is not found."""

    def __init__(self, experiment_id: str) -> None:
        """Initialize with the missing experiment ID.

        Args:
            experiment_id: The ID of the experiment that was not found.
        """
        self.experiment_id = experiment_id
        super().__init__(f"Experiment not found: {experiment_id}")


class ArtifactNotFoundError(Exception):
    """Raised when an artifact file is not found."""

    def __init__(self, run_id: str, artifact_type: str) -> None:
        """Initialize with run ID and artifact type.

        Args:
            run_id: The ID of the run.
            artifact_type: The type of artifact (e.g., "ONNX", "joblib").
        """
        self.run_id = run_id
        self.artifact_type = artifact_type
        super().__init__(f"{artifact_type} artifact not found for run: {run_id}")


class ExportError(Exception):
    """Raised when export fails."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        """Initialize with error message and optional details.

        Args:
            message: Human-readable error message.
            details: Additional context about the error.
        """
        self.message = message
        self.details = details or {}
        super().__init__(message)
