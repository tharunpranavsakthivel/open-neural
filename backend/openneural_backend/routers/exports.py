"""Exports router for OpenNeural backend.

Provides endpoints for artifact export: model, pipeline, report, predictions.
Per TDD §2.7: Export endpoint accepts artifacts list, destination directory,
and formats specification.
"""

from pathlib import Path
from typing import Literal
import logging

logger = logging.getLogger(__name__)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from openneural_backend.services.export_service import (
    ArtifactNotFoundError,
    ExperimentNotFoundError,
    ExportError,
    export_model_joblib,
    export_model_onnx,
    export_pipeline_joblib,
    export_predictions_csv,
    export_report_pdf,
    generate_manifest,
)

router = APIRouter(
    prefix="/experiments/{experiment_id}/export",
    tags=["exports"],
)


class ExportRequest(BaseModel):
    """Request body for exporting artifacts from an experiment.

    Per TDD §2.7: Accepts artifacts list, destination directory,
    and optional formats specification.

    Attributes:
        artifacts: List of artifact types to export.
            Options: "model", "pipeline", "report", "predictions".
        destination_dir: Directory path where artifacts will be written.
            Must be writable by the application.
        formats: Optional formats specification for model exports.
            For example: {"model": ["onnx", "joblib"]}
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "artifacts": ["model", "pipeline", "report", "predictions"],
                    "destination_dir": "/Users/tp/Desktop/openneural_exports/",
                    "formats": {"model": ["onnx", "joblib"]},
                }
            ]
        }
    }

    artifacts: list[Literal["model", "pipeline", "report", "predictions"]]
    destination_dir: str
    formats: dict[str, list[str]] | None = None

    @field_validator("artifacts")
    @classmethod
    def validate_artifacts(cls, v: list[str]) -> list[str]:
        """Validate that at least one artifact is requested."""
        if not v:
            raise ValueError("At least one artifact must be specified")
        return v

    @field_validator("destination_dir")
    @classmethod
    def validate_destination_dir(cls, v: str) -> str:
        """Validate that destination directory is a non-empty string."""
        if not v or not v.strip():
            raise ValueError("destination_dir cannot be empty")
        return v


@router.post("")
async def export_artifacts(experiment_id: str, request: ExportRequest) -> dict:
    """Export artifacts from an experiment.

    Executes requested exports sequentially, generates a manifest,
    inserts records into the exports table, and returns the full
    export result object per TDD §2.7.

    Args:
        experiment_id: The UUID of the experiment to export from.
        request: ExportRequest containing artifacts list, destination directory,
            and optional formats specification.

    Returns:
        dict: Export results per TDD §2.7 containing:
            - exports: List of export results with artifact type, path, size, checksum.
            - manifest_path: Path to the generated export_manifest.json.
            - status: "success", "partial_failure", or "failed".
            - message: Human-readable status summary.
            - errors: List of error messages (if any).

    Raises:
        HTTPException 400: If destination directory is not writable.
        HTTPException 404: If experiment not found.
        HTTPException 500: If export fails unexpectedly.
    """
    dest_path = Path(request.destination_dir).expanduser().resolve()

    # Validate destination directory is writable
    try:
        dest_path.mkdir(parents=True, exist_ok=True)
        # Try to write a test file to verify writability
        test_file = dest_path / ".write_test"
        try:
            test_file.write_text("")
            test_file.unlink()
        except (OSError, PermissionError) as e:
            import errno

            if isinstance(e, PermissionError) or (
                isinstance(e, OSError)
                and getattr(e, "errno", None) in (errno.EACCES, errno.EPERM)
            ):
                logger.error(
                    f"File permission failure: Destination directory {dest_path} is not writable: {e}",
                    exc_info=True,
                )
            raise HTTPException(
                status_code=400,
                detail=f"Destination directory is not writable: {dest_path}. Error: {e}",
            )
    except Exception as e:
        import errno

        if isinstance(e, PermissionError) or (
            isinstance(e, OSError)
            and getattr(e, "errno", None) in (errno.EACCES, errno.EPERM)
        ):
            logger.error(
                f"File permission failure: Invalid destination directory {dest_path}: {e}",
                exc_info=True,
            )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid destination directory: {dest_path}. Error: {e}",
        )

    exports = []
    errors = []
    run_id = None  # Will be determined from best run

    try:
        # Import here to avoid circular imports
        from sqlalchemy import select

        from openneural_backend.db.engine import async_session
        from openneural_backend.db.models import Experiment, Run

        # Verify experiment exists and get best run
        async with async_session() as session:
            exp_stmt = select(Experiment).where(Experiment.id == experiment_id)
            exp_result = await session.execute(exp_stmt)
            experiment = exp_result.scalar_one_or_none()

            if experiment is None:
                raise ExperimentNotFoundError(experiment_id)

            # Find the best run for this experiment
            runs_stmt = (
                select(Run)
                .where(Run.experiment_id == experiment_id)
                .where(Run.status == "done")
                .where(Run.test_metrics_json.isnot(None))
            )
            runs_result = await session.execute(runs_stmt)
            runs = runs_result.scalars().all()

            if not runs:
                raise HTTPException(
                    status_code=400,
                    detail=f"No completed runs found for experiment {experiment_id}",
                )

            # Find best run by optimization metric
            optimize_metric = experiment.optimize_metric
            runs_with_scores = []
            for run in runs:
                try:
                    import json

                    metrics = json.loads(run.test_metrics_json)
                    score = metrics.get(optimize_metric, float("-inf"))
                    if optimize_metric in ("rmse", "mae"):
                        runs_with_scores.append((run, -score))
                    else:
                        runs_with_scores.append((run, score))
                except (json.JSONDecodeError, TypeError):
                    continue

            if not runs_with_scores:
                raise HTTPException(
                    status_code=400,
                    detail=f"No runs with valid metrics found for experiment {experiment_id}",
                )

            runs_with_scores.sort(key=lambda x: x[1], reverse=True)
            best_run = runs_with_scores[0][0]
            run_id = best_run.id

        # Execute requested exports sequentially
        for artifact in request.artifacts:
            try:
                if artifact == "model":
                    # Determine model formats to export
                    model_formats = (
                        request.formats.get("model", ["onnx", "joblib"])
                        if request.formats
                        else ["onnx", "joblib"]
                    )

                    for fmt in model_formats:
                        if fmt == "onnx":
                            result = await export_model_onnx(run_id, dest_path)
                            exports.append(result)
                        elif fmt == "joblib":
                            result = await export_model_joblib(run_id, dest_path)
                            exports.append(result)

                elif artifact == "pipeline":
                    result = await export_pipeline_joblib(run_id, dest_path)
                    exports.append(result)

                elif artifact == "report":
                    result = await export_report_pdf(experiment_id, dest_path)
                    exports.append(result)

                elif artifact == "predictions":
                    result = await export_predictions_csv(run_id, dest_path)
                    exports.append(result)

            except ArtifactNotFoundError as e:
                errors.append(f"Artifact not found for {artifact}: {e}")
            except ExportError as e:
                errors.append(f"Export failed for {artifact}: {e}")
            except Exception as e:
                errors.append(f"Unexpected error exporting {artifact}: {e}")

        # Generate manifest (export records already created by individual export functions)
        try:
            manifest_path = await generate_manifest(dest_path, experiment_id, exports)
        except Exception as e:
            errors.append(f"Failed to generate manifest: {e}")
            manifest_path = None

        # Determine overall status
        if len(errors) == 0:
            status = "success"
            message = f"All artifacts exported successfully to {dest_path}"
        elif len(exports) > 0:
            status = "partial_failure"
            message = f"Some artifacts exported with {len(errors)} errors"
        else:
            status = "failed"
            message = f"All exports failed: {'; '.join(errors)}"

        # Build response per TDD §2.7
        response = {
            "exports": [
                {
                    "artifact": exp.get("artifact_type"),
                    "path": exp.get("file_path"),
                    "size_bytes": exp.get("file_size_bytes"),
                    "checksum_sha256": exp.get("checksum_sha256"),
                }
                for exp in exports
                if exp.get("status") == "success"
            ],
            "manifest_path": str(manifest_path) if manifest_path else None,
            "status": status,
            "message": message,
        }

        if errors:
            response["errors"] = errors

        return response

    except ExperimentNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment not found: {experiment_id}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {e}",
        )
