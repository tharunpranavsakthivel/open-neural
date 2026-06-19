# OpenNeural v0.1.0 — Implementation Tasks

---

## Project Setup & Repository Structure

- Task 1: Initialize a monorepo root with three workspaces: `electron/` (Electron main process + renderer shell), `frontend/` (React + TypeScript renderer), and `backend/` (Python FastAPI ML service).
- Task 2: Create root `package.json` with workspace definitions, shared dev-dependency scripts (`dev`, `build`, `test`), and a top-level `Makefile` with targets: `install`, `dev`, `build`, `test`, `package`.
- Task 3: Initialize `frontend/` with Vite 5 configured for Electron renderer mode (`base: './'`, no HMR server port conflicts); add `tsconfig.json` targeting React 18 + TypeScript 5 with strict mode enabled.
- Task 4: Initialize `electron/` as a Node.js project with TypeScript; configure `tsconfig.json` for CommonJS output targeting Node 20.
- Task 5: Initialize `backend/` as a Python 3.11 project; create `pyproject.toml` (or `setup.cfg`) defining the `openneural_backend` package with all entry points.
- Task 6: Create `backend/requirements.txt` pinning all runtime dependencies (fastapi≥0.110, uvicorn, sqlalchemy≥2.0, alembic, pandas≥2.0, pyarrow≥14, scikit-learn≥1.4, xgboost≥2.0, optuna≥3.5, joblib≥1.3, skl2onnx≥1.16, onnx≥1.16, reportlab≥4, bcrypt≥4, httpx, psutil) with exact version pins.
- Task 7: Create `backend/requirements.lock` with exact versions and SHA-256 hashes for all dependencies; add a verification script `scripts/verify_deps.py` that checks installed packages against the hash manife n st.
- Task 8: Create `backend/requirements-dev.txt` pinning pytest≥8, httpx, pytest-asyncio, pytest-cov.
- Task 9: Create `frontend/package.json` pinning react@18, typescript@5, vite@5, zustand@4, axios, @radix-ui/react-* primitives, vitest, @testing-library/react.
- Task 10: Create `electron/package.json` pinning electron@30, electron-builder@24.
- Task 11: Configure `electron-builder` in `electron/electron-builder.config.js` for targets: macOS `.dmg` (arm64 + x64), Windows `.exe` (NSIS), Linux `.AppImage` (x64).
- Task 12: Set up `.gitignore` ignoring `node_modules/`, `dist/`, `__pycache__/`, `*.pyc`, `build/`, `*.egg-info`, `.venv/`.
- Task 13: Create `scripts/bootstrap.sh` that installs all workspace dependencies (`npm install` + `pip install -r backend/requirements.txt`) and runs initial Alembic migration.
- Task 14: Create top-level `README.md` documenting dev environment setup, workspace structure, and how to run in development mode.

---

## Electron Main Process

- Task 15: Implement `electron/src/main.ts` as the Electron main process entry point; configure `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, and a `Content-Security-Policy` meta tag preventing inline scripts and external resource loading.
- Task 16: Implement `electron/src/auth.ts`: on first launch, detect absence of `~/openneural/openneural.db` auth record and open an in-renderer first-launch password setup dialog; on subsequent launches, open an in-renderer password prompt; validate the entered password against the bcrypt hash stored in the `auth` SQLite table (cost factor 12) before proceeding.
- Task 17: Implement ephemeral secret generation in `electron/src/main.ts`: generate a cryptographically random 32-byte hex string on every app start; inject it as the `OPENNEURAL_SECRET` environment variable when spawning the Python subprocess.
- Task 18: Implement Python subprocess lifecycle in `electron/src/process-manager.ts`: spawn `python -m openneural_backend --port 0 --data-dir ~/openneural/` as a child process; capture stdout line by line and parse the `OPENNEURAL_PORT=<port>` line to extract the dynamic port; store the port in memory.
- Task 19: Implement `ipcMain.handle('get-backend-port', () => resolvedPort)` so the renderer can retrieve the dynamic backend port via `contextBridge`.
- Task 20: Implement `ipcMain.handle('open-file-dialog', ...)` exposing Electron's `dialog.showOpenDialog` for CSV/Parquet file selection with MIME type filters.
- Task 21: Implement `ipcMain.handle('open-directory-dialog', ...)` exposing `dialog.showOpenDialog` for export destination directory selection.
- Task 22: Implement graceful shutdown in `electron/src/main.ts`: register `app.on('before-quit', ...)` to send `SIGTERM` to the Python subprocess; wait up to 5 seconds for process exit; send `SIGKILL` if the process has not exited after the timeout.
- Task 23: Implement `electron/src/preload.ts` defining a narrow `contextBridge.exposeInMainWorld('electronAPI', { getBackendPort, openFileDialog, openDirectoryDialog })` API; do not expose any other Node.js APIs to the renderer.
- Task 24: Configure Electron security: set `webPreferences` with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `allowRunningInsecureContent: false`; add CSP headers via `session.defaultSession.webRequest.onHeadersReceived`.
- Task 25: Implement `electron/src/window-state.ts` saving and restoring the last window size and position using a JSON file in `~/openneural/`.
- Task 26: Implement crash recovery check: on startup (after successful auth), call `GET /api/v1/experiments/interrupted` and, if any interrupted experiments are found, trigger an IPC message to the renderer to display the recovery prompt.

---

## Python FastAPI Backend — Application Bootstrap

- Task 27: Implement `backend/openneural_backend/__main__.py` as the CLI entry point accepting `--port` (default 0) and `--data-dir` arguments; if port is 0, bind to an OS-assigned ephemeral port; print `OPENNEURAL_PORT=<actual_port>` to stdout immediately after binding so the Electron main process can parse it.
- Task 28: Implement `backend/openneural_backend/app.py` creating the FastAPI application instance with title "OpenNeural API", version "0.1.0", and prefix `/api/v1` for all routers; enable CORS restricted to `http://127.0.0.1` origins only; bind the app to `127.0.0.1` exclusively (refuse `0.0.0.0`).
- Task 29: Implement `backend/openneural_backend/middleware/secret_auth.py`: a FastAPI middleware that reads the `X-OpenNeural-Secret` HTTP header on every incoming request; compares it using `hmac.compare_digest` against the expected secret from the `OPENNEURAL_SECRET` environment variable; returns `401 Unauthorized` on mismatch or absence.
- Task 30: Implement `backend/openneural_backend/middleware/request_logging.py`: log every request (method, path, status code, duration) to the daily rotating log file at `{data_dir}/logs/openneural_{date}.log`.
- Task 31: Implement `backend/openneural_backend/shutdown.py`: register `signal.SIGTERM` and `signal.SIGINT` handlers that flush all in-progress SQLAlchemy sessions, mark any `running` experiments as `interrupted` in the database, and perform a clean application exit.
- Task 32: Implement `backend/openneural_backend/config.py`: read `DATA_DIR` from the CLI argument and `OPENNEURAL_SECRET` from the environment; expose a `Settings` singleton used throughout the application; raise a startup error if either is missing.
- Task 33: Create `backend/openneural_backend/routers/` package containing separate router files: `projects.py`, `snapshots.py`, `pipelines.py`, `experiments.py`, `evaluation.py`, `leaderboard.py`, `exports.py`, `stream.py`; register all routers in `app.py`.

---

## Database & Migrations

