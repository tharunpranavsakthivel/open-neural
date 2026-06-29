# OpenNeural — Compact Product & Engineering Spec

**Version:** 0.1.0-mvp  
**Classification:** Internal Working Draft  
**Condensed From:** PRD + SRS + TDD  
**Date:** 2024-10

---

## 1. Product Summary

**OpenNeural** is a local-first, no-code desktop machine learning experimentation app for structured tabular datasets. It helps researchers, ML engineers, and data scientists train, evaluate, compare, and export classical ML models without cloud accounts, infrastructure setup, or programming.

The MVP focuses on a guided workflow:

```text
Create Project → Import Dataset → Build Pipeline → Select Models → Train → Evaluate → Compare → Export
```

### Core Positioning

OpenNeural sits between heavyweight cloud ML platforms and raw notebooks:

- **Local-first:** data and training stay on the user's machine.
- **No-code by default:** guided wizard for non-specialists.
- **Power-user controls:** manual model and hyperparameter configuration.
- **Reproducible:** every experiment links to a dataset snapshot, preprocessing config, and model config.
- **Export-oriented:** models and reports leave as files, not deployed endpoints.

---

## 2. MVP Goals and Success Metrics

### Goals

- Get from clean structured data to evaluated model in **≤ 15 minutes**.
- Guarantee reproducible experiments with immutable dataset snapshots.
- Avoid sign-in, cloud billing, and internet dependency after install.
- Support no-code users while preserving advanced controls.
- Establish a foundation for time series, NLP, CV, cloud execution, and deployment later.

### Success Metrics

| Metric | Target |
|---|---:|
| Time-to-first-model | ≤ 15 min |
| Reproducibility rate | 100% |
| Comfortable dataset size | ≤ 2 GB CSV / Parquet |
| Installer download → app running | ≤ 5 min |
| AutoML baseline vs manual tuning | Within 5% F1 for typical classification |

---

## 3. Target Users

| Persona | Need | OpenNeural Value |
|---|---|---|
| Academic Researcher | Train/evaluate models for papers or grants without infra overhead | Local workflow, snapshots, exportable reports |
| ML Engineer | Rapid baseline comparison across models | Built-in tracking, leaderboard, ONNX/joblib export |
| Enterprise Data Scientist | Keep governed data on-device/on-prem | Local-only execution, audit-ready metadata |
| Future Non-Coder | Train predictive models without coding | Plain-language guided interface in later phases |

---

## 4. MVP Scope

### In Scope

- Desktop app for **macOS, Windows, Linux**.
- Local-only execution after installation.
- Task types: binary classification, multiclass classification, regression.
- Data import: CSV and Parquet, up to **2 GB**.
- Dataset snapshots with checksum, schema, timestamp, and version label.
- Visual preprocessing pipeline.
- AutoML plus manual model selection.
- Local training with experiment tracking.
- Evaluation dashboard with metrics and visual diagnostics.
- Experiment comparison leaderboard.
- Artifact export: ONNX/joblib model, joblib pipeline, PDF report, predictions CSV.
- Basic single-user local password protection.

### Out of Scope for MVP

- Time series, NLP, computer vision, RL.
- Foundation model fine-tuning.
- Distributed / multi-GPU training.
- BYOC or managed GPU pools.
- One-click REST deployment.
- Drift monitoring / production A/B testing.
- MLflow/W&B/Comet, GitHub, Jira, Slack integrations.
- SSO/SAML/LDAP, compliance certifications.
- Real-time collaboration and streaming data sources.

---

## 5. Core Workflow

### 5.1 Project Management

Users create local projects with:

- Project name.
- Task type: classification or regression.
- Associated datasets, pipelines, experiments, and exports.

Dashboard displays:

- Project name.
- Task type.
- Experiment count.
- Last updated timestamp.
- Aggregate stats: total experiments, exported models, dataset snapshots.

### 5.2 Dataset Import and Versioning

Supported inputs:

- `.csv`
- `.parquet`

On import, OpenNeural shall:

- Reject files above **2 GB**.
- Infer schema and data types.
- Compute row count, column count, null percentages, unique counts.
- Create immutable dataset snapshot.
- Store raw snapshot in managed app directory.
- Record checksum using SHA-256.
- Warn for files above **500 MB**.
- Show memory risk when training may use more than 75% of RAM.

Each experiment is tied to a specific snapshot.

### 5.3 Visual Preprocessing Pipeline

MVP pipeline blocks:

| Block | Purpose |
|---|---|
| Drop Nulls | Remove rows with nulls |
| Fill Missing | Mean or median imputation |
| Encode Categoricals | One-hot or ordinal encoding |
| Scale Numerics | StandardScaler or Min-Max scaling |
| Log Transform | Transform selected numeric columns |
| Remove Outliers | IQR-based filtering |
| Feature Selection | Drop selected columns |
| Train/Val/Test Split | Default 70/15/15, optional stratification |

Pipeline requirements:

- Blocks can be added, configured, reordered, validated, saved, and reused.
- Config is serialized as versioned JSON.
- Pipeline is bound to the current dataset snapshot.
- Invalid ordering or missing parameters produce actionable warnings.

### 5.4 Model Selection and AutoML

Default mode: **AutoML enabled**.

Candidate classification models:

- Logistic Regression
- Random Forest
- Gradient Boosting
- XGBoost
- SVM
- k-NN

Candidate regression models:

- Ridge Regression
- Random Forest Regressor
- Gradient Boosting Regressor
- XGBoost Regressor
- SVR
- k-NN Regressor

Optimization metrics:

| Task | Metrics |
|---|---|
| Classification | F1, AUC-ROC, Precision, Recall |
| Regression | RMSE, MAE, R² |

Advanced AutoML config:

- Max trials, default **25**.
- Cross-validation folds, default **5**.
- Time budget, default **8 minutes**.

### 5.5 Local Training and Experiment Tracking

Training runs locally on CPU.

On training start, the system shall:

- Lock the full experiment configuration.
- Generate human-readable experiment ID: `exp_[4-char-random]_[MMDD]`.
- Show model statuses: queued → training → done.
- Display progress, CPU usage, and RAM usage.
- Persist experiment state every **≤ 60 seconds**.
- Allow cancellation; cancelled experiments discard partial results.

Each run records:

- Experiment ID.
- Dataset snapshot reference.
- Pipeline config JSON.
- Model type.
- Hyperparameters.
- Cross-validation metrics.
- Training duration.
- Test metrics.
- Artifact paths.

### 5.6 Evaluation Dashboard

For classification:

- F1
- AUC-ROC
- Precision
- Recall
- Confusion matrix
- Binary decision threshold slider from **0.10 to 0.90** in **0.05** steps
- Subgroup / slice analysis
- Fairness visibility flags for subgroups with F1 more than **0.15 below** overall F1

For regression:

- RMSE
- MAE
- R²
- Residual plot

The dashboard identifies the best run by selected optimization metric.

### 5.7 Experiment Leaderboard

Leaderboard displays all experiments in a project with:

- Experiment ID.
- Best model type.
- Metrics.
- Training time.
- Best badge.
- Sortable metric columns.
- Navigation to each evaluation dashboard.

### 5.8 Artifact Export

Export options:

| Artifact | Format |
|---|---|
| Model | ONNX where supported; joblib fallback |
| Pipeline | joblib |
| Evaluation report | PDF |
| Test predictions | CSV |
| Manifest | JSON with SHA-256 checksums |

Export flow:

- User chooses destination directory.
- User can export selected artifacts or use **Export All**.
- App shows per-artifact success/failure status.

---

## 6. Functional Requirement Summary

### Application

- Installable on macOS, Windows, and Ubuntu.
- Launches offline after install.
- First launch requires local password setup.
- Subsequent launches require authentication.
- Shows app version and host machine details.
- Saves in-progress configuration during graceful shutdown.

### Projects

- Create, open, rename, delete.
- Persist metadata locally.
- Display project dashboard and aggregate stats.

### Data

- Accept CSV/Parquet via file picker or drag-and-drop.
- Enforce 2 GB size limit.
- Infer schema and profile dataset.
- Create immutable snapshots with checksum and metadata.
- Maintain snapshot history.

### Pipeline

- Visual builder.
- Drag-and-drop ordering.
- Validation before training.
- Versioned JSON config.
- Reusable pipelines.

### Model / AutoML

- AutoML by default.
- Manual candidate selection available.
- Cross-validated hyperparameter search.
- Advanced trial/fold/time settings.
- Estimated time before training.

### Training

- Local CPU execution.
- Parallel processing where applicable.
- Real-time training status.
- Experiment persistence and crash recovery.
- Cancellation support.

### Evaluation

- Best model identification.
- Task-specific metrics.
- Confusion matrix or residual plot.
- Threshold slider for binary classification.
- Subgroup analysis and diagnostic flags.

### Export

- Model, pipeline, report, predictions, manifest.
- Destination directory selection.
- Export confirmation indicators.

---

## 7. Non-Functional Requirements

### Performance

