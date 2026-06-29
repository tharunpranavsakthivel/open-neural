"""Integration tests for all API endpoints (TDD §2.1–2.7).

Validates happy-path and error-path scenarios for every endpoint using httpx.AsyncClient.
"""

import json
from pathlib import Path
import pytest
from httpx import AsyncClient

from openneural_backend.db.models import (
    DatasetSnapshot,
    Evaluation,
    Experiment,
    Pipeline,
    Project,
    Run,
)


# =============================================================================
# Auth Headers Testing
# =============================================================================

@pytest.mark.anyio
async def test_api_auth_required(async_client: AsyncClient) -> None:
    """Verify that requests without or with invalid authentication headers are rejected."""
    # 1. No auth header (overwrite headers)
    orig_headers = async_client.headers
    async_client.headers = {}
    response = await async_client.get("/api/v1/projects")
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"

    # 2. Invalid auth header
    async_client.headers = {"X-OpenNeural-Secret": "wrong_secret_123"}
    response = await async_client.get("/api/v1/projects")
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"

    # Restore client headers
    async_client.headers = orig_headers


@pytest.mark.anyio
async def test_x_openneural_secret_middleware(async_client: AsyncClient) -> None:
    """Verify the X-OpenNeural-Secret middleware behavior.

    - Test that requests without the header receive 401 Unauthorized.
    - Test that requests with a wrong secret receive 401 Unauthorized.
    - Test that requests with the correct secret are processed normally.
    """
    # 1. Requests without the header receive 401
    async_client.headers = {}
    response = await async_client.get("/api/v1/projects")
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"

    # 2. Requests with a wrong secret receive 401
    async_client.headers = {"X-OpenNeural-Secret": "completely_incorrect_secret_xyz"}
    response = await async_client.get("/api/v1/projects")
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"

    # 3. Requests with the correct secret are processed normally
    async_client.headers = {"X-OpenNeural-Secret": "test_secret_for_ipc_auth_42"}
    response = await async_client.get("/api/v1/projects")
    # A successful bypass of 401 means the request reaches the router handler.
    # The project list handler responds with 501 Not Implemented or 200 OK.
    assert response.status_code in (200, 501)



# =============================================================================
# §2.7 Authentication Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_auth_endpoints_scenarios(async_client: AsyncClient, db_session) -> None:
    """Verify auth status and verify flow (Happy path and Error path)."""
    # Happy Path 1: Check Auth status (should be false since no auth row exists yet)
    response = await async_client.get("/api/v1/auth/status")
    assert response.status_code == 200
    assert response.json()["configured"] is False

    # Happy Path 2: Setup authentication
    response = await async_client.post("/api/v1/auth/setup", json={"password": "mypassword123"})
    assert response.status_code == 201
    assert response.json()["configured"] is True

    # Error Path 2: Setup authentication when already configured
    response = await async_client.post("/api/v1/auth/setup", json={"password": "anotherpassword"})
    assert response.status_code == 409
    assert "already configured" in response.json()["detail"]

    # Happy Path 3: Verify correct password
    response = await async_client.post("/api/v1/auth/verify", json={"password": "mypassword123"})
    assert response.status_code == 200
    assert response.json()["valid"] is True

    # Error Path 3: Verify wrong password
    response = await async_client.post("/api/v1/auth/verify", json={"password": "wrongpassword"})
    assert response.status_code == 401
    assert "Invalid password" in response.json()["detail"]