- Task 34: Implement `backend/openneural_backend/db/engine.py`: create a SQLAlchemy 2.0 async engine pointed at `{data_dir}/openneural.db`; execute `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` on every new connection; provide `AsyncSession` factory via `async_sessionmaker`.
- Task 35: Implement `backend/openneural_backend/db/models.py` defining all 10 SQLAlchemy ORM models with exact column definitions, constraints, and relationships matching the TDD schema: `SchemaMigration`, `Auth`, `Project`, `DatasetSnapshot`, `Pipeline`, `Experiment`, `Run`, `Evaluation`, `SubgroupAnalysis`, `Export`.
- Task 36: Implement `backend/openneural_backend/db/models.py` — `Project` model: `id` (TEXT UUID PK), `name` (TEXT NOT NULL), `task_type` (TEXT CHECK IN `classification`, `regression`), `created_at`, `updated_at` with auto-update trigger.
- Task 37: Implement `backend/openneural_backend/db/models.py` — `DatasetSnapshot` model: all columns from TDD §3.4 including FK to `Project` with `ON DELETE CASCADE`, `UNIQUE (project_id, version_label)` constraint.
- Task 38: Implement `backend/openneural_backend/db/models.py` — `Pipeline` model: all columns from TDD §3.5 including FKs to `Project` (CASCADE) and `DatasetSnapshot`.
- Task 39: Implement `backend/openneural_backend/db/models.py` — `Experiment` model: all columns from TDD §3.6 including `status` CHECK constraint with valid states `created|running|done|cancelled|interrupted`; `experiment_id_human` UNIQUE; FKs to `Project` (CASCADE) and `Pipeline`.
- Task 40: Implement `backend/openneural_backend/db/models.py` — `Run` model: all columns from TDD §3.7 including `status` CHECK constraint `queued|running|done|failed`; FK to `Experiment` (CASCADE); create index `idx_runs_experiment_id`.
- Task 41: Implement `backend/openneural_backend/db/models.py` — `Evaluation` model: all columns from TDD §3.8 including `split` CHECK IN `val|test`, FK to `Run` (CASCADE).
- Task 42: Implement `backend/openneural_backend/db/models.py` — `SubgroupAnalysis` model: all columns from TDD §3.9 including FK to `Evaluation` (CASCADE).
- Task 43: Implement `backend/openneural_backend/db/models.py` — `Export` model: all columns from TDD §3.10 including `artifact_type` CHECK constraint.
- Task 44: Configure Alembic in `backend/alembic.ini` and `backend/alembic/env.py`; set `target_metadata = Base.metadata`; configure connection to use the runtime `DATA_DIR` path.
- Task 45: Create initial Alembic migration `backend/alembic/versions/0001_initial_schema.py` that applies all 10 table DDL statements as defined in the TDD; run this migration automatically on application startup via `alembic upgrade head`.
- Task 46: Implement `backend/openneural_backend/db/init.py`: called on startup, ensure `{data_dir}/` and all subdirectories (`snapshots/`, `pipelines/`, `experiments/`, `exports/`, `logs/`) exist; apply pending Alembic migrations; verify WAL mode is active.
- Task 47: Implement atomic transaction wrapper utility `backend/openneural_backend/db/transaction.py` using SQLAlchemy's `begin()` context manager; ensure all write operations across all services use this wrapper so partial writes are rolled back on exception.

---

## Projects API & Service

- Task 48: Implement `backend/openneural_backend/services/project_service.py` with methods: `create_project(name, task_type)`, `list_projects()`, `get_project(project_id)`, `rename_project(project_id, name)`, `delete_project(project_id)`, `get_dashboard_stats()`.
- Task 49: Implement `GET /api/v1/projects`: return all projects with `id`, `name`, `task_type`, `updated_at`, `experiment_count` (derived via subquery); order by `updated_at` DESC.
- Task 50: Implement `POST /api/v1/projects`: accept `{ "name": str, "task_type": "classification"|"regression" }`; validate task_type enum; insert record; return full project object with `experiment_count: 0`.
- Task 51: Implement `PATCH /api/v1/projects/{project_id}`: accept `{ "name": str }`; update `name` and `updated_at`; return updated project object.
- Task 52: Implement `DELETE /api/v1/projects/{project_id}`: cascade-delete all related snapshots, pipelines, experiments, runs, evaluations, and exports; return `{ "deleted": true }`.
- Task 53: Implement `GET /api/v1/dashboard/stats`: return `{ "total_experiments": int, "total_exports": int, "total_snapshots": int }` aggregated across all projects.
- Task 54: Add request validation using Pydantic v2 models for all project endpoints; return `422 Unprocessable Entity` with field-level error details on validation failure.

---

## Dataset Service & Snapshot API

- Task 55: Implement `backend/openneural_backend/services/dataset_service.py` with core methods: `import_file(project_id, upload_file)`, `get_snapshots(project_id)`, `get_snapshot(snapshot_id)`, `compute_checksum(path)`, `infer_schema(df)`, `profile_dataset(df)`.
- Task 56: Implement `POST /api/v1/projects/{project_id}/snapshots` as a `multipart/form-data` upload endpoint: accept `file` field; enforce 2 GB size limit (reject with descriptive error if exceeded); display a warning flag in the response if the file exceeds 500 MB.
- Task 57: Implement file ingestion in `dataset_service.py`: save the uploaded file to a temp path; compute SHA-256 checksum; convert to Parquet using `pandas` + `pyarrow` and write to `{data_dir}/snapshots/{snapshot_id}/data.parquet`; set OS file permissions to `0o600` on the Parquet file; write inferred schema to `{data_dir}/snapshots/{snapshot_id}/schema.json`.
- Task 58: Implement schema inference: for each column, detect Python/pandas dtype and map to OpenNeural types (`string`, `integer`, `float`, `categorical`, `boolean`); compute `null_pct` (null count / row count), `unique_count`; store result as a JSON array of `{ name, inferred_type, null_pct, unique_count }`.
- Task 59: Implement dataset profiling: record `row_count`, `col_count`, `file_size_bytes`, `file_name`, SHA-256 checksum, and UTC `created_at` timestamp.
- Task 60: Implement monotonic version label assignment: within a project, query `MAX(version_label)` to compute the next integer suffix; assign `Snapshot v{N}`.
- Task 61: Implement memory usage projection: estimate peak training RAM as `file_size_bytes * 8` (heuristic for pandas + sklearn overhead); compare to `psutil.virtual_memory().available`; if projection exceeds 75% of available RAM, include `{ "memory_warning": true, "memory_warning_message": "..." }` in the snapshot response.
- Task 62: Implement `GET /api/v1/projects/{project_id}/snapshots`: return list of all snapshots for the project with `id`, `version_label`, `file_name`, `row_count`, `created_at`; order by `created_at` ASC.
- Task 63: Implement `GET /api/v1/projects/{project_id}/snapshots/{snapshot_id}`: return full snapshot record including `schema_json` and `checksum_sha256`.
- Task 64: Implement checksum verification utility `verify_snapshot_checksum(snapshot_id)`: recompute SHA-256 of `data.parquet`; compare to stored value; raise `ChecksumMismatchError` if different.

---

## Preprocessing Pipeline Engine