| Requirement | Target |
|---|---:|
| 100 MB CSV inference + snapshot | ≤ 10 sec |
| AutoML on 10k rows / 10 features / 6 models / 5-fold CV | ≤ 8 min |
| Dashboard render after training | ≤ 3 sec |
| Threshold slider update | ≤ 200 ms |
| Leaderboard sort up to 1,000 experiments | ≤ 500 ms |

### Reliability and Integrity

- Snapshots are immutable.
- SHA-256 checksum verified before training.
- Experiments saved every ≤ 60 sec.
- Interrupted runs are detected after crash.
- SQLite writes are atomic and rollback-safe.

### Usability

- Wizard should guide a first-time non-ML user through import → train → export.
- Each step has a one-sentence explanation.
- Destructive actions require confirmation.
- Errors must be actionable.
- Keyboard navigation supported.

### Security and Privacy

- All data remains local.
- Local password hash uses bcrypt cost factor ≥ 12.
- Backend binds only to `127.0.0.1`.
- Raw dataset paths are not exposed to GUI layer.
- Export manifest includes checksums.

### Maintainability

- Preprocessing blocks use a plugin interface.
- Models use a registry.
- Metadata schema is versioned.
- Backend core modules target ≥ 80% unit test coverage.

### Portability

- Installer bundles Python dependencies.
- App works consistently on macOS Apple Silicon/Intel, Windows 10/11, Ubuntu 22.04.
- ONNX exports use opset 17 or later.

---

## 8. Technical Architecture

### Chosen Architecture

```text
Electron Desktop Shell
├─ Renderer: React + TypeScript UI
├─ Main Process: auth, window, subprocess lifecycle
└─ Python ML Backend: FastAPI on localhost
   ├─ Dataset Service
   ├─ Pipeline Service
   ├─ Training Orchestrator
   ├─ Evaluation Service
   ├─ Export Service
   ├─ SQLite Metadata DB
   └─ Managed File Storage
```

### Key Technical Decisions

| Area | Decision | Reason |
|---|---|---|
| Desktop shell | Electron ≥ 30 | Mature ecosystem, easier Python sidecar packaging |
| Frontend | React 18 + TypeScript | Familiar, typed UI development |
| State | Zustand | Lightweight global state |
| Backend | Python 3.11 + FastAPI | Strong ML ecosystem and testable API layer |
| IPC | Local HTTP on random localhost port | Simple, language-agnostic, independently testable |
| Metadata | SQLite + SQLAlchemy + Alembic | Local, ACID, portable |
| Training | asyncio + ProcessPoolExecutor | Parallel CPU work, bypasses GIL |
| AutoML | Optuna | Random/Bayesian hyperparameter search |
| Pipeline | scikit-learn Pipeline | Native preprocessing/model composition |
| Export | skl2onnx, joblib, reportlab, pandas | Standard ML/report outputs |

---

## 9. Process Lifecycle

1. Electron main starts.
2. User authenticates with local password.
3. Main process spawns Python FastAPI subprocess.
4. Backend binds to random ephemeral port on `127.0.0.1`.
5. Backend prints startup line: `OPENNEURAL_PORT=<port>`.
6. Main sends port to renderer via `contextBridge`.
7. Renderer calls `http://127.0.0.1:{port}/api/v1/...`.
8. On quit, Electron sends `SIGTERM` to Python backend.
9. Backend flushes transactions, marks interrupted jobs, and exits gracefully.

---

## 10. API Surface

All endpoints are prefixed with `/api/v1`.

### Projects

```http
POST   /projects
GET    /projects
DELETE /projects/{project_id}
```

### Dataset Snapshots

```http
POST /projects/{project_id}/snapshots
GET  /projects/{project_id}/snapshots
```

### Pipelines

```http
POST /projects/{project_id}/pipelines
GET  /projects/{project_id}/pipelines/{pipeline_id}/validate
```

### Experiments and Training

```http
POST   /projects/{project_id}/experiments
POST   /experiments/{experiment_id}/start
GET    /experiments/{experiment_id}/status
DELETE /experiments/{experiment_id}/cancel
```

### Evaluation

```http
GET  /experiments/{experiment_id}/evaluation
POST /experiments/{experiment_id}/evaluation/threshold
```

### Leaderboard

```http
GET /projects/{project_id}/leaderboard?sort_by=f1&order=desc
```

### Export

```http
POST /experiments/{experiment_id}/export
```

---

## 11. Data Model Summary

SQLite database path:

```text
~/openneural/openneural.db
```

Main tables:

| Table | Purpose |
|---|---|
| `schema_migrations` | Tracks DB migrations |
| `auth` | Stores local password hash |
| `projects` | Project metadata |
| `dataset_snapshots` | Immutable dataset versions |
| `pipelines` | Versioned preprocessing configs |
| `experiments` | Experiment-level config and status |
| `runs` | One row per model run |
| `evaluations` | Metrics and confusion/residual outputs |
| `subgroup_analyses` | Slice-level metrics |
| `exports` | Exported artifact metadata |

Important constraints:

- Projects cascade-delete child data.
- Snapshots have unique version labels per project.
- Experiments track status: created, running, done, cancelled, interrupted.
- Runs track status: queued, running, done, failed.
- Export records include checksum and file size.

---

## 12. Managed File Storage

Root directory:

```text
~/openneural/
```

Layout:

```text
~/openneural/
├── openneural.db
├── snapshots/
│   └── {snapshot_id}/
│       ├── data.parquet
│       └── schema.json
├── pipelines/
│   └── {pipeline_id}/config.json
├── experiments/
│   └── {experiment_id}/runs/{run_id}/
│       ├── model.onnx
│       ├── model.joblib
│       ├── pipeline.joblib
│       └── run_metadata.json
├── exports/
│   └── {export_id}/
│       ├── report.pdf
│       ├── predictions.csv
│       └── manifest.json
└── logs/
    └── openneural_{date}.log
```

All DB file paths should be relative to this root where possible.

---

## 13. Security Model

### Local Authentication

- User sets local password on first launch.
- Password hash stored with bcrypt cost factor 12.
- Electron validates password before spawning backend.

### Local IPC Protection

- Backend binds only to `127.0.0.1`.
- Requests must include shared ephemeral secret header:

```http
X-OpenNeural-Secret: <secret>
```

- Missing or invalid secret returns `401 Unauthorized`.

### Renderer Hardening

- `nodeIntegration: false`
- `contextIsolation: true`
- Narrow `contextBridge` API only
- Content Security Policy blocks inline scripts and external resources

### Data Safety

- Raw imported files are copied into managed snapshots.
- Snapshot files use owner-only permissions where supported.
- SQLite WAL mode enabled.
- SIGTERM/SIGINT handlers flush DB transactions and mark interrupted experiments.

---

## 14. Engineering Stack

| Layer | Technology |
|---|---|
| Desktop | Electron ≥ 30 |
| Renderer | React 18, TypeScript 5, Vite |
| UI primitives | Radix UI + CSS variables |
| State | Zustand |
| API client | Axios + OpenAPI-generated types |
| Backend | Python 3.11, FastAPI ≥ 0.110 |
| ML | scikit-learn ≥ 1.4, XGBoost ≥ 2.0 |
| AutoML | Optuna ≥ 3.5 |
| Data | pandas ≥ 2.0, pyarrow ≥ 14 |
| Export | skl2onnx, ONNX, joblib, reportlab |
| DB | SQLite, SQLAlchemy ≥ 2.0, Alembic |
| Auth | bcrypt ≥ 4 |
| Testing | pytest, httpx, Vitest, React Testing Library |
| Packaging | electron-builder, PyInstaller or embedded CPython |

---

## 15. Build Priorities

### MVP Implementation Order

1. App shell, local auth, backend subprocess lifecycle.
2. Project CRUD and SQLite schema.
3. Dataset import, profiling, checksummed snapshots.
4. Pipeline builder and validation.
5. Model registry and training orchestrator.
6. AutoML integration.
7. Evaluation dashboard.
8. Leaderboard.
9. Export system and manifest.
10. Crash recovery, packaging, and test hardening.

### Critical Risks

| Risk | Mitigation |
|---|---|
| Large local datasets exceed memory | File size limits, RAM warnings, sampling recommendations |
| Python sidecar packaging complexity | Prototype PyInstaller/embedded CPython early |
| Long training blocks UI | Background training + SSE/polling updates |
| Reproducibility drift | Immutable snapshots, locked configs, checksums |
| Unsupported ONNX conversion | Always support joblib fallback |
| Localhost backend exposure | Bind to 127.0.0.1 + ephemeral secret |

---

## 16. Phase Roadmap

| Phase | Additions |
|---|---|
| Phase 2 | Time series, NLP, LoRA/adapters, BYOC, REST deployment, monitoring, integrations, SDK |
| Phase 3 | Computer vision, managed GPU pools, compliance certifications, collaboration, streaming sources, NAS |
| Phase 4 | Reinforcement learning |

---

## 17. Final MVP Definition

OpenNeural v0.1.0 is successful when a user can install the desktop app, create a local project, import a CSV/Parquet dataset, build a preprocessing pipeline, train and compare classical ML models, inspect evaluation metrics, and export reproducible artifacts — all without internet access or cloud infrastructure.