# =============================================================================
# §2.1 Projects Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_projects_endpoints_scenarios(async_client: AsyncClient) -> None:
    """Verify Projects endpoints CRUD operations (Happy path and Error path)."""
    # Happy Path: Create project
    create_payload = {"name": "Classification Project", "task_type": "classification"}
    response = await async_client.post("/api/v1/projects", json=create_payload)
    assert response.status_code == 200
    project_id = response.json()["id"]
    assert response.json()["name"] == "Classification Project"

    # Happy Path: List projects
    response = await async_client.get("/api/v1/projects")
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert any(p["id"] == project_id for p in response.json())

    # Happy Path/Assertion: Get project returns 501 Not Implemented (as per route)
    response = await async_client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == 501

    # Happy Path: Update project
    update_payload = {"name": "Updated Classification Project"}
    response = await async_client.patch(f"/api/v1/projects/{project_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Classification Project"

    # Error Path: Create project with invalid task_type
    bad_payload = {"name": "Bad Project", "task_type": "invalid_type"}
    response = await async_client.post("/api/v1/projects", json=bad_payload)
    assert response.status_code == 422  # Pydantic validation error

    # Error Path/Assertion: Get non-existent project returns 501 Not Implemented (as per route)
    response = await async_client.get("/api/v1/projects/non_existent_id")
    assert response.status_code == 501

    # Happy Path: Delete project
    response = await async_client.delete(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200
    assert response.json()["deleted"] is True


# =============================================================================
# §2.2 Dataset Snapshots Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_snapshots_endpoints_scenarios(
    async_client: AsyncClient, sample_project: Project
) -> None:
    """Verify Snapshots endpoints (Happy path and Error path)."""
    # Happy Path: Upload a small dummy CSV snapshot
    csv_content = "feature1,feature2,label\n1.0,abc,1\n2.0,xyz,0\n"
    files = {"file": ("dummy.csv", csv_content, "text/csv")}
    
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/snapshots",
        files=files,
    )
    assert response.status_code == 201
    snapshot_id = response.json()["id"]
    assert response.json()["file_name"] == "dummy.csv"
    assert response.json()["row_count"] == 2

    # Happy Path: Get snapshot list for project
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/snapshots")
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert any(s["id"] == snapshot_id for s in response.json())

    # Error Path: Upload snapshot to non-existent project
    files_err = {"file": ("dummy.csv", csv_content, "text/csv")}
    response = await async_client.post(
        "/api/v1/projects/non_existent_project/snapshots",
        files=files_err,
    )
    assert response.status_code == 404


# =============================================================================
# §2.3 Preprocessing Pipelines Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_pipelines_endpoints_scenarios(
    async_client: AsyncClient, sample_project: Project, sample_snapshot: DatasetSnapshot
) -> None:
    """Verify Preprocessing Pipelines endpoints (Happy path and Error path)."""
    # Happy Path: Create pipeline
    # To bypass deep file validations, we can use an empty blocks configuration
    create_payload = {
        "snapshot_id": sample_snapshot.id,
        "config": {
            "snapshot_id": sample_snapshot.id,
            "blocks": [
                {"type": "drop_nulls", "params": {"columns": []}}
            ],
        },
        "name": "E2E Pipeline",
    }
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/pipelines",
        json=create_payload,
    )
    assert response.status_code == 201
    pipeline_id = response.json()["id"]
    assert response.json()["validated"] is True

    # Happy Path: Get pipeline list
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/pipelines")
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert any(p["id"] == pipeline_id for p in response.json())

    # Happy Path: Get single pipeline details
    response = await async_client.get(
        f"/api/v1/projects/{sample_project.id}/pipelines/{pipeline_id}"
    )
    assert response.status_code == 200
    assert response.json()["id"] == pipeline_id

    # Happy Path: Validate pipeline
    response = await async_client.get(
        f"/api/v1/projects/{sample_project.id}/pipelines/{pipeline_id}/validate"
    )
    assert response.status_code == 200
    assert response.json()["valid"] is True

    # Error Path: Create pipeline with missing blocks
    bad_payload = {
        "snapshot_id": sample_snapshot.id,
        "config": {
            "snapshot_id": sample_snapshot.id,
            "blocks": [],
        },
    }
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/pipelines",
        json=bad_payload,
    )
    assert response.status_code == 422