- Task 65: Implement `backend/openneural_backend/pipeline/block_interface.py` defining an abstract base class `PipelineBlock` with methods `fit(X, y)`, `transform(X)`, `fit_transform(X, y)`, `to_sklearn()` returning a scikit-learn transformer, and class-level `block_type: str` and `param_schema: dict` attributes; all new blocks must subclass this without modifying the engine.
- Task 66: Implement `backend/openneural_backend/pipeline/blocks/drop_nulls.py`: `DropNullsBlock` with optional `columns` param (all columns if empty); wraps a custom transformer that drops rows with nulls in specified columns.
- Task 67: Implement `backend/openneural_backend/pipeline/blocks/fill_missing.py`: `FillMissingMeanBlock` and `FillMissingMedianBlock`; wraps `SimpleImputer(strategy='mean'|'median')` for specified numeric columns; handles column selection via `ColumnTransformer`.
- Task 68: Implement `backend/openneural_backend/pipeline/blocks/encode_categoricals.py`: `EncodeCategoricalsOneHotBlock` wrapping `OneHotEncoder(handle_unknown='ignore', sparse_output=False)` and `EncodeCategoricalsOrdinalBlock` wrapping `OrdinalEncoder`; accept `columns` param.
- Task 69: Implement `backend/openneural_backend/pipeline/blocks/scale_numerics.py`: `ScaleNumericStandardBlock` wrapping `StandardScaler` and `ScaleNumericMinMaxBlock` wrapping `MinMaxScaler`; accept `columns` param.
- Task 70: Implement `backend/openneural_backend/pipeline/blocks/log_transform.py`: `LogTransformBlock` applying `np.log1p` to specified numeric columns; implement as a custom scikit-learn transformer with `FunctionTransformer`.
- Task 71: Implement `backend/openneural_backend/pipeline/blocks/remove_outliers.py`: `RemoveOutliersIQRBlock` with configurable `iqr_multiplier` (default 1.5) for specified columns; filters rows outside `[Q1 - k*IQR, Q3 + k*IQR]` range.
- Task 72: Implement `backend/openneural_backend/pipeline/blocks/feature_selection.py`: `FeatureSelectionBlock` accepting a `columns` list of column names to drop; wraps `ColumnTransformer` or `FunctionTransformer`.
- Task 73: Implement `backend/openneural_backend/pipeline/blocks/split.py`: `TrainValTestSplitBlock` with params `train` (default 0.70), `val` (default 0.15), `test` (default 0.15), `stratify_column` (optional); validates ratios sum to 1.0; not a scikit-learn transformer but a pipeline stage that partitions the dataset and returns `(X_train, X_val, X_test, y_train, y_val, y_test)`.
- Task 74: Implement `backend/openneural_backend/pipeline/registry.py`: a `BLOCK_REGISTRY` dict mapping `block_type` strings to block classes; provide `register_block(cls)` decorator and `get_block(block_type)` lookup; all 11 block types registered at import time.
- Task 75: Implement `backend/openneural_backend/pipeline/builder.py` — `build_sklearn_pipeline(config_json)`: parse the ordered blocks array from JSON; instantiate each block class from the registry; compose a scikit-learn `Pipeline` object from the pre-split blocks; return the pipeline and the split config separately.
- Task 76: Implement `backend/openneural_backend/pipeline/validator.py` — `validate_pipeline(blocks)`: check that `TrainValTestSplitBlock` is the last block if present; check no incompatible ordering (e.g. scaling before imputation); check referenced columns exist in the snapshot schema; return `{ valid: bool, warnings: list, errors: list }`.
- Task 77: Implement `POST /api/v1/projects/{project_id}/pipelines`: accept pipeline config JSON; validate referenced `snapshot_id` exists; run `validate_pipeline`; serialize and store `config_json` in the `pipelines` table; return pipeline record with `validated` flag.
- Task 78: Implement `GET /api/v1/projects/{project_id}/pipelines/{pipeline_id}/validate`: re-run `validate_pipeline` against the stored config and current snapshot schema; return validation result.
- Task 79: Implement `GET /api/v1/projects/{project_id}/pipelines`: return list of all pipelines for the project.
- Task 80: Implement `GET /api/v1/projects/{project_id}/pipelines/{pipeline_id}`: return full pipeline record including `config_json`.

---

## Model Registry & AutoML Search Spaces

- Task 81: Implement `backend/openneural_backend/models/registry.py` defining `MODEL_REGISTRY` as a dict mapping model key strings to dataclasses containing: `model_class` (sklearn/XGBoost estimator class), `task_types` (list of applicable task types), `default_params` (dict), and `search_space` (Optuna param spec); expose `get_model(key)`, `list_models(task_type)`, `register_model(key, spec)`.
- Task 82: Register classification models in `MODEL_REGISTRY`: `logistic_regression` → `LogisticRegression`, `random_forest` → `RandomForestClassifier`, `gradient_boosting` → `GradientBoostingClassifier`, `xgboost` → `XGBClassifier`, `svm` → `SVC(probability=True)`, `knn` → `KNeighborsClassifier`.
- Task 83: Register regression models in `MODEL_REGISTRY`: `ridge_regression` → `Ridge`, `random_forest_regressor` → `RandomForestRegressor`, `gradient_boosting_regressor` → `GradientBoostingRegressor`, `xgboost_regressor` → `XGBRegressor`, `svr` → `SVR`, `knn_regressor` → `KNeighborsRegressor`.
- Task 84: Define Optuna search spaces for all models matching TDD §4.4: `random_forest` → `n_estimators` (int, 50–500), `max_depth` (int, 3–20), `min_samples_split` (int, 2–20); `xgboost` → `n_estimators` (int, 50–500), `max_depth` (int, 3–10), `learning_rate` (float, 0.01–0.3), `subsample` (float, 0.5–1.0); `gradient_boosting` → `n_estimators` (int, 50–300), `max_depth` (int, 2–8), `learning_rate` (float, 0.01–0.3); `logistic_regression` → `C` (float, log-scale, 1e-3–1e3); `svm` → `C` (float, log-scale, 1e-2–1e2), `gamma` (categorical, `scale|auto`); `knn` → `n_neighbors` (int, 3–25), `weights` (categorical, `uniform|distance`).
- Task 85: Implement `backend/openneural_backend/models/optuna_adapter.py` — `build_optuna_objective(model_key, X_train, y_train, cv_folds, metric)`: return a callable `objective(trial)` that suggests hyperparameters from the model's search space, instantiates the model, runs `cross_val_score` with the specified CV folds and scoring metric, and returns the mean CV score.
- Task 86: Implement metric scoring mapping in `optuna_adapter.py`: map `f1` → `f1_weighted`, `auc_roc` → `roc_auc`, `precision` → `precision_weighted`, `recall` → `recall_weighted` (classification); `rmse` → `neg_root_mean_squared_error`, `mae` → `neg_mean_absolute_error`, `r2` → `r2` (regression).

---

## Training Orchestrator

- Task 87: Implement `backend/openneural_backend/orchestrator/experiment_manager.py` — `create_experiment(project_id, pipeline_id, config)`: generate human-readable experiment ID in format `exp_[4-char-alphanumeric]_[MMDD]`; insert experiment record with status `created`; return experiment object.
- Task 88: Implement `POST /api/v1/projects/{project_id}/experiments`: validate that the referenced `pipeline_id` belongs to the project; validate `candidate_models` are all registered in `MODEL_REGISTRY` for the project's task type; create experiment record; return `{ id, experiment_id_human, status: "created", created_at }`.
- Task 89: Implement `POST /api/v1/experiments/{experiment_id}/start`: verify snapshot checksum via `verify_snapshot_checksum` before starting; mark experiment as `running`; spawn training coroutine via `asyncio.create_task`; return `{ status: "running", started_at }`.
- Task 90: Implement `backend/openneural_backend/orchestrator/trainer.py` — `run_experiment(experiment_id)` async function: load snapshot Parquet file; build scikit-learn pipeline from config; execute train/val/test split; submit one Optuna study per candidate model to a `ProcessPoolExecutor`; as each study completes, update run record in SQLite; compute test-set metrics for the best trial; persist all results; mark experiment as `done`.
- Task 91: Implement process pool executor management in `trainer.py`: use `concurrent.futures.ProcessPoolExecutor(max_workers=cpu_count())` to bypass Python GIL and enable true parallel model training.
- Task 92: Implement periodic state persistence in `trainer.py`: every 60 seconds during training, flush in-progress run records to SQLite so a crash loses at most 60 seconds of completed work.
- Task 93: Implement `GET /api/v1/experiments/{experiment_id}/status`: return `{ status, progress_pct, cpu_pct, ram_used_gb, ram_total_gb, runs: [{ model_type, status, metrics }] }`; compute `progress_pct` as `done_runs / total_runs * 100`; read CPU and RAM from `psutil`.
- Task 94: Implement `DELETE /api/v1/experiments/{experiment_id}/cancel`: cancel the `asyncio.Task` for the experiment; kill all child processes in the `ProcessPoolExecutor` for that experiment; mark all `queued` and `running` runs as `failed`; mark experiment as `cancelled`; discard partial results.
- Task 95: Implement `GET /api/v1/experiments/interrupted`: return all experiments with status `interrupted` across all projects; used by Electron main process for crash recovery detection.
- Task 96: Implement `PATCH /api/v1/experiments/{experiment_id}/recover`: accept `{ "action": "restart"|"discard" }`; if restart, reset status to `created` and clear partial run data; if discard, mark as `cancelled`.
- Task 97: Implement training time estimation in `backend/openneural_backend/orchestrator/estimator.py` — `estimate_training_time(row_count, feature_count, candidate_count, automl_config)`: apply a heuristic formula based on dataset size and model count; return estimated seconds; expose via `GET /api/v1/experiments/{experiment_id}/estimate`.

---

## Evaluation Service

- Task 98: Implement `backend/openneural_backend/services/evaluation_service.py` with methods: `compute_classification_metrics(y_true, y_pred, y_proba, threshold)`, `compute_regression_metrics(y_true, y_pred)`, `compute_confusion_matrix(y_true, y_pred)`, `compute_subgroup_analysis(df, y_true, y_pred, feature_cols)`, `identify_best_run(experiment_id)`.
- Task 99: Implement `compute_classification_metrics`: compute F1 (weighted), AUC-ROC (using `y_proba`), Precision (weighted), Recall (weighted) using scikit-learn metrics; apply the specified decision threshold to `y_proba` before computing threshold-dependent metrics.
- Task 100: Implement `compute_regression_metrics`: compute RMSE (via `mean_squared_error(squared=False)`), MAE, R²; also compute residuals array `(y_pred - y_true)` for the residual plot.
- Task 101: Implement `compute_confusion_matrix`: for binary classification, return `{ tn, fp, fn, tp }` from `confusion_matrix().ravel()`; for multiclass, return the full N×N matrix as a 2D JSON array with class labels.
- Task 102: Implement `compute_subgroup_analysis`: accept up to 10 feature columns or auto-detect top categorical columns; for each unique value group, compute group-level F1, Recall, and sample count; flag any subgroup where `group_f1 < overall_f1 - 0.15` with `{ "fairness_warning": true }`.
- Task 103: Implement `identify_best_run(experiment_id)`: query all `done` runs for the experiment; rank by `test_metrics_json[optimize_metric]`; return the run with the highest score; store result in `evaluations` table with `split="test"`.
- Task 104: Implement `GET /api/v1/experiments/{experiment_id}/evaluation`: call `identify_best_run`; load confusion matrix, subgroup analyses, and metrics from the `evaluations` and `subgroup_analyses` tables; return the full evaluation response object as specified in TDD §2.5.
- Task 105: Implement `POST /api/v1/experiments/{experiment_id}/evaluation/threshold`: accept `{ "threshold": float }` (validate range 0.10–0.90, step 0.05); re-run `compute_classification_metrics` with the new threshold using the stored test-set `y_proba`; return updated `{ precision, recall, f1 }`; ensure response latency ≤ 200ms by loading predictions from a precomputed file rather than rerunning the model.
- Task 106: Store test-set predictions (`y_true`, `y_pred`, `y_proba` columns) as a Parquet file under `{data_dir}/experiments/{experiment_id}/runs/{run_id}/predictions.parquet` during training so threshold queries can be served without re-inference.

---

## Export Service

- Task 107: Implement `backend/openneural_backend/services/export_service.py` with methods: `export_model_onnx(run_id, dest_dir)`, `export_model_joblib(run_id, dest_dir)`, `export_pipeline_joblib(run_id, dest_dir)`, `export_report_pdf(experiment_id, dest_dir)`, `export_predictions_csv(run_id, dest_dir)`, `export_all(experiment_id, dest_dir, formats)`, `generate_manifest(dest_dir, exported_files)`.
- Task 108: Implement `export_model_onnx`: load the fitted model from `model.joblib`; attempt ONNX conversion via `skl2onnx.convert_sklearn` with `target_opset=17`; write to `{dest_dir}/{model_type}.onnx`; if conversion fails (unsupported model), log a warning and skip ONNX export without raising an error.
- Task 109: Implement `export_model_joblib`: copy `model.joblib` from the run artifact directory to `{dest_dir}/{model_type}.joblib`.
- Task 110: Implement `export_pipeline_joblib`: copy `pipeline.joblib` from the run artifact directory to `{dest_dir}/pipeline.joblib`.
- Task 111: Implement `export_report_pdf` using `reportlab`: compose a structured PDF containing sections: cover page with experiment ID and timestamp, experiment metadata table, dataset snapshot info (version label, row count, schema summary), pipeline configuration summary (ordered block list with params), metric summary table (all metrics), confusion matrix (rendered as a colored grid), subgroup analysis table (with fairness flag indicators), decision threshold selection note; write to `{dest_dir}/report.pdf`.
- Task 112: Implement `export_predictions_csv`: load stored predictions Parquet; write CSV with columns `row_index`, `predicted_label`, `true_label`, and one column per class for `prob_{class}`; write to `{dest_dir}/predictions.csv`.
- Task 113: Implement `generate_manifest`: for each exported file, compute SHA-256 checksum; write `{dest_dir}/export_manifest.json` containing `{ exported_at, experiment_id, artifacts: [{ type, path, size_bytes, checksum_sha256 }] }`.
- Task 114: Implement `POST /api/v1/experiments/{experiment_id}/export`: accept `{ artifacts, destination_dir, formats: { model: ["onnx","joblib"] } }`; validate `destination_dir` is writable; execute requested exports sequentially; call `generate_manifest`; insert records into the `exports` table with checksums; return full export result object as specified in TDD §2.7.
- Task 115: Persist each export record in the `exports` table with `artifact_type`, `file_path`, `file_size_bytes`, `checksum_sha256` immediately after each file is written.

---

## Leaderboard API

- Task 116: Implement `GET /api/v1/projects/{project_id}/leaderboard`: accept query params `sort_by` (default `f1`, allowed: `f1|auc_roc|precision|recall|training_time`) and `order` (default `desc`, allowed: `asc|desc`); join `experiments` → `runs` → `evaluations`; extract per-experiment best run metrics; return sorted list with `is_best` flag on the top experiment by the sort metric; validate sort performance ≤ 500ms for up to 1,000 experiments.
- Task 117: Implement `is_best` flag computation: compare each experiment's primary optimization metric against all others in the project; mark the highest as `is_best: true`.

---

## Server-Sent Events (SSE) for Training Progress

- Task 118: Implement `GET /api/v1/experiments/{experiment_id}/stream` as a FastAPI `StreamingResponse` with `media_type="text/event-stream"`; emit SSE events with data `{ type: "status_update", payload: <status_object> }` whenever a run status changes or CPU/RAM metrics are sampled; close the stream when the experiment reaches a terminal state (`done|cancelled|interrupted`).
- Task 119: Implement a pub/sub mechanism (using `asyncio.Queue` per experiment) in `backend/openneural_backend/orchestrator/event_bus.py`; the training orchestrator publishes events to the queue; the SSE handler consumes and emits them; remove the queue when the stream closes.

---

## Security Implementation

- Task 120: Implement bcrypt password hashing in `backend/openneural_backend/services/auth_service.py`: `hash_password(plain)` using `bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))`; `verify_password(plain, stored_hash)` using `bcrypt.checkpw`; raise `AuthenticationError` on mismatch.
- Task 121: Implement first-launch password setup: on startup, check if the `auth` table has zero rows; if so, expose a `POST /api/v1/auth/setup` endpoint (available only before auth is configured) accepting `{ "password": str }`; hash and store; disable the endpoint after first use.
- Task 122: Implement `POST /api/v1/auth/verify` accepting `{ "password": str }` for session validation; called by the Electron main process before spawning the backend (note: the backend is already spawned at this point with the shared secret; auth is validated via the Electron preload, not the backend, per TDD §5.1); adjust the flow so the Electron main process reads the bcrypt hash from SQLite directly (using `better-sqlite3` in the main process) and validates the password before passing the secret.
- Task 123: Configure FastAPI `X-OpenNeural-Secret` middleware to exclude only the `/api/v1/auth/setup` endpoint from secret validation (allowing first-launch setup before the secret is established); reject all other requests without a valid secret.
- Task 124: Configure Electron `BrowserWindow` with `webSecurity: true`; set CSP via response headers: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http://127.0.0.1:*`.
- Task 125: Implement network isolation check in `app.py`: reject any request where `request.client.host` is not `127.0.0.1`; return `403 Forbidden` for external connections.
- Task 126: Implement SQLite WAL mode activation: in `db/engine.py`, after engine creation, run `PRAGMA journal_mode=WAL` and confirm the returned value is `wal`; log a warning if WAL activation fails.
- Task 127: Implement snapshot file permission enforcement: after writing `data.parquet`, call `os.chmod(path, 0o600)` on POSIX systems; on Windows, use `icacls` via `subprocess` to restrict read access to the current user only.
- Task 128: Implement export manifest SHA-256 checksums: compute `hashlib.sha256(file_bytes).hexdigest()` for each exported artifact; include in `export_manifest.json`.