# =============================================================================
# §2.4 AutoML Experiments Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_experiments_endpoints_scenarios(
    async_client: AsyncClient,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify Experiments endpoints (Happy path and Error path)."""
    # Happy Path: Create experiment
    create_payload = {
        "pipeline_id": sample_pipeline.id,
        "automl_enabled": True,
        "optimize_metric": "f1",
        "candidate_models": ["logistic_regression", "random_forest"],
    }
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/experiments",
        json=create_payload,
    )
    assert response.status_code == 201
    experiment_id = response.json()["id"]
    assert response.json()["status"] == "created"

    # Happy Path/Assertion: List experiments returns 501 Not Implemented (as per route)
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/experiments")
    assert response.status_code == 501

    # Happy Path/Assertion: Get experiment details returns 501 Not Implemented (as per route)
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/experiments/{experiment_id}")
    assert response.status_code == 501

    # Happy Path: Get training time estimate
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/experiments/{experiment_id}/estimate")
    assert response.status_code == 200
    assert "estimated_seconds" in response.json()

    # Error Path: Cancel experiment returns 400 Bad Request because experiment is not 'running'
    response = await async_client.delete(f"/api/v1/projects/{sample_project.id}/experiments/{experiment_id}/cancel")
    assert response.status_code == 400

    # Error Path: Create experiment with unsupported model key
    bad_payload = {
        "pipeline_id": sample_pipeline.id,
        "automl_enabled": True,
        "optimize_metric": "f1",
        "candidate_models": ["invalid_model_type_key"],
    }
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/experiments",
        json=bad_payload,
    )
    assert response.status_code == 400


# =============================================================================
# §2.5 Model Evaluation Endpoints & §2.6 Leaderboard Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_evaluation_and_leaderboard_scenarios(
    async_client: AsyncClient,
    db_session,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify Evaluation and Leaderboard endpoints (Happy path and Error path)."""
    # Setup test models in db
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_test_9099",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"f1": 0.85, "accuracy": 0.88, "precision": 0.84, "recall": 0.86}),
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    evaluation = Evaluation(
        run_id=run.id,
        split="test",
        metrics_json=json.dumps({"f1": 0.85, "accuracy": 0.88, "precision": 0.84, "recall": 0.86}),
        confusion_matrix_json=json.dumps({"tn": 100, "fp": 5, "fn": 7, "tp": 95}),
        threshold=0.5,
    )
    db_session.add(evaluation)
    await db_session.commit()

    # Setup predictions.parquet file to allow threshold adjustment recalculation
    import pandas as pd
    from openneural_backend.config import Settings
    run_dir = Settings.get().data_dir / "experiments" / experiment.id / "runs" / run.id
    run_dir.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame({
        "y_true": [0, 1, 0, 1],
        "y_pred": [0, 1, 0, 1],
        "y_proba": [0.1, 0.9, 0.2, 0.8]
    })
    df.to_parquet(run_dir / "predictions.parquet")

    # Happy Path: Get evaluation details
    response = await async_client.get(f"/api/v1/experiments/{experiment.id}/evaluation")
    assert response.status_code == 200
    assert response.json()["best_model_type"] == "logistic_regression"

    # Happy Path: Adjust decision threshold
    response = await async_client.post(
        f"/api/v1/experiments/{experiment.id}/evaluation/threshold",
        json={"threshold": 0.45},
    )
    assert response.status_code == 200
    assert "f1" in response.json()

    # Happy Path: Get leaderboard
    response = await async_client.get(f"/api/v1/projects/{sample_project.id}/leaderboard")
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # Error Path: Get evaluation for non-existent experiment
    response = await async_client.get(f"/api/v1/experiments/invalid_id/evaluation")
    assert response.status_code == 404


# =============================================================================
# §2.6 Exports Endpoints
# =============================================================================

@pytest.mark.anyio
async def test_exports_endpoints_scenarios(
    async_client: AsyncClient,
    db_session,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_path: Path,
) -> None:
    """Verify Exports endpoints (Happy path and Error path)."""
    # Setup test models in db
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_test_8088",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"f1": 0.85}),
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    # Train a quick LogisticRegression model & write it to runs folder to prevent actual export missing file failure
    from openneural_backend.config import Settings
    import joblib
    from sklearn.linear_model import LogisticRegression
    import numpy as np
    
    run_dir = Settings.get().data_dir / "experiments" / experiment.id / "runs" / run.id
    run_dir.mkdir(parents=True, exist_ok=True)
    model = LogisticRegression()
    model.fit(np.array([[1.0], [2.0]]), np.array([0, 1]))
    joblib.dump(model, run_dir / "model.joblib")

    # Happy Path: Export artifacts
    dest_dir = tmp_path / "exports"
    export_payload = {
        "artifacts": ["model", "pipeline"],
        "destination_dir": str(dest_dir),
        "formats": {"model": ["joblib"]},
    }
    response = await async_client.post(
        f"/api/v1/experiments/{experiment.id}/export",
        json=export_payload,
    )
    assert response.status_code == 200
    assert "exports" in response.json()

    # Error Path: Export with missing artifacts list
    bad_payload = {
        "destination_dir": str(dest_dir),
    }
    response = await async_client.post(
        f"/api/v1/experiments/{experiment.id}/export",
        json=bad_payload,
    )
    assert response.status_code == 422


# =============================================================================
# SSE Training Stream Testing (Task 230)
# =============================================================================