---

## Frontend — Application Shell & Routing

- Task 129: Implement `frontend/src/main.tsx` as the React 18 entry point using `createRoot`; mount the `<App />` component into `#root`.
- Task 130: Implement `frontend/src/App.tsx`: on mount, call `window.electronAPI.getBackendPort()` and store the port in the Zustand `appStore`; render the `<AuthGate />` component which conditionally renders either the `<PasswordSetup />` screen, the `<LoginScreen />`, or the main `<AppShell />` based on auth state.
- Task 131: Implement `frontend/src/components/AppShell.tsx`: render the `<Sidebar />` navigation on the left and a `<main>` content area on the right; the content area renders the active wizard step or the projects dashboard.
- Task 132: Implement `frontend/src/components/Sidebar.tsx`: display the OpenNeural logo, app version (from `GET /api/v1/version`), and step-by-step navigation links (Projects, Import, Pipeline, Model, Train, Evaluate, Export); highlight the active step; allow navigation to any previously completed step without clearing unsaved config; implement keyboard navigation (arrow keys, Enter) for all nav items.
- Task 133: Implement `frontend/src/components/SessionFooter.tsx`: display the host machine's OS-reported name, total RAM (GB), and CPU model string; fetch once from `GET /api/v1/system/info` on mount.
- Task 134: Implement `GET /api/v1/system/info` backend endpoint: return `{ hostname, ram_total_gb, cpu_model, app_version }`; use `platform`, `psutil`, and `os` standard library modules.
- Task 135: Implement `frontend/src/components/ConfirmDialog.tsx`: a reusable modal dialog accepting `title`, `description`, `onConfirm`, `onCancel` props; render a visually distinct destructive warning for delete/discard/cancel actions; required before all destructive operations.

---

## Frontend — Auth Screens

- Task 136: Implement `frontend/src/screens/PasswordSetup.tsx`: render a password + confirmation password form; validate passwords match and meet minimum length (≥8 chars); on submit, call `POST /api/v1/auth/setup`; on success, transition to `LoginScreen` with a success toast.
- Task 137: Implement `frontend/src/screens/LoginScreen.tsx`: render a single password input field; on submit, call the Electron main process `ipcRenderer.invoke('validate-password', password)` which in turn validates against the bcrypt hash in SQLite; on success, obtain the ephemeral secret and transition to the main app; on failure, show an inline "Incorrect password" error message.
- Task 138: Implement keyboard-first auth flow: auto-focus the password input on mount; support Enter key for form submission on both auth screens.

---

## Frontend — Projects Dashboard

- Task 139: Implement `frontend/src/screens/ProjectsDashboard.tsx`: on mount, fetch `GET /api/v1/projects` and `GET /api/v1/dashboard/stats`; render a stats bar showing total experiments, total exports, and total snapshots; render a projects table with columns: name, task type, experiment count, last updated.
- Task 140: Implement `frontend/src/components/ProjectCard.tsx` (or table row): display project name, task type badge, experiment count, and last-updated timestamp; include "Open", "Rename", and "Delete" action buttons.
- Task 141: Implement `frontend/src/components/CreateProjectModal.tsx`: a modal with a project name text input and a task type selector (`Binary Classification`, `Multiclass Classification`, `Regression`); on submit, call `POST /api/v1/projects`; close modal and refresh project list on success.
- Task 142: Implement rename project flow: inline edit or modal; call `PATCH /api/v1/projects/{id}`; update project list on success.
- Task 143: Implement delete project flow: open `<ConfirmDialog />` with the message "Deleting this project will permanently remove all experiments, snapshots, and exports. This cannot be undone."; on confirm, call `DELETE /api/v1/projects/{id}`; remove project from list.
- Task 144: Implement empty state for the projects dashboard: when no projects exist, render a centered CTA with a "Create your first project" button and a brief description of the workflow.

---

## Frontend — Dataset Import Step

- Task 145: Implement `frontend/src/screens/DatasetImport.tsx`: render the step description "Upload a CSV or Parquet file to create a versioned dataset snapshot."; display a file drop zone accepting `.csv` and `.parquet` MIME types; include a "Browse Files" button triggering `window.electronAPI.openFileDialog`; display a warning if a file is not yet imported.
- Task 146: Implement drag-and-drop file handling in `DatasetImport.tsx`: accept `dragover`, `dragleave`, and `drop` events; validate file extension on drop; show a visual highlight on dragover.
- Task 147: Implement upload progress display: show a progress spinner or progress bar during file upload to `POST /api/v1/projects/{id}/snapshots`; display "Analyzing dataset…" during schema inference.
- Task 148: Implement schema inference result display in `frontend/src/components/SchemaTable.tsx`: render a table with columns: Column Name, Inferred Type, Null %, Unique Count; show a type badge (string, integer, float, boolean, categorical) with distinct colors per type.
- Task 149: Implement dataset summary cards below the schema table: display Row Count, Column Count, File Size, Snapshot Version, and Created At timestamp.
- Task 150: Implement memory warning banner in `DatasetImport.tsx`: if the snapshot response includes `memory_warning: true`, render a yellow warning banner with the advisory message and a link to "Dataset Sampling" documentation (placeholder for Phase 2).
- Task 151: Implement 500 MB warning banner: if `file_size_bytes > 524288000`, display a banner advising the user about potential training time and memory implications.
- Task 152: Implement snapshot history view in `frontend/src/components/SnapshotHistory.tsx`: render a collapsible panel listing all snapshots for the project with version label, row count, and created timestamp; allow the user to select a different snapshot as the base for a new pipeline.
- Task 153: Implement `GET /api/v1/projects/{project_id}/snapshots` fetch in `DatasetImport.tsx` on mount to pre-populate the history panel.

---

## Frontend — Preprocessing Pipeline Builder

- Task 154: Implement `frontend/src/screens/PipelineBuilder.tsx`: render the step description "Arrange preprocessing steps to clean, encode, and split your data."; display a vertical list of pipeline blocks; render a block palette (drawer or sidebar) from which users can add new blocks.
- Task 155: Implement drag-and-drop block reordering using a drag library (`@dnd-kit/core` or equivalent): each block is a draggable card; drop zones render between blocks; on reorder, update the local block order in Zustand.
- Task 156: Implement `frontend/src/components/PipelineBlock.tsx`: generic block card component accepting `blockType`, `params`, `status` (`configured`/`validated`/`warning`) props; render a colored left border per status; include a block type label, a config button, and a remove button.
- Task 157: Implement individual block configuration panels (rendered as an inline expanded section or side drawer) for each of the 11 block types:
  - `DropNullsConfig`: multi-select of columns (or "all columns").
  - `FillMissingConfig`: strategy radio (mean/median) + column multi-select.
  - `EncodeCategoricalsConfig`: strategy radio (one-hot/ordinal) + column multi-select.
  - `ScaleNumericsConfig`: strategy radio (standard/min-max) + column multi-select.
  - `LogTransformConfig`: column multi-select.
  - `RemoveOutliersConfig`: column multi-select + IQR multiplier numeric input.
  - `FeatureSelectionConfig`: column multi-select (columns to drop).
  - `TrainValTestSplitConfig`: three numeric sliders summing to 1.0 for train/val/test ratios + optional stratify column dropdown.
- Task 158: Implement pipeline validation display: on block change or on "Validate" button click, call `GET /api/v1/.../pipelines/{id}/validate`; render errors as red banners below affected blocks and warnings as yellow inline notices.
- Task 159: Implement "Save Pipeline" button: call `POST /api/v1/projects/{id}/pipelines` with current block config; show a success toast; enable "Next" step button on success.
- Task 160: Implement pipeline reuse: a "Load Saved Pipeline" dropdown listing existing pipelines for the project; on selection, populate the block list from the saved `config_json`.
- Task 161: Implement per-block status indicator: show a green check (`configured`), yellow triangle (`warning`), or red cross (`error`) icon on each block card based on validation state.

---

## Frontend — Model Selection & AutoML

- Task 162: Implement `frontend/src/screens/ModelSelection.tsx`: render the step description "Choose which models to train and configure the optimization settings."; default to AutoML mode enabled.
- Task 163: Implement AutoML toggle: a prominent toggle switch labeled "AutoML (Recommended)" / "Manual Selection"; when AutoML is on, all candidate models for the current task type are pre-selected and the individual model checkboxes are disabled; when off, checkboxes become interactive.
- Task 164: Implement candidate model selection checklist: render one checkbox per model from `MODEL_REGISTRY` filtered by project task type; labels: "Logistic Regression", "Random Forest", "Gradient Boosting", "XGBoost", "Support Vector Machine", "k-Nearest Neighbors" (classification) and their regression counterparts.
- Task 165: Implement optimization metric selector: radio buttons for F1, AUC-ROC, Precision, Recall (classification) or RMSE, MAE, R² (regression); default to F1 (classification) or RMSE (regression).
- Task 166: Implement advanced configuration panel (collapsed by default, expandable): numeric inputs for Max AutoML Trials (default 25), CV Folds (default 5), Time Budget (minutes, default 8); include tooltips explaining each setting.
- Task 167: Implement estimated training time display: after snapshot and model selections are set, call `GET /api/v1/experiments/{id}/estimate` and display the advisory time estimate below the model list as "Estimated training time: ~X minutes".
- Task 168: Implement "Start Training" button: call `POST /api/v1/projects/{id}/experiments` then `POST /api/v1/experiments/{id}/start`; navigate to the Training Progress step on success.

---

## Frontend — Training Progress

- Task 169: Implement `frontend/src/screens/TrainingProgress.tsx`: render the step description "Training is running locally on your machine — no internet required."; display an overall progress bar.
- Task 170: Implement SSE connection in `TrainingProgress.tsx`: connect to `GET /api/v1/experiments/{id}/stream` using the native `EventSource` API (or an Axios streaming wrapper); parse incoming SSE payloads and dispatch to the Zustand training store; close the connection on terminal status.
- Task 171: Implement per-model status table in `frontend/src/components/RunStatusTable.tsx`: render one row per candidate model with columns: Model Name, Status (Queued/Training/Done) with status badge, and metric values (populate as each run completes); animate the "Training" row with a pulsing indicator.
- Task 172: Implement CPU and RAM usage bars in `frontend/src/components/ResourceMonitor.tsx`: render two horizontal progress bars labeled "CPU: X%" and "RAM: X.X GB / Y.Y GB"; update in real time from SSE payload.
- Task 173: Implement "Cancel Training" button with `<ConfirmDialog />`: on confirm, call `DELETE /api/v1/experiments/{id}/cancel`; display a "Training cancelled" state with the option to return to the model selection step.
- Task 174: Implement automatic navigation to the Evaluation Dashboard when the SSE stream emits `status: "done"`.
- Task 175: Implement crash recovery UI: if an `interrupted` experiment is detected on app launch, render a recovery banner with "Restart" and "Discard" actions; call `PATCH /api/v1/experiments/{id}/recover` on user action.

---

## Frontend — Evaluation Dashboard

- Task 176: Implement `frontend/src/screens/EvaluationDashboard.tsx`: on mount, call `GET /api/v1/experiments/{id}/evaluation`; display all evaluation components.
- Task 177: Implement `frontend/src/components/MetricCards.tsx`: render 4 metric cards for classification (F1, AUC-ROC, Precision, Recall) or 3 for regression (RMSE, MAE, R²) plus a residual plot toggle; each card shows the metric name, numeric value (4 decimal places), and a subtle color scale (green for good, yellow/red for poor thresholds).
- Task 178: Implement `frontend/src/components/ConfusionMatrix.tsx`: for binary classification, render a 2×2 grid with TN, FP, FN, TP cell labels, counts, and percentage annotations; for multiclass, render an N×N heatmap with class labels on axes; use color intensity to indicate cell magnitude.
- Task 179: Implement `frontend/src/components/ThresholdSlider.tsx`: render a range input from 0.10 to 0.90 with step 0.05; on change (debounced to 100ms), call `POST /api/v1/experiments/{id}/evaluation/threshold`; update Precision, Recall, and F1 metric cards in real time; ensure total update latency ≤ 200ms; display the current threshold value as a label above the slider.
- Task 180: Implement `frontend/src/components/ResidualPlot.tsx`: for regression tasks, render a scatter plot of `residuals` vs `predicted values` using a lightweight charting library (recharts or d3-lite); include a zero-residual reference line.
- Task 181: Implement `frontend/src/components/SubgroupAnalysis.tsx`: render a table of subgroup slices with columns: Slice Name, N, F1, Recall, Fairness Warning; render a yellow warning flag icon on rows where `fairness_warning: true`; make each row expandable to show additional metrics (Precision, sample count, diagnostic note).
- Task 182: Implement expandable subgroup row in `SubgroupAnalysis.tsx`: on row click, expand an inline detail panel showing Precision, full metric breakdown, and a plain-language diagnostic note (e.g. "This subgroup has lower F1 than the model average. Consider collecting more data or reviewing labeling for this segment.").
- Task 183: Implement best run identification display: show a "Best Model" badge with the model type name and a summary line "Best result: XGBoost | F1 0.847 | AUC-ROC 0.921" at the top of the evaluation dashboard.

---

## Frontend — Experiment Leaderboard

- Task 184: Implement `frontend/src/screens/Leaderboard.tsx`: on mount, call `GET /api/v1/projects/{id}/leaderboard?sort_by=f1&order=desc`; render a full-width sortable table.
- Task 185: Implement sortable leaderboard table: clicking a column header (Experiment ID, Best Model, F1, AUC-ROC, Precision, Recall, Training Time) toggles sort order (desc → asc → desc); on click, update the `sort_by` and `order` query params and re-fetch; render a sort direction indicator arrow next to the active sort column.
- Task 186: Implement "Best" badge on the top experiment: render a green "BEST" pill badge on the `is_best: true` row; visually highlight the entire row with a distinct background color.
- Task 187: Implement row click navigation: clicking any leaderboard row navigates to the Evaluation Dashboard for that experiment's ID.
- Task 188: Implement empty state for the leaderboard: when no experiments exist in the project, render a CTA "Run your first experiment to see results here."

---

## Frontend — Artifact Export

- Task 189: Implement `frontend/src/screens/ExportPanel.tsx`: render the step description "Export your trained model, pipeline, and evaluation report to a local directory."; display artifact selection checkboxes and format options.
- Task 190: Implement artifact selection checkboxes: Model (ONNX format checkbox + joblib format checkbox), Preprocessing Pipeline (joblib), Evaluation Report (PDF), Test Predictions (CSV); default all checked.
- Task 191: Implement "Export All" button: select all artifact checkboxes programmatically and proceed to export; call `POST /api/v1/experiments/{id}/export` with `artifacts: ["model", "pipeline", "report", "predictions"]`.
- Task 192: Implement destination directory picker: display the current selected path (default: OS Desktop); a "Browse" button triggers `window.electronAPI.openDirectoryDialog`; display the selected path as an editable text field.
- Task 193: Implement individual export button per artifact: allow exporting a single artifact independently.
- Task 194: Implement per-artifact status indicators in `frontend/src/components/ExportStatus.tsx`: render a list of artifact items with their status (pending/success/error) and file size after export; show a green checkmark on success, red X on failure.
- Task 195: Implement final completion notice: after all requested artifacts are written, display a success banner "All artifacts exported successfully" with a "Reveal in Finder/Explorer" OS-native action button (via `ipcRenderer.invoke('open-path', dest_dir)`).
- Task 196: Implement `ipcMain.handle('open-path', path)` using Electron's `shell.openPath` to open the export directory in the OS file manager.

---

## Frontend — Settings & Global UI