@pytest.mark.anyio
async def test_sse_training_stream(
    async_client: AsyncClient,
    db_session,
    tmp_data_dir: Path,
) -> None:
    """Verify Server-Sent Events (SSE) training stream under a real training run.

    1. Starts a real training run on a small synthetic dataset.
    2. Collects SSE events via stream() until the 'done' event is received.
    3. Asserts all expected model status updates and fields were emitted.
    """
    import asyncio
    import hashlib
    from sklearn.datasets import make_classification
    import pandas as pd
    from openneural_backend.db.models import DatasetSnapshot, Pipeline, Project

    # 1. Generate small synthetic classification dataset (20 samples, 2 features)
    X, y = make_classification(
        n_samples=20,
        n_features=2,
        n_informative=2,
        n_redundant=0,
        n_classes=2,
        random_state=42
    )
    df = pd.DataFrame(X, columns=["feat_1", "feat_2"])
    df["target"] = y

    # 2. Save to the function's unique temporary directory
    parquet_path = tmp_data_dir / "synthetic_sse.parquet"
    df.to_parquet(parquet_path)

    # 3. Compute correct file checksum for the snapshot
    with open(parquet_path, "rb") as f:
        checksum = hashlib.sha256(f.read()).hexdigest()

    # 4. Provision models in db (using list of dicts for schema)
    project = Project(
        name="SSE Integration Project",
        task_type="classification",
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)

    snapshot = DatasetSnapshot(
        project_id=project.id,
        version_label="Snapshot v1",
        original_path="/path/to/original.csv",
        stored_path=str(parquet_path),
        file_name="original.csv",
        file_size_bytes=parquet_path.stat().st_size,
        row_count=len(df),
        col_count=len(df.columns),
        schema_json=json.dumps([
            {"name": "feat_1", "inferred_type": "float"},
            {"name": "feat_2", "inferred_type": "float"},
            {"name": "target", "inferred_type": "integer"}
        ]),
        checksum_sha256=checksum,
    )
    db_session.add(snapshot)
    await db_session.commit()
    await db_session.refresh(snapshot)

    pipeline = Pipeline(
        project_id=project.id,
        snapshot_id=snapshot.id,
        name="SSE Pipeline",
        config_json='{"blocks": []}',
        validated=1,
    )
    db_session.add(pipeline)
    await db_session.commit()
    await db_session.refresh(pipeline)

    # 5. Create AutoML experiment
    create_payload = {
        "pipeline_id": pipeline.id,
        "automl_enabled": True,
        "optimize_metric": "f1",
        "automl_config": {
            "max_trials": 1,
            "cv_folds": 2,
            "time_budget_minutes": 1,
        },
        "candidate_models": ["logistic_regression"],
    }
    response = await async_client.post(
        f"/api/v1/projects/{project.id}/experiments",
        json=create_payload,
    )
    assert response.status_code == 201
    experiment_id = response.json()["id"]

    collected_events = []

    # 6. Define stream consumer function
    async def consume_stream():
        from openneural_backend.routers.stream import stream_experiment_updates
        stream_res = await stream_experiment_updates(experiment_id, session=db_session)
        async for chunk in stream_res.body_iterator:
            if isinstance(chunk, bytes):
                chunk = chunk.decode("utf-8")
            for line in chunk.splitlines():
                if line.startswith("data: "):
                    event_data = json.loads(line[6:])
                    collected_events.append(event_data)
                    # Break out once we hit a terminal event
                    if event_data.get("payload", {}).get("status") in ("done", "cancelled", "interrupted"):
                        return

    # 7. Start stream consumer in the background
    consumer_task = asyncio.create_task(consume_stream())

    # Wait briefly for subscription queue setup to complete
    await asyncio.sleep(0.1)

    # 8. Start real AutoML training run
    start_response = await async_client.post(
        f"/api/v1/projects/{project.id}/experiments/{experiment_id}/start"
    )
    assert start_response.status_code == 200

    # 9. Wait for training progress and stream events to finish with timeout
    await asyncio.wait_for(consumer_task, timeout=15.0)

    # 10. Assertions on emitted SSE status updates
    assert len(collected_events) > 0

    statuses = [event.get("payload", {}).get("status") for event in collected_events]
    assert "running" in statuses
    assert "done" in statuses

    # Verify each event schema matches the push requirements
    for event in collected_events:
        assert event["type"] == "status_update"
        payload = event["payload"]
        assert "status" in payload
        assert "progress_pct" in payload
        assert "cpu_pct" in payload
        assert "ram_used_gb" in payload
        assert "ram_total_gb" in payload
        assert "runs" in payload

        # Verify per-model status is listed
        runs = payload["runs"]
        assert isinstance(runs, list)
        if payload["status"] == "done":
            assert len(runs) > 0
            assert runs[0]["model_type"] == "logistic_regression"
            assert runs[0]["status"] == "done"


# =============================================================================
# Crash Recovery Testing (Task 231)
# =============================================================================

@pytest.mark.anyio
async def test_crash_recovery_integration(
    async_client: AsyncClient,
    db_session,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_data_dir: Path,
) -> None:
    """Verify system crash recovery and marking run-interrupted experiments.

    1. Starts an experiment.
    2. Kills the backend mid-training (using ShutdownManager).
    3. Restarts the backend (using a fresh client).
    4. Asserts that the interrupted experiment is listed in GET /interrupted.
    """
    import asyncio
    from unittest.mock import patch
    from openneural_backend.shutdown import ShutdownManager
    from httpx import ASGITransport

    # Setup AutoML experiment configuration
    create_payload = {
        "pipeline_id": sample_pipeline.id,
        "automl_enabled": False,
        "optimize_metric": "f1",
        "candidate_models": ["logistic_regression"],
    }
    response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/experiments",
        json=create_payload,
    )
    assert response.status_code == 201
    experiment_id = response.json()["id"]

    # Mock long-running trainer to ensure it remains running mid-test
    async def mock_long_running(exp_id: str) -> None:
        await asyncio.sleep(100.0)

    # 1. Start the experiment
    with patch(
        "openneural_backend.orchestrator.experiment_manager.verify_snapshot_checksum",
        return_value=True,
    ), patch(
        "openneural_backend.orchestrator.trainer.run_experiment",
        side_effect=mock_long_running,
    ):
        start_res = await async_client.post(
            f"/api/v1/projects/{sample_project.id}/experiments/{experiment_id}/start"
        )
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "running"

        # 2. "Kill" the backend process mid-training via the ShutdownManager
        # This will write status="interrupted" to SQLite for any active "running" models
        shutdown_mgr = ShutdownManager(data_dir=str(tmp_data_dir))
        shutdown_mgr._mark_running_experiments_as_interrupted()

    # 3. "Restart" the backend by creating a brand new ASGI application and AsyncClient
    from openneural_backend.app import create_app
    restarted_app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=restarted_app),
        base_url="http://testserver",
        headers={"X-OpenNeural-Secret": "test_secret_for_ipc_auth_42"},
    ) as restarted_client:

        # 4. Call GET /api/v1/experiments/interrupted
        recovery_res = await restarted_client.get("/api/v1/experiments/interrupted")
        assert recovery_res.status_code == 200
        data = recovery_res.json()

        # 5. Assert the interrupted experiment is listed
        assert data["count"] >= 1
        interrupted_ids = [exp["id"] for exp in data["experiments"]]
        assert experiment_id in interrupted_ids

        # Assert full details are present
        exp_summary = next(exp for exp in data["experiments"] if exp["id"] == experiment_id)
        assert exp_summary["status"] == "interrupted"
        assert exp_summary["project_id"] == sample_project.id
        assert exp_summary["project_name"] == sample_project.name


# =============================================================================
# Checksum Mismatch Testing (Task 232)
# =============================================================================