- Task 197: Implement `frontend/src/screens/Settings.tsx`: display app version, Python backend version, data directory path, and machine info (hostname, CPU, RAM); provide a "Change Password" flow calling `POST /api/v1/auth/change`; provide a "Clear All Data" destructive action with a `<ConfirmDialog />`.
- Task 198: Display the app version in the sidebar footer; fetch from the backend `app_version` field returned by `GET /api/v1/system/info`.
- Task 199: Implement global toast notification system (`frontend/src/components/Toast.tsx`): support success, warning, and error variants; auto-dismiss after 5 seconds; stack multiple toasts.
- Task 200: Implement global error boundary in `frontend/src/components/ErrorBoundary.tsx`: catch unexpected renderer exceptions; display a "Something went wrong" screen with the error message and a "Restart App" button.
- Task 201: Implement actionable error messages for all anticipated failure modes: file too large ("> 2 GB maximum"), unsupported format ("Only CSV and Parquet files are supported"), insufficient memory ("Available RAM may be insufficient — consider reducing dataset size"), training failure ("Training failed: {reason}"), export failure ("Export failed: could not write to {path}").
- Task 202: Implement keyboard navigation: all interactive elements (buttons, inputs, selectors, table rows) must be reachable via Tab key with visible focus rings; Enter and Space activate focused controls; Escape closes modals and drawers.

---

## State Management (Zustand)

- Task 203: Implement `frontend/src/store/appStore.ts`: global store containing `backendPort: number | null`, `authStatus: 'setup' | 'locked' | 'unlocked'`, `currentProjectId: string | null`; actions: `setBackendPort`, `setAuthStatus`, `setCurrentProject`.
- Task 204: Implement `frontend/src/store/wizardStore.ts`: store tracking `activeStep: WizardStep`, `completedSteps: Set<WizardStep>`, `unsavedConfig: Record<WizardStep, any>`; actions: `navigateToStep(step)` (only allowed for completed steps or next step), `markStepComplete(step)`, `saveStepConfig(step, config)`.
- Task 205: Implement `frontend/src/store/datasetStore.ts`: store containing `currentSnapshot: Snapshot | null`, `snapshotHistory: Snapshot[]`; actions: `setSnapshot`, `setSnapshotHistory`.
- Task 206: Implement `frontend/src/store/pipelineStore.ts`: store containing `blocks: PipelineBlock[]`, `validationResult: ValidationResult | null`, `savedPipelineId: string | null`; actions: `addBlock`, `removeBlock`, `reorderBlocks`, `updateBlockParams`, `setValidationResult`, `setSavedPipelineId`.
- Task 207: Implement `frontend/src/store/trainingStore.ts`: store containing `experimentId: string | null`, `status: ExperimentStatus`, `runs: RunStatus[]`, `progressPct: number`, `cpuPct: number`, `ramUsedGb: number`, `ramTotalGb: number`; actions: `setExperimentId`, `updateFromSSEPayload`, `resetTraining`.
- Task 208: Implement `frontend/src/store/evaluationStore.ts`: store containing `evaluation: EvaluationResult | null`, `selectedThreshold: number`; actions: `setEvaluation`, `setThreshold`, `updateThresholdMetrics`.

---

## API Client

- Task 209: Generate TypeScript types from the FastAPI OpenAPI schema: add a `generate:types` script in `frontend/package.json` running `openapi-typescript http://127.0.0.1:{port}/openapi.json -o src/types/api.ts`; run this as part of the dev setup.
- Task 210: Implement `frontend/src/api/client.ts`: create an Axios instance factory accepting the backend port; set `baseURL` to `http://127.0.0.1:{port}/api/v1`; add a request interceptor that injects the `X-OpenNeural-Secret` header (retrieved from the Zustand app store); add a response interceptor that maps HTTP errors to typed `ApiError` objects with `status`, `message`, and optional `field_errors`.
- Task 211: Implement typed API wrapper modules under `frontend/src/api/`: `projects.ts`, `snapshots.ts`, `pipelines.ts`, `experiments.ts`, `evaluation.ts`, `leaderboard.ts`, `exports.ts`; each exports async functions matching the API contract (e.g. `createProject(name, taskType): Promise<Project>`).
- Task 212: Implement the file upload function in `frontend/src/api/snapshots.ts` using `FormData` with `onUploadProgress` callback for progress reporting; pipe progress events to a Zustand action.

---

## Logging

- Task 213: Implement `backend/openneural_backend/logging_config.py`: configure Python `logging` with a `RotatingFileHandler` writing to `{data_dir}/logs/openneural_{YYYY-MM-DD}.log` (rotate daily, retain 14 files); set log format: `[ISO8601] [LEVEL] [module] message`; set root logger to INFO, ML training logger to DEBUG.
- Task 214: Ensure all backend services use `logging.getLogger(__name__)` for structured module-level logging.
- Task 215: Log the following events at INFO level: app startup (port, data dir), experiment start/complete/cancel, export completion, authentication events (success/failure, no passwords in logs).
- Task 216: Log the following events at WARNING level: checksum mismatch attempt, memory usage >75%, file > 500 MB, ONNX conversion failure.
- Task 217: Log the following events at ERROR level: training process crash, database transaction rollback, file permission failure.

---

## Testing — Backend

- Task 218: Create `backend/tests/` directory with `conftest.py` defining pytest fixtures: `async_client` (httpx `AsyncClient` with the FastAPI app), `db_session` (in-memory SQLite session), `tmp_data_dir` (temporary `~/openneural/`-like directory), `sample_project`, `sample_snapshot`, `sample_pipeline`.
- Task 219: Write unit tests for `dataset_service.py`: test schema inference for all 5 data types; test null_pct and unique_count accuracy; test SHA-256 checksum computation; test 2 GB rejection; test 500 MB warning flag; test Parquet conversion; test file permission 0o600 on POSIX; test monotonic version label increment.
- Task 220: Write unit tests for `pipeline/builder.py` and each block: test `build_sklearn_pipeline` produces a valid scikit-learn `Pipeline`; test each of 11 block types transforms data correctly on a fixture dataset; test `TrainValTestSplitBlock` ratio validation and stratification.
- Task 221: Write unit tests for `pipeline/validator.py`: test that split-not-last raises error; test incompatible ordering warnings; test column-not-in-schema error; test valid pipeline returns `valid: true`.
- Task 222: Write unit tests for `models/registry.py`: test all 12 model keys are registered; test `list_models('classification')` returns exactly 6 models; test `list_models('regression')` returns exactly 6 models; test `get_model` raises `KeyError` for unknown key.
- Task 223: Write unit tests for `models/optuna_adapter.py`: test `build_optuna_objective` returns a callable; test objective runs without error on a small synthetic dataset for each model type; test metric mapping correctness.
- Task 224: Write unit tests for `orchestrator/experiment_manager.py`: test experiment ID format matches `exp_[a-z0-9]{4}_\d{4}`; test status transitions `created→running→done`; test cancel transition; test interrupted detection on restart.
- Task 225: Write unit tests for `services/evaluation_service.py`: test `compute_classification_metrics` on a known y_true/y_pred pair produces correct F1, precision, recall, AUC-ROC; test confusion matrix output for binary and 3-class cases; test threshold adjustment changes precision/recall correctly; test subgroup F1 warning flag fires when delta >0.15; test `identify_best_run` returns the run with the highest test metric.
- Task 226: Write unit tests for `services/export_service.py`: test ONNX export produces a valid ONNX file loadable by `onnx.load`; test joblib export produces a loadable sklearn estimator; test PDF export produces a non-empty `.pdf` file; test CSV predictions export has correct columns; test manifest JSON contains correct SHA-256 checksums.
- Task 227: Write unit tests for `services/auth_service.py`: test `hash_password` produces a bcrypt hash with cost factor 12; test `verify_password` returns `True` for correct password; test `verify_password` returns `False` for wrong password; test timing consistency (no early return on mismatch).
- Task 228: Write integration tests for all API endpoints: for each endpoint listed in TDD §2.1–2.7, write at least one happy-path test and one error-path test using `httpx.AsyncClient`; include authentication header on every request.
- Task 229: Write integration test for the `X-OpenNeural-Secret` middleware: test that requests without the header receive `401`; test that requests with a wrong secret receive `401`; test that requests with the correct secret are processed normally.
- Task 230: Write integration test for the SSE training stream: start a real training run on a small synthetic dataset; collect SSE events until the `done` event; assert that all expected model status updates were emitted.
- Task 231: Write crash recovery integration test: start an experiment, kill the backend process mid-training, restart the backend, call `GET /api/v1/experiments/interrupted`, assert the interrupted experiment is listed.
- Task 232: Write checksum mismatch integration test: create a snapshot, manually corrupt the Parquet file, attempt to start a training run, assert the run is aborted with a `ChecksumMismatchError` response.
- Task 233: Write performance test for leaderboard sorting: insert 1,000 experiment records into a test SQLite DB; call `GET /api/v1/projects/{id}/leaderboard?sort_by=f1&order=desc`; assert response time < 500ms.
- Task 234: Enforce minimum 80% line coverage on `pipeline/`, `orchestrator/`, and `services/` modules using `pytest --cov=openneural_backend --cov-fail-under=80`.