@pytest.mark.anyio
async def test_checksum_mismatch_integration(
    async_client: AsyncClient,
    db_session,
    sample_project: Project,
    tmp_data_dir: Path,
) -> None:
    """Verify that manually corrupting a snapshot Parquet file triggers a ChecksumMismatchError on start.

    1. Writes a valid small Parquet file.
    2. Inserts a DatasetSnapshot, Pipeline, and Experiment referencing it.
    3. Manually corrupts the Parquet file (writes invalid data).
    4. Attempts to start the training run.
    5. Asserts the run is aborted with a 500 error containing the ChecksumMismatchError details.
    """
    import hashlib
    import pandas as pd
    from openneural_backend.db.models import DatasetSnapshot, Pipeline, Experiment
    import json

    # 1. Create a valid small dataset Parquet file
    df = pd.DataFrame({"feat_1": [1.0, 2.0], "target": [0, 1]})
    parquet_path = tmp_data_dir / "checksum_mismatch.parquet"
    df.to_parquet(parquet_path)

    # 2. Compute correct sha256 checksum
    with open(parquet_path, "rb") as f:
        correct_checksum = hashlib.sha256(f.read()).hexdigest()

    # 3. Create DatasetSnapshot, Pipeline, and Experiment
    snapshot = DatasetSnapshot(
        project_id=sample_project.id,
        version_label="Snapshot Checksum Test",
        original_path=str(parquet_path),
        stored_path=str(parquet_path),
        file_name="checksum_mismatch.parquet",
        file_size_bytes=parquet_path.stat().st_size,
        row_count=2,
        col_count=2,
        schema_json=json.dumps([
            {"name": "feat_1", "inferred_type": "float"},
            {"name": "target", "inferred_type": "integer"}
        ]),
        checksum_sha256=correct_checksum,
    )
    db_session.add(snapshot)
    await db_session.commit()
    await db_session.refresh(snapshot)

    pipeline = Pipeline(
        project_id=sample_project.id,
        snapshot_id=snapshot.id,
        name="Checksum Pipeline",
        config_json='{"blocks": []}',
        validated=1,
    )
    db_session.add(pipeline)
    await db_session.commit()
    await db_session.refresh(pipeline)

    experiment = Experiment(
        experiment_id_human="exp_checksum_mismatch_test",
        project_id=sample_project.id,
        pipeline_id=pipeline.id,
        status="created",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    # 4. Manually corrupt the Parquet file
    with open(parquet_path, "wb") as f:
        f.write(b"corrupted invalid parquet data")

    # 5. Attempt to start the training run
    start_response = await async_client.post(
        f"/api/v1/projects/{sample_project.id}/experiments/{experiment.id}/start"
    )

    # 6. Assert that starting the run is aborted with a 500 ChecksumMismatchError response
    assert start_response.status_code == 500
    payload = start_response.json()
    assert "detail" in payload
    assert "Checksum mismatch" in payload["detail"]


# =============================================================================
# Leaderboard Performance Testing (Task 233)
# =============================================================================

@pytest.mark.anyio
async def test_leaderboard_sorting_performance(
    async_client: AsyncClient,
    db_session,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify leaderboard sorting performance with 1,000 experiment records.

    1. Bulk inserts 1,000 experiments and 1,000 runs inside a transaction.
    2. Calls GET /api/v1/projects/{id}/leaderboard?sort_by=f1&order=desc.
    3. Asserts response time < 500ms and verifies elements are correctly sorted.
    """
    import json
    import time
    from datetime import datetime
    from openneural_backend.db.models import Experiment, Run

    # Generate 1,000 experiment records and 1,000 run records
    experiments = []
    runs = []
    for i in range(1000):
        exp_id = f"exp_perf_{i:04d}"
        experiment = Experiment(
            id=exp_id,
            experiment_id_human=f"exp_hum_{i:04d}",
            project_id=sample_project.id,
            pipeline_id=sample_pipeline.id,
            status="done",
            automl_enabled=False,
            optimize_metric="f1",
            automl_config_json="{}",
            candidate_models="logistic_regression",
            created_at=datetime.utcnow(),
        )
        run = Run(
            id=f"run_perf_{i:04d}",
            experiment_id=exp_id,
            model_type="logistic_regression",
            status="done",
            hyperparams_json="{}",
            test_metrics_json=json.dumps({
                "f1": 0.5 + (i % 100) / 200.0,
                "auc_roc": 0.6,
                "precision": 0.7,
                "recall": 0.8,
            }),
            training_time_sec=10.0 + i,
        )
        experiments.append(experiment)
        runs.append(run)

    # Bulk insert
    db_session.add_all(experiments)
    await db_session.commit()
    db_session.add_all(runs)
    await db_session.commit()

    # Measure API call latency
    start_time = time.perf_counter()
    response = await async_client.get(
        f"/api/v1/projects/{sample_project.id}/leaderboard",
        params={"sort_by": "f1", "order": "desc"}
    )
    duration_ms = (time.perf_counter() - start_time) * 1000.0

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1000

    # Ensure response time is strictly below 500ms
    assert duration_ms < 500.0, f"Leaderboard sorting took too long: {duration_ms:.1f}ms"

    # Verify sorting order (descending by F1)
    f1_scores = [entry["metrics"].get("f1") for entry in data]
    assert all(f1_scores[i] >= f1_scores[i+1] for i in range(len(f1_scores)-1))