---

## Testing — Frontend

- Task 235: Configure Vitest in `frontend/vite.config.ts` with `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`; install `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- Task 236: Create `frontend/src/test/setup.ts` importing `@testing-library/jest-dom` matchers and mocking `window.electronAPI` (`getBackendPort`, `openFileDialog`, `openDirectoryDialog`).
- Task 237: Write unit tests for all Zustand stores: test initial state values; test each action produces the correct state transition; test that `wizardStore.navigateToStep` blocks navigation to uncompleted steps.
- Task 238: Write component tests for `<PasswordSetup />`: render the component; simulate entering matching passwords; assert `POST /api/v1/auth/setup` is called; simulate mismatched passwords; assert an inline error is displayed without calling the API.
- Task 239: Write component tests for `<ProjectsDashboard />`: mock API responses; assert project list renders correctly; assert delete button opens `<ConfirmDialog />` before calling the delete API; assert empty state CTA renders when the project list is empty.
- Task 240: Write component tests for `<DatasetImport />`: mock file drop event; assert upload progress indicator is shown; mock API success response; assert schema table renders with correct column count.
- Task 241: Write component tests for `<PipelineBlock />`: render each of 11 block types; assert block type label is displayed; assert config panel expands on click; assert remove button fires the correct Zustand action.
- Task 242: Write component tests for `<ThresholdSlider />`: render with an initial threshold of 0.5; simulate slider change to 0.4; assert debounced API call is made with `{ threshold: 0.4 }`; assert metric card values update on API response.
- Task 243: Write component tests for `<SubgroupAnalysis />`: render with a subgroup having `fairness_warning: true`; assert warning icon is visible; simulate row click; assert expanded detail panel is shown.
- Task 244: Write component tests for `<Leaderboard />`: render with 5 experiment rows; click the F1 column header; assert `sort_by=f1&order=asc` is included in the subsequent API call; assert the `is_best: true` row has the "BEST" badge.
- Task 245: Write component tests for `<ConfirmDialog />`: render with `onConfirm` and `onCancel` mocks; simulate "Confirm" click; assert `onConfirm` is called and `onCancel` is not; simulate "Cancel" click; assert `onCancel` is called.
- Task 246: Write integration tests simulating the full wizard flow: mock all API endpoints; step through Projects → Import → Pipeline → Model → Train → Evaluate → Export; assert each step's state updates correctly and the "Next" button enables only after the required action is completed.
- Task 247: Enforce no TypeScript errors across the frontend (`tsc --noEmit`) as part of the CI `test` job.

---

## Packaging & Distribution

- Task 248: Configure PyInstaller in `backend/openneural_backend.spec`: include all ML model files, Alembic migration scripts, and Python runtime; target a single-directory bundle (`--onedir`) for fast startup; exclude unused stdlib modules to reduce bundle size.
- Task 249: Alternatively, configure embedded CPython: document the approach chosen; if using embedded CPython, create `scripts/fetch_python.sh` that downloads the official Python 3.11 embedded zip for each target platform (macOS arm64, macOS x64, Windows x64, Linux x64) and places it in `resources/python/`.
- Task 250: Configure `electron-builder.config.js` `extraResources` to include the Python backend bundle at `resources/backend/`; set `asar: true` for the Electron app bundle.
- Task 251: Implement `electron/src/backend-resolver.ts`: detect whether the app is running in development (`process.env.NODE_ENV === 'development'`) or production; in production, resolve the Python executable path from `process.resourcesPath/backend/`; in development, use `python` from PATH.
- Task 252: Create macOS `.dmg` build target: configure `electron-builder` with `mac.target: 'dmg'`, `mac.arch: ['arm64', 'x64']`; set app icon, bundle identifier `com.openneural.app`, and category `public.app-category.developer-tools`.
- Task 253: Create Windows `.exe` (NSIS) build target: configure `electron-builder` with `win.target: 'nsis'`, `nsis.oneClick: false`, `nsis.allowToChangeInstallationDirectory: true`; set app icon.
- Task 254: Create Linux `.AppImage` build target: configure `electron-builder` with `linux.target: 'AppImage'`, `linux.arch: ['x64']`; set app icon and desktop entry category.
- Task 255: Implement `scripts/verify_build.sh`: after packaging, verify the `.dmg`/`.exe`/`.AppImage` exists; extract and verify the embedded Python backend starts and prints the `OPENNEURAL_PORT=` line within 10 seconds.
- Task 256: Implement dependency hash verification: in `scripts/verify_deps.py`, read `requirements.lock` hash manifest and compare against `pip inspect` output; fail the build if any hash mismatch is detected.
- Task 257: Create `scripts/package.sh`: orchestrate the full packaging pipeline: install deps, run all tests, build frontend, build electron, bundle Python backend, run electron-builder for all platforms.

---

## CI/CD Pipeline

- Task 258: Create `.github/workflows/ci.yml` with jobs: `lint` (ESLint + flake8/ruff), `test-backend` (pytest with coverage), `test-frontend` (vitest), `typecheck` (tsc), `build` (npm run build for all workspaces); trigger on every push and pull request to `main`.
- Task 259: Implement `lint` job: run `ruff check backend/` and `black --check backend/`; run `eslint frontend/src/` and `prettier --check frontend/src/`; fail on any violation.
- Task 260: Implement `test-backend` job: run `pytest backend/tests/ --cov=openneural_backend --cov-report=xml --cov-fail-under=80`; upload coverage XML as an artifact.
- Task 261: Implement `test-frontend` job: run `vitest run --coverage`; upload coverage as an artifact.
- Task 262: Implement `build` job: run `vite build` in `frontend/`, `tsc -p electron/tsconfig.json`; verify no TypeScript errors; produce a build artifact but do not package (packaging is a separate release workflow).
- Task 263: Create `.github/workflows/release.yml`: trigger on push to `release/*` branches; run all CI jobs; then run `npm run package` to produce `.dmg`, `.exe`, `.AppImage`; upload installers as GitHub release assets.

---

## Documentation

- Task 264: Write `backend/README.md`: document Python environment setup, how to run the FastAPI server in development mode (`python -m openneural_backend --port 8765 --data-dir /tmp/openneural_dev`), how to run migrations, and how to run tests.
- Task 265: Write `frontend/README.md`: document how to run the Vite dev server, how to regenerate API types from the OpenAPI schema, and how to run Vitest.
- Task 266: Write `electron/README.md`: document how to run Electron in development mode (`npm run dev`), how to test IPC communication, and how to build the packaged app.
- Task 267: Write `ARCHITECTURE.md` in the repository root: describe the three-process architecture (Electron main, renderer, Python backend), the IPC mechanism (ephemeral port + secret), the file storage layout, and the SQLite schema relationships using ASCII diagrams matching TDD §1.1.
- Task 268: Produce API documentation: the FastAPI app auto-generates OpenAPI docs at `/docs` and `/redoc`; ensure all endpoints have `summary`, `description`, and explicit `responses` annotations in the router files.
- Task 269: Write `docs/user-guide.md`: step-by-step walkthrough for the Academic Researcher persona covering the full workflow from first launch to model export; include one-sentence step descriptions matching NFR-USE-02; written for non-ML-expert readers.
- Task 270: Write `docs/security.md`: document all security design decisions from TDD §5 including local-only data, bcrypt authentication, ephemeral secrets, CSP headers, WAL mode, and file permissions; document how users can verify exported artifact checksums.
- Task 271: Write `docs/extending.md`: document how to add new preprocessing block types (implement `PipelineBlock` subclass, register in `BLOCK_REGISTRY`) and how to add new model types (add entry to `MODEL_REGISTRY` with search space); include a worked example for each.