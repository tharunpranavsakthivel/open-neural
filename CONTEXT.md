# OpenNeural — Product & Engineering Documentation
**Version:** 0.1.0-mvp | **Classification:** Internal Working Draft | **Date:** 2024-10

---

# PART I — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Reasoning

The primary challenge OpenNeural solves is the friction between having a structured dataset and producing a reproducible, evaluated, exportable ML model. The existing landscape forces researchers and engineers into one of two unsatisfactory extremes: heavyweight cloud ML platforms (Vertex AI, SageMaker, DataRobot) that demand cloud accounts, infrastructure knowledge, and per-hour billing, or raw code notebooks (Jupyter, scikit-learn) that require deep implementation knowledge and provide no reproducibility scaffolding out of the box.

OpenNeural carves a middle path — local-first, no-code by default, guided by a linear wizard that hides complexity while surfacing power-user controls on demand. The step-by-step workflow mirrors the mental model a researcher already has: get data → clean it → pick a model → train → assess → compare → export.

Key PRD decisions:
- **Single-user, single-machine** eliminates auth complexity and cloud dependency from the MVP.
- **AutoML as default** unblocks domain experts who know their data but not their algorithms, while the manual override keeps ML engineers in control.
- **Reproducibility as a first-class constraint** means every experiment auto-links to its exact dataset snapshot, pipeline config, and hyperparameter set — no "what version of the data was that?" ambiguity.
- **Export over deployment** keeps the MVP scope tight; trained models leave as files, not endpoints.
- The phased roadmap (tabular → time series → NLP → CV → RL; local → BYOC → managed GPU) allows shipping a useful product quickly without over-engineering.

---

## 1. Overview

### 1.1 Product Summary

**OpenNeural** is a local-first, no-code machine learning experimentation desktop application. It enables academic researchers, ML engineers, and data scientists to train, evaluate, compare, and export classical ML models on structured tabular datasets — entirely on their own machine, without cloud accounts, infrastructure setup, or programming knowledge.

### 1.2 Goals and Objectives

- Reduce time from raw structured dataset to evaluated, exportable model to under 15 minutes for a competent researcher.
- Guarantee experiment reproducibility: every run is fully traceable to a specific dataset snapshot, preprocessing pipeline, and hyperparameter configuration.
- Provide a zero-friction local workflow: no sign-in, no cloud billing, no internet dependency.
- Serve non-coders with a guided wizard while giving power users granular control via advanced configuration panels.
- Establish a foundation that can be extended to time series, NLP, computer vision, cloud execution, and deployment in future phases.

### 1.3 Success Metrics (MVP)

| Metric | Target |
|---|---|
| Time-to-first-model (new user, clean CSV) | ≤ 15 min |
| Experiment reproducibility rate | 100% (same config → same result) |
| Supported dataset size (comfortable) | ≤ 2 GB CSV / Parquet |
| Installer download → app running | ≤ 5 min |
| AutoML baseline F1 vs manual tuning | Within 5% for typical classification tasks |

---

## 2. Users and Personas

### 2.1 Primary Persona — Academic Researcher

- **Background:** PhD student or faculty in a quantitative discipline (biology, economics, social science). Has domain expertise and data. Knows Python at a basic level but has not productionized ML pipelines.
- **Goal:** Train and evaluate a classification or regression model on a tabular dataset to support a paper or grant, without spending days on infrastructure.
- **Pain points:** Jupyter notebooks are brittle; cloud platforms require credit cards and IT approval; reproducing a colleague's experiment is difficult.
- **OpenNeural value:** Zero-setup local workflow, automatic experiment snapshots, one-click evaluation report export for paper appendices.

### 2.2 Secondary Persona — ML Engineer

- **Background:** 2–5 years ML/data science experience. Comfortable with Python, scikit-learn, XGBoost. Uses notebooks but wants faster iteration on preprocessing and model comparison.
- **Goal:** Rapid baseline comparison across multiple model families on a new dataset before committing to a production pipeline.
- **Pain points:** Setting up experiment tracking (MLflow, W&B) is overhead for exploration work; notebooks do not enforce reproducibility.
- **OpenNeural value:** Built-in experiment tracking with zero config, sortable leaderboard, ONNX export for handoff to engineering.

### 2.3 Tertiary Persona — Enterprise Data Scientist

- **Background:** Works within a company with data governance constraints. Data cannot leave on-premises or approved environments.
- **Goal:** Explore a business dataset, evaluate model options, produce a defensible evaluation report for stakeholders.
- **Pain points:** Cloud ML platforms require data egress; notebook-based workflows produce reports that are hard to reproduce or audit.
- **OpenNeural value:** All data stays local; evaluation report PDF is audit-ready; experiment metadata is fully versioned.

### 2.4 Future Persona — Domain Expert Non-Coder

- **Background:** Business analyst, clinical researcher, or policy researcher. No coding ability. Understands data conceptually.
- **Goal:** Train a predictive model without writing code.
- **OpenNeural value (Phase 2):** Fully guided, no-code interface with plain-language model explanations and automated insight summaries.

---

## 3. Key Features and Workflows

### 3.1 Project Management

Users create and manage named local projects. Each project is associated with a task type (classification, regression), a dataset, a preprocessing pipeline, and a collection of experiments. The projects dashboard displays experiment counts, last-updated timestamps, and per-project quick stats.

### 3.2 Dataset Import and Versioning

Users upload CSV or Parquet files (up to 2 GB). On upload, OpenNeural automatically:
- Infers schema (column names, data types, null percentages, unique value counts).
- Profiles the dataset (row count, file size, basic descriptive statistics).
- Creates an immutable **dataset snapshot** with a version tag (e.g., `Snapshot v1`), timestamp, and checksum.
- Warns when memory usage approaches machine limits.

Every subsequent experiment is linked to a specific snapshot, guaranteeing reproducibility.

### 3.3 Visual Preprocessing Pipeline

Users build a preprocessing pipeline by arranging and configuring visual blocks in sequence. Available block types in the MVP:

| Block | Description |
|---|---|
| Drop nulls | Remove rows containing null values in selected columns |
| Fill missing (mean/median) | Impute missing values with column mean or median |
| Encode categoricals | One-hot or ordinal encoding for categorical columns |
| Scale numerics | StandardScaler or Min-Max normalization |
| Log transform | Log transformation on selected numeric columns |
| Remove outliers | IQR-based outlier filtering |
| Feature selection | Drop specified columns |
| Train / val / test split | Configurable split ratios with optional stratification |

Pipelines are saved as a versioned JSON configuration bound to the current dataset snapshot.

### 3.4 Model Selection and AutoML

**AutoML mode (default on):** The platform automatically selects all applicable candidate models, runs cross-validated hyperparameter search, and ranks results by the user's chosen optimization metric.

**Manual mode:** Users select individual candidate models and manually configure hyperparameters.

**MVP candidate models (classification and regression):**
- Logistic Regression
- Random Forest
- Gradient Boosting (scikit-learn)
- XGBoost
- Support Vector Machine (SVM)
- k-Nearest Neighbors (k-NN)

**Optimization metrics (user-selectable):** F1 (default), AUC-ROC, Precision, Recall (classification); RMSE, MAE, R² (regression).

**AutoML config (advanced panel):** Max trials, cross-validation folds, time budget (minutes).

### 3.5 Local Training and Experiment Tracking

Training runs entirely on the user's local machine. On run start, the platform:
- Locks and versions the full experiment configuration.
- Generates a unique experiment ID (e.g., `exp_cxp8_1015`).
- Trains each candidate model, displaying live per-model status (queued → training → done).
- Captures CPU and RAM usage during training.
- Automatically records: dataset snapshot ref, pipeline config, model type, hyperparameters, per-fold metrics, training time, and all evaluation outputs.

No internet connection is required at any stage of training.

### 3.6 Evaluation Dashboard

After training, the platform presents:
- **Metric summary cards:** F1, AUC-ROC, Precision, Recall (classification); RMSE, MAE, R² (regression) for the best model on the test set.
- **Confusion matrix:** Visual 2×2 (binary) or N×N (multiclass) matrix with TN/FP/FN/TP labels.
- **Decision threshold slider:** Real-time threshold adjustment with metric feedback (classification only).
- **Subgroup / slice analysis:** User-expandable performance breakdown by feature segment or class (e.g., contract type, tenure cohort).
- **Fairness visibility:** Performance disparity flags for low-F1 subgroups (not a compliance audit — diagnostic only in MVP).

### 3.7 Experiment Comparison Leaderboard

All experiments in a project are displayed in a sortable, interactive leaderboard table. Users can:
- Sort by any metric column (F1, AUC-ROC, Precision, Recall, training time).
- Visually identify the best experiment (highlighted row + "best" badge).
- Compare experiments across dataset versions, pipeline configs, and model types.

### 3.8 Model and Artifact Export

Users can export the following artifacts from any experiment:
- **Model artifact:** Trained model in ONNX and/or joblib format.
- **Preprocessing pipeline:** Fitted scikit-learn pipeline in joblib format.
- **Evaluation report:** Structured PDF containing metrics, confusion matrix, subgroup analysis, and experiment metadata.
- **Test predictions:** CSV file of test-set predictions with predicted labels and class probabilities.

All exports are saved to a user-specified local directory.

---

## 4. Scope and Out-of-Scope

### 4.1 In Scope (MVP — v0.1.0)

- Downloadable desktop application for macOS (Apple Silicon priority), Windows, and Linux.
- Local-only execution: no internet dependency for core workflow.
- Task types: binary classification, multiclass classification, regression.
- Data sources: local CSV and Parquet file upload.
- Visual preprocessing pipeline with MVP block library (8 block types).
- AutoML with manual override; 6 candidate model families.
- Built-in experiment tracking with automatic versioning.
- Evaluation dashboard: standard metrics, confusion matrix, threshold slider, subgroup analysis.
- Experiment comparison leaderboard (sortable).
- Artifact export: model (ONNX/joblib), pipeline (joblib), report (PDF), predictions (CSV).
- Basic local authentication (single-user, password-protected app session).
- Dataset size: MB to low-GB structured tabular data (≤ 2 GB per file).

### 4.2 Out of Scope (MVP)

| Feature | Planned Phase |
|---|---|
| Time series forecasting | Phase 2 |
| NLP over text columns | Phase 2 |
| Computer vision | Phase 3 |
| Reinforcement learning | Phase 4 |
| Foundation model fine-tuning (LoRA, adapters) | Phase 2 |
| Distributed / multi-GPU training | Phase 2 |
| BYOC (user-provided cloud credentials) | Phase 2 |
| Managed GPU pools | Phase 3 |
| One-click REST endpoint deployment | Phase 2 |
| Post-deployment model monitoring / drift detection | Phase 2 |
| MLflow / W&B / Comet integrations | Phase 2 |
| Python SDK / public API | Phase 2 |
| GitHub / GitLab / Jira / Slack integrations | Phase 2 |
| SSO, SAML, LDAP | Phase 2 |
| SOC 2, HIPAA, GDPR compliance certification | Phase 3 |
| Real-time collaborative editing | Phase 3 |
| Streaming data sources (Kafka, etc.) | Phase 3 |
| AutoML architecture search (NAS) | Phase 3 |
| TorchScript / HuggingFace Hub push | Phase 2 |
| Production A/B testing | Phase 2 |

---

---

# PART II — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Reasoning

Formalizing the PRD into an SRS requires decomposing each product feature into granular, independently testable requirements using "shall" language. The SRS must cover:

1. **Functional requirements** for each workflow step — these directly map to the 8-step wizard and the underlying platform services (project management, data versioning, pipeline execution, training orchestration, evaluation, export).
2. **Non-functional requirements** — performance on local hardware, reliability of local execution, usability targets, and data safety. Since OpenNeural runs entirely on-device, cloud reliability SLAs do not apply, but local process stability, crash recovery, and file integrity are paramount.
3. **Data requirements** — schema inference correctness, versioning integrity, dataset size limits.
4. **Security requirements** — local data never leaves the machine, basic auth protects the session, file system permissions control artifact access.
5. **Constraints** — single-machine execution, no internet dependency (except installer download), dependency on the host OS's Python runtime or bundled Python.

The SRS intentionally avoids implementation decisions (those belong in the TDD) and focuses on what the system must do, not how.

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the complete set of functional and non-functional requirements for OpenNeural v0.1.0 (MVP). It is the authoritative specification used by engineering, QA, and product to assess completeness and correctness of the implementation.

### 1.2 Scope

OpenNeural is a local-first desktop ML experimentation application. This document covers all requirements for the MVP feature set as defined in the PRD. Requirements for Phase 2 and later features are noted as future items and are not specified here.

### 1.3 Stakeholders

| Stakeholder | Role |
|---|---|
| Product Owner | Defines and prioritizes requirements |
| Engineering Lead | Implements and validates requirements |
| QA Lead | Defines test cases from this SRS |
| Academic Researcher (User) | Primary end-user persona |
| ML Engineer (User) | Secondary end-user persona |
| Enterprise Data Scientist (User) | Tertiary end-user persona |

### 1.4 Definitions and Abbreviations

| Term | Definition |
|---|---|
| Snapshot | An immutable, checksummed copy of a dataset at a point in time |
| Experiment | A fully versioned configuration comprising a snapshot ref, pipeline config, model config, and all resulting runs |
| Run | A single model-training execution within an experiment |
| Pipeline | An ordered sequence of preprocessing blocks with their parameter configurations |
| Artifact | A file output produced by a training run (model, pipeline, report, predictions) |
| AutoML | Automated hyperparameter search across candidate models using cross-validation |
| IPC | Inter-process communication between the desktop shell and the ML backend |

### 1.5 Assumptions

- The user's machine has at least 8 GB RAM and a 64-bit CPU. A warning is shown below this threshold; 16 GB is recommended.
- The Python ML runtime is either bundled with the installer or automatically installed as a sidecar on first launch.
- No persistent internet connection is required after initial installation.
- A single user operates the application on a single machine. There is no concurrent multi-user access.

---

## 2. Functional Requirements

### 2.1 Application and Session

| ID | Requirement |
|---|---|
| FR-APP-01 | The system shall be installable on macOS (Apple Silicon and Intel), Windows 10/11, and Ubuntu 22.04 LTS via a downloadable installer package. |
| FR-APP-02 | The system shall launch without requiring internet connectivity after installation. |
| FR-APP-03 | The system shall present a local password setup screen on first launch and require authentication on subsequent launches. |
| FR-APP-04 | The system shall display the application version number in the sidebar or settings panel. |
| FR-APP-05 | The system shall display the host machine's name, RAM, and CPU in the session footer. |
| FR-APP-06 | The system shall support graceful shutdown, saving all in-progress configuration state before exit. |

### 2.2 Project Management

| ID | Requirement |
|---|---|
| FR-PROJ-01 | The system shall allow the user to create a named project with a selected task type (binary classification, multiclass classification, regression). |
| FR-PROJ-02 | The system shall display all projects on a dashboard with name, task type, experiment count, and last-updated timestamp. |
| FR-PROJ-03 | The system shall allow the user to open, rename, and delete projects. |
| FR-PROJ-04 | The system shall display aggregate statistics on the dashboard: total experiment count, total models exported, total dataset snapshots. |
| FR-PROJ-05 | The system shall persist all project metadata locally using an embedded database. |

### 2.3 Dataset Import and Versioning

| ID | Requirement |
|---|---|
| FR-DATA-01 | The system shall accept CSV and Parquet files via file-picker dialog or drag-and-drop. |
| FR-DATA-02 | The system shall reject files larger than 2 GB and display a user-readable error message specifying the size limit. |
| FR-DATA-03 | The system shall automatically infer the data type (string, integer, float, categorical, boolean) for each column upon import. |
| FR-DATA-04 | The system shall compute and display per-column null percentage, unique value count, and row/column totals. |
| FR-DATA-05 | The system shall create an immutable dataset snapshot on every file import, storing the file name, file size in bytes, SHA-256 checksum, row count, column count, inferred schema as JSON, and a UTC timestamp. |
| FR-DATA-06 | The system shall assign a monotonically incrementing version label (Snapshot v1, Snapshot v2, …) to each snapshot within a project. |
| FR-DATA-07 | The system shall store the snapshot's raw file in a managed local directory controlled by OpenNeural; the original file path is recorded but the source file is not modified. |
| FR-DATA-08 | The system shall display a warning banner when an imported file exceeds 500 MB, advising the user about potential training time and memory implications. |
| FR-DATA-09 | The system shall allow the user to view snapshot history for a project, listing all snapshots with their version label, timestamp, and row count. |

### 2.4 Preprocessing Pipeline

| ID | Requirement |
|---|---|
| FR-PIPE-01 | The system shall provide a visual pipeline builder where blocks are added, ordered, and configured without writing code. |
| FR-PIPE-02 | The system shall support the following block types in MVP: Drop Nulls, Fill Missing (Mean), Fill Missing (Median), Encode Categoricals (One-Hot), Encode Categoricals (Ordinal), Scale Numerics (Standard), Scale Numerics (Min-Max), Log Transform, Remove Outliers (IQR), Feature Selection (column drop), Train/Val/Test Split. |
| FR-PIPE-03 | The system shall allow the user to reorder pipeline blocks via drag-and-drop. |
| FR-PIPE-04 | The system shall validate the pipeline configuration before training and surface any detected issues (e.g., split block not at the end, incompatible block ordering). |
| FR-PIPE-05 | The system shall serialize and store the complete pipeline configuration as a versioned JSON document, bound to the current dataset snapshot. |
| FR-PIPE-06 | The system shall display a per-block visual status indicator (configured / validated / warning) in the pipeline builder. |
| FR-PIPE-07 | The system shall support the Train/Val/Test Split block with configurable ratios (default: 70/15/15) and optional stratification on the target column. |
| FR-PIPE-08 | The system shall allow the user to save a pipeline configuration and reuse it across experiments. |

### 2.5 Model Selection and AutoML

| ID | Requirement |
|---|---|
| FR-MODEL-01 | The system shall default to AutoML mode, enabling all candidate models for the current task type. |
| FR-MODEL-02 | The system shall allow the user to disable AutoML and select individual candidate models for a training run. |
| FR-MODEL-03 | The system shall support the following candidate models for classification tasks in MVP: Logistic Regression, Random Forest, Gradient Boosting (scikit-learn), XGBoost, SVM, k-NN. |
| FR-MODEL-04 | The system shall support the following candidate models for regression tasks in MVP: Ridge Regression, Random Forest Regressor, Gradient Boosting Regressor, XGBoost Regressor, SVR, k-NN Regressor. |
| FR-MODEL-05 | The system shall allow the user to select the optimization metric: F1 / AUC-ROC / Precision / Recall (classification); RMSE / MAE / R² (regression). |
| FR-MODEL-06 | In AutoML mode, the system shall conduct cross-validated hyperparameter search for each candidate model using randomized or Bayesian search. |
| FR-MODEL-07 | The system shall expose an advanced configuration panel allowing the user to set: maximum AutoML trials (default: 25), cross-validation folds (default: 5), time budget in minutes (default: 8). |
| FR-MODEL-08 | The system shall display a pre-training estimated time to completion based on dataset size and candidate count. This estimate is advisory and may differ from actual training time. |

### 2.6 Training and Experiment Tracking

| ID | Requirement |
|---|---|
| FR-TRAIN-01 | The system shall execute all training on the local machine CPU, using all available cores via parallel processing where applicable. |
| FR-TRAIN-02 | The system shall generate a unique, human-readable experiment ID on training start (format: `exp_[4-char-random]_[MMDD]`). |
| FR-TRAIN-03 | The system shall display a real-time training progress bar reflecting the fraction of candidate models completed. |
| FR-TRAIN-04 | The system shall display per-model status in a live table during training: queued → training → done, with metric values populating as each model completes. |
| FR-TRAIN-05 | The system shall display real-time CPU usage percentage and RAM usage (GB used / GB total) during training. |
| FR-TRAIN-06 | The system shall automatically capture and persist the following for each run: experiment ID, dataset snapshot ref, pipeline config JSON, model type, hyperparameter values, per-fold CV metrics, training duration, test-set metric values, and all artifact file paths. |
| FR-TRAIN-07 | The system shall not require an internet connection during training. |
| FR-TRAIN-08 | The system shall allow the user to cancel a running training job; partial run results shall be discarded and the experiment status set to "cancelled". |
| FR-TRAIN-09 | The system shall persist experiment state to disk at regular intervals (≤ 60 seconds) so that a machine crash does not lose more than 60 seconds of completed run data. |

### 2.7 Evaluation Dashboard

| ID | Requirement |
|---|---|
| FR-EVAL-01 | The system shall automatically identify and display the best-performing run (by optimization metric) after training completes. |
| FR-EVAL-02 | For classification tasks, the system shall display F1, AUC-ROC, Precision, and Recall for the best model on the test set. |
| FR-EVAL-03 | For regression tasks, the system shall display RMSE, MAE, R², and a residual plot visualization for the best model on the test set. |
| FR-EVAL-04 | The system shall display a confusion matrix (TN, FP, FN, TP) for binary classification; an N×N matrix for multiclass. |
| FR-EVAL-05 | The system shall provide a decision threshold slider (range: 0.10–0.90, step: 0.05) for binary classification, updating Precision and Recall in real time on slider change. |
| FR-EVAL-06 | The system shall compute and display subgroup / slice analysis: per-group F1, Recall, and sample count for up to 10 user-defined or auto-detected feature segments. |
| FR-EVAL-07 | The system shall display a warning flag on any subgroup with an F1 score more than 0.15 below the overall model F1. |
| FR-EVAL-08 | The system shall allow the user to expand a subgroup row to view additional metrics (Precision, Recall, sample count, diagnostic note). |

### 2.8 Experiment Comparison Leaderboard

| ID | Requirement |
|---|---|
| FR-COMP-01 | The system shall display all experiments within a project in a leaderboard table, showing experiment ID, best model type, F1, AUC-ROC, Precision, Recall, and training time. |
| FR-COMP-02 | The system shall allow the user to sort the leaderboard by any metric column in descending or ascending order. |
| FR-COMP-03 | The system shall highlight the globally best experiment (by optimization metric) with a distinct visual indicator ("best" badge). |
| FR-COMP-04 | The system shall allow the user to navigate from the leaderboard to the evaluation dashboard of any listed experiment. |

### 2.9 Artifact Export

| ID | Requirement |
|---|---|
| FR-EXP-01 | The system shall export the trained model in ONNX format for models where ONNX conversion is supported; in joblib format for all models. |
| FR-EXP-02 | The system shall export the fitted preprocessing pipeline as a joblib-serialized scikit-learn Pipeline object. |
| FR-EXP-03 | The system shall generate an evaluation report as a structured PDF containing: experiment metadata, dataset snapshot info, pipeline configuration summary, metric summary table, confusion matrix, subgroup analysis table, and threshold selection. |
| FR-EXP-04 | The system shall export a CSV file of test-set predictions containing: row index, predicted label, true label (if available), and per-class probability scores. |
| FR-EXP-05 | The system shall provide an "Export All" action that triggers all four exports in a single operation. |
| FR-EXP-06 | The system shall allow the user to specify the destination directory for all exported artifacts. |
| FR-EXP-07 | The system shall display a per-artifact confirmation indicator (Saved / Export button) and a final completion notice when all artifacts are written successfully. |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | The system shall complete schema inference and snapshot creation for a 100 MB CSV file within 10 seconds on a machine with 8 GB RAM and a modern multi-core CPU. |
| NFR-PERF-02 | The system shall complete AutoML training of 6 candidate models with 5-fold CV on a 10,000-row, 10-feature dataset within 8 minutes on the reference hardware above. |
| NFR-PERF-03 | The system shall render the evaluation dashboard with all metrics and confusion matrix within 3 seconds of training completion. |
| NFR-PERF-04 | The system shall update the threshold slider metrics within 200 ms of a slider interaction. |
| NFR-PERF-05 | The system shall sort the experiment leaderboard within 500 ms of a column header click, regardless of experiment count (up to 1,000 experiments). |
| NFR-PERF-06 | The system shall display a memory usage warning and recommend dataset sampling when an imported file is projected to consume more than 75% of available system RAM during training. |

### 3.2 Reliability and Data Integrity

| ID | Requirement |
|---|---|
| NFR-REL-01 | Dataset snapshots shall be immutable after creation; no operation in the application shall modify or delete a snapshot file without explicit user action. |
| NFR-REL-02 | The system shall verify the SHA-256 checksum of a dataset snapshot before using it in a training run; a checksum mismatch shall abort the run with a user-readable error. |
| NFR-REL-03 | The system shall persist experiment state to disk at intervals of ≤ 60 seconds during active training. |
| NFR-REL-04 | On application restart after a crash, the system shall detect any experiments in "running" state, mark them as "interrupted", and allow the user to restart or discard them. |
| NFR-REL-05 | The system shall perform atomic writes for all metadata database transactions; partial writes shall be rolled back automatically. |

### 3.3 Usability

| ID | Requirement |
|---|---|
| NFR-USE-01 | A first-time user with no ML background shall be able to complete the full workflow (import → train → export) by following the step-by-step wizard without consulting external documentation. |
| NFR-USE-02 | Every step in the wizard shall include a one-sentence contextual description of its purpose. |
| NFR-USE-03 | All destructive actions (delete project, discard experiment, cancel training) shall require explicit user confirmation. |
| NFR-USE-04 | The application shall display meaningful, actionable error messages for all anticipated failure modes (file too large, unsupported format, insufficient memory, training failure, export failure). |
| NFR-USE-05 | The sidebar navigation shall allow the user to jump to any previously completed step without losing unsaved configuration. |
| NFR-USE-06 | The application shall support keyboard navigation for all primary actions. |

### 3.4 Security and Privacy

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All user data (datasets, models, experiment metadata) shall be stored exclusively on the local file system; no data shall be transmitted to any external server. |
| NFR-SEC-02 | The application shall enforce a local password on the app session; the password hash shall be stored using bcrypt with a minimum cost factor of 12. |
| NFR-SEC-03 | Dataset snapshot files shall be stored in a restricted application-managed directory; the application shall not expose raw dataset file paths to the GUI layer. |
| NFR-SEC-04 | Exported artifact files shall carry a manifest file listing their SHA-256 checksums for external verification. |
| NFR-SEC-05 | The application's local HTTP IPC server (ML backend) shall bind exclusively to localhost (127.0.0.1) and refuse connections from any external IP. |

### 3.5 Maintainability and Extensibility

| ID | Requirement |
|---|---|
| NFR-MAINT-01 | Preprocessing block types shall be implemented as a plugin interface such that new blocks can be added without modifying the pipeline execution engine. |
| NFR-MAINT-02 | Model candidates shall be registered via a model registry configuration, allowing new model types to be added by registering a new entry without modifying the training orchestrator. |
| NFR-MAINT-03 | The experiment metadata schema shall include a version field; migrations shall be applied automatically on application upgrade without data loss. |
| NFR-MAINT-04 | The application shall ship with a minimum 80% unit test coverage on the ML backend core modules (pipeline, training, evaluation). |

### 3.6 Portability

| ID | Requirement |
|---|---|
| NFR-PORT-01 | The installer shall bundle all Python dependencies; the user shall not be required to install Python or any ML library manually. |
| NFR-PORT-02 | The application shall function identically on macOS (Apple Silicon M1/M2/M3, Intel x86_64), Windows 10/11 (x86_64), and Ubuntu 22.04 (x86_64). |
| NFR-PORT-03 | Exported ONNX model files shall conform to ONNX opset 17 or later, enabling consumption by any ONNX-compatible runtime. |

---

## 4. Dependencies and Constraints

### 4.1 External Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| scikit-learn ≥ 1.4 | Classical ML models, pipeline API, preprocessing transformers | Core ML dependency |
| XGBoost ≥ 2.0 | XGBoost candidate model | |
| ONNX / skl2onnx | Model export in ONNX format | |
| joblib ≥ 1.3 | Pipeline and model serialization | |
| pandas ≥ 2.0 | Dataset loading, profiling, preprocessing | |
| pyarrow ≥ 14 | Parquet file support | |
| reportlab / weasyprint | PDF report generation | |
| SQLite (via sqlalchemy ≥ 2.0) | Local metadata storage | Bundled with Python |
| Electron ≥ 30 or Tauri ≥ 2 | Desktop application shell | Decision in TDD |
| React ≥ 18 + TypeScript | Frontend UI | |

### 4.2 Constraints

- Training is limited to single-machine, single-process execution in MVP; multi-GPU or distributed training is explicitly out of scope.
- The application does not support datasets requiring more memory than the host machine's available RAM; no disk-based out-of-core computation is implemented in MVP.
- The application does not implement custom model code execution from users; all model training uses the registered model registry.
- Internet connectivity is not required post-installation for any MVP feature.
- No data is written outside the application's managed data directory without explicit user export action.

---

---

# PART III — TECHNICAL DESIGN DOCUMENT (TDD)

## Reasoning

The TDD must translate the SRS requirements into concrete technical decisions. The key architectural choices are:

1. **Desktop shell:** Electron (Node.js + Chromium) is chosen over Tauri because it offers a mature ecosystem for packaging Python sidecars and has broader developer familiarity. The performance overhead of Chromium is acceptable given that compute-intensive work runs in the Python process, not the renderer.

2. **ML backend:** A Python subprocess running a local FastAPI server on `127.0.0.1` with a random ephemeral port. The Electron main process spawns and owns this subprocess. IPC is over local HTTP — this avoids complex Electron IPC bridges and keeps the ML backend independently testable. The port is communicated to the renderer via Electron IPC at startup.

3. **Metadata storage:** SQLite via SQLAlchemy. SQLite requires zero server setup, is single-file portable, supports ACID transactions, and scales comfortably to thousands of experiments and millions of evaluation rows. Alembic handles schema migrations.

4. **File storage layout:** A single managed application data directory (`~/openneural/`) contains subdirectories for `snapshots/`, `pipelines/`, `models/`, `reports/`, and `predictions/`. All file references in SQLite use paths relative to this root so the directory can be moved.

5. **Preprocessing pipeline execution:** A scikit-learn `Pipeline` object is constructed at runtime from the JSON pipeline config. This makes fitting, transforming, and joblib serialization trivial.

6. **AutoML:** Optuna (open-source hyperparameter optimization framework) is used for randomized and Bayesian hyperparameter search. Each model type has a registered Optuna study with a defined search space.

7. **Export:** ONNX export via `skl2onnx`; fallback to joblib for models not supported by `skl2onnx`. PDF report via `reportlab`. Predictions CSV via pandas.

8. **Authentication:** bcrypt password hash stored in a local SQLite auth table. The Electron main process validates the password at startup before spawning the Python backend.

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP SHELL                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              RENDERER PROCESS (React/TypeScript)          │   │
│  │   Step Wizard · Evaluation Dashboard · Leaderboard       │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ Electron IPC (contextBridge)         │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │              MAIN PROCESS (Node.js)                       │   │
│  │   Window management · Auth · Process lifecycle           │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ HTTP (127.0.0.1:[dynamic port])      │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    PYTHON ML BACKEND (FastAPI)                    │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  Dataset   │  │  Pipeline  │  │  Training  │  │  Export  │  │
│  │  Service   │  │  Service   │  │Orchestrator│  │  Service │  │
│  └─────┬──────┘  └─────┬──────┘  └──────┬─────┘  └────┬─────┘  │
│        │               │                │               │         │
│  ┌─────▼───────────────▼────────────────▼───────────────▼──────┐ │
│  │                SQLite (SQLAlchemy + Alembic)                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│           ~/openneural/ (managed file storage)                       │
│           ├── snapshots/   ├── pipelines/                        │
│           ├── models/      ├── reports/                          │
│           └── predictions/                                        │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 Process Lifecycle

1. Electron main process starts; reads stored bcrypt hash; presents auth dialog in renderer.
2. On successful auth, main process spawns the Python FastAPI subprocess on a random available localhost port.
3. Main process sends the port number to the renderer via `contextBridge`.
4. Renderer makes all ML API calls to `http://127.0.0.1:{port}/api/v1/...`.
5. On app close, main process sends `SIGTERM` to the Python subprocess and waits up to 5 seconds for graceful shutdown.

### 1.3 Frontend Architecture

- **Framework:** React 18 with TypeScript.
- **State management:** Zustand (lightweight, no boilerplate) for global app state (current project, active step, experiment list).
- **Routing:** React state-driven step navigation; no URL router (desktop app context).
- **API client:** Axios with a typed client wrapper generated from the FastAPI OpenAPI schema.
- **UI components:** Custom component library built on top of Radix UI primitives and styled with CSS variables matching the OpenNeural design system.

---

## 2. API Contracts

All endpoints are prefixed `/api/v1/`. The Python FastAPI server auto-generates an OpenAPI spec at `/docs`.

### 2.1 Projects

```
POST /api/v1/projects
Request:  { "name": "string", "task_type": "classification|regression" }
Response: { "id": "uuid", "name": "string", "task_type": "string",
            "created_at": "ISO8601", "experiment_count": 0 }

GET /api/v1/projects
Response: [ { "id": "uuid", "name": "string", "task_type": "string",
              "updated_at": "ISO8601", "experiment_count": int } ]

DELETE /api/v1/projects/{project_id}
Response: { "deleted": true }
```

### 2.2 Dataset Snapshots

```
POST /api/v1/projects/{project_id}/snapshots
Content-Type: multipart/form-data
Body: file=[binary]
Response: {
  "id": "uuid", "version_label": "Snapshot v1",
  "file_name": "churn.csv", "file_size_bytes": 8800000,
  "row_count": 14316, "col_count": 9,
  "schema": [
    { "name": "churn", "inferred_type": "boolean",
      "null_pct": 0.0, "unique_count": 2 }, ...
  ],
  "checksum_sha256": "abc123...", "created_at": "ISO8601"
}

GET /api/v1/projects/{project_id}/snapshots
Response: [ { "id": "uuid", "version_label": "string",
              "row_count": int, "created_at": "ISO8601" } ]
```

### 2.3 Preprocessing Pipelines

```
POST /api/v1/projects/{project_id}/pipelines
Request: {
  "snapshot_id": "uuid",
  "blocks": [
    { "type": "drop_nulls",       "params": {} },
    { "type": "encode_categorical","params": { "columns": ["contract_type"], "strategy": "onehot" } },
    { "type": "scale_numeric",    "params": { "columns": ["tenure_months"], "strategy": "standard" } },
    { "type": "split",            "params": { "train": 0.7, "val": 0.15, "test": 0.15,
                                               "stratify_column": "churn" } }
  ]
}
Response: { "id": "uuid", "snapshot_id": "uuid",
            "config_json": {...}, "validated": true, "created_at": "ISO8601" }

GET /api/v1/projects/{project_id}/pipelines/{pipeline_id}/validate
Response: { "valid": true, "warnings": [], "errors": [] }
```

### 2.4 Experiments and Training

```
POST /api/v1/projects/{project_id}/experiments
Request: {
  "pipeline_id": "uuid",
  "automl_enabled": true,
  "optimize_metric": "f1",
  "automl_config": { "max_trials": 25, "cv_folds": 5, "time_budget_minutes": 8 },
  "candidate_models": ["logistic_regression","random_forest","gradient_boosting",
                        "xgboost","svm","knn"]
}
Response: { "id": "uuid", "experiment_id_human": "exp_cxp8_1015",
            "status": "created", "created_at": "ISO8601" }

POST /api/v1/experiments/{experiment_id}/start
Response: { "status": "running", "started_at": "ISO8601" }

GET /api/v1/experiments/{experiment_id}/status
Response: {
  "status": "running|done|cancelled|interrupted",
  "progress_pct": 66.7,
  "cpu_pct": 68.0, "ram_used_gb": 4.2, "ram_total_gb": 16.0,
  "runs": [
    { "model_type": "logistic_regression", "status": "done",
      "metrics": { "f1": 0.761, "auc_roc": 0.839 } },
    { "model_type": "random_forest", "status": "done",
      "metrics": { "f1": 0.823, "auc_roc": 0.891 } },
    { "model_type": "gradient_boosting", "status": "running",
      "metrics": null },
    { "model_type": "xgboost", "status": "queued", "metrics": null }
  ]
}

DELETE /api/v1/experiments/{experiment_id}/cancel
Response: { "status": "cancelled" }
```

### 2.5 Evaluation

```
GET /api/v1/experiments/{experiment_id}/evaluation
Response: {
  "best_run_id": "uuid",
  "best_model_type": "xgboost",
  "metrics": { "f1": 0.847, "auc_roc": 0.921, "precision": 0.831, "recall": 0.864 },
  "confusion_matrix": { "tn": 7842, "fp": 312, "fn": 421, "tp": 1741 },
  "threshold": 0.5,
  "subgroup_analyses": [
    { "slice_name": "Month-to-month contract", "n": 8174,
      "metrics": { "f1": 0.891, "recall": 0.872 } }
  ]
}

POST /api/v1/experiments/{experiment_id}/evaluation/threshold
Request:  { "threshold": 0.45 }
Response: { "precision": 0.801, "recall": 0.891, "f1": 0.843 }
```

### 2.6 Leaderboard

```
GET /api/v1/projects/{project_id}/leaderboard
Query params: sort_by=f1|auc_roc|precision|recall|training_time, order=desc|asc
Response: [
  { "experiment_id": "uuid", "experiment_id_human": "exp_cxp8_1015",
    "best_model_type": "xgboost",
    "metrics": { "f1": 0.847, "auc_roc": 0.921, "precision": 0.831, "recall": 0.864 },
    "training_time_seconds": 222, "is_best": true, "created_at": "ISO8601" }
]
```

### 2.7 Export

```
POST /api/v1/experiments/{experiment_id}/export
Request: {
  "artifacts": ["model", "pipeline", "report", "predictions"],
  "destination_dir": "/Users/tp/Desktop/openneural_exports/",
  "formats": { "model": ["onnx", "joblib"] }
}
Response: {
  "exports": [
    { "artifact": "model",       "path": "/Users/tp/.../xgboost.onnx",     "size_bytes": 14900000, "status": "success" },
    { "artifact": "model",       "path": "/Users/tp/.../xgboost.joblib",   "size_bytes": 14100000, "status": "success" },
    { "artifact": "pipeline",    "path": "/Users/tp/.../pipeline.joblib",  "size_bytes": 820000,   "status": "success" },
    { "artifact": "report",      "path": "/Users/tp/.../report.pdf",       "size_bytes": 2100000,  "status": "success" },
    { "artifact": "predictions", "path": "/Users/tp/.../predictions.csv",  "size_bytes": 400000,   "status": "success" }
  ],
  "manifest_path": "/Users/tp/.../export_manifest.json"
}
```

---

## 3. Data Model / Database Schema

All tables are in a single SQLite database at `~/openneural/openneural.db`.

### 3.1 Schema Version

```sql
CREATE TABLE schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

### 3.2 Auth

```sql
CREATE TABLE auth (
  id            TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 3.3 Projects

```sql
CREATE TABLE projects (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT    NOT NULL,
  task_type   TEXT    NOT NULL CHECK (task_type IN ('classification','regression')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 3.4 Dataset Snapshots

```sql
CREATE TABLE dataset_snapshots (
  id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id       TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_label    TEXT    NOT NULL,
  original_path    TEXT    NOT NULL,
  stored_path      TEXT    NOT NULL,
  file_name        TEXT    NOT NULL,
  file_size_bytes  INTEGER NOT NULL,
  row_count        INTEGER NOT NULL,
  col_count        INTEGER NOT NULL,
  schema_json      TEXT    NOT NULL,
  checksum_sha256  TEXT    NOT NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, version_label)
);
```

### 3.5 Preprocessing Pipelines

```sql
CREATE TABLE pipelines (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id   TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_id  TEXT    NOT NULL REFERENCES dataset_snapshots(id),
  name         TEXT,
  config_json  TEXT    NOT NULL,
  validated    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 3.6 Experiments

```sql
CREATE TABLE experiments (
  id                   TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id           TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pipeline_id          TEXT    NOT NULL REFERENCES pipelines(id),
  experiment_id_human  TEXT    NOT NULL UNIQUE,
  automl_enabled       INTEGER NOT NULL DEFAULT 1,
  optimize_metric      TEXT    NOT NULL,
  automl_config_json   TEXT    NOT NULL,
  candidate_models     TEXT    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'created'
                           CHECK (status IN ('created','running','done','cancelled','interrupted')),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  started_at           TEXT,
  completed_at         TEXT
);
```

### 3.7 Runs (one per model per experiment)

```sql
CREATE TABLE runs (
  id                  TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  experiment_id       TEXT    NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  model_type          TEXT    NOT NULL,
  hyperparams_json    TEXT    NOT NULL,
  cv_metrics_json     TEXT,
  test_metrics_json   TEXT,
  training_time_sec   REAL,
  artifact_model_onnx TEXT,
  artifact_model_jlib TEXT,
  status              TEXT    NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','running','done','failed')),
  started_at          TEXT,
  completed_at        TEXT
);
CREATE INDEX idx_runs_experiment_id ON runs(experiment_id);
```

### 3.8 Evaluations

```sql
CREATE TABLE evaluations (
  id                     TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  run_id                 TEXT    NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  split                  TEXT    NOT NULL CHECK (split IN ('val','test')),
  metrics_json           TEXT    NOT NULL,
  confusion_matrix_json  TEXT,
  threshold              REAL    NOT NULL DEFAULT 0.5,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 3.9 Subgroup Analyses

```sql
CREATE TABLE subgroup_analyses (
  id              TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evaluation_id   TEXT    NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  slice_name      TEXT    NOT NULL,
  slice_config    TEXT    NOT NULL,
  n               INTEGER NOT NULL,
  metrics_json    TEXT    NOT NULL
);
```

### 3.10 Exports

```sql
CREATE TABLE exports (
  id              TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  experiment_id   TEXT    NOT NULL REFERENCES experiments(id),
  artifact_type   TEXT    NOT NULL CHECK (artifact_type IN ('model_onnx','model_joblib','pipeline','report','predictions')),
  file_path       TEXT    NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## 4. Integration Points and Technical Stack

### 4.1 Full Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Desktop shell | Electron | ≥ 30 | OS-native window, file system access, subprocess management |
| Frontend | React + TypeScript | React 18, TS 5 | Step wizard, dashboard, leaderboard UI |
| UI state | Zustand | ≥ 4 | Global state (project, experiment, step) |
| API client | Axios + OpenAPI-generated types | Latest | HTTP calls to Python backend |
| Frontend build | Vite | ≥ 5 | Fast bundling for Electron renderer |
| ML backend | Python 3.11 + FastAPI | FastAPI ≥ 0.110 | RESTful ML API, experiment orchestration |
| Background tasks | FastAPI BackgroundTasks / asyncio | — | Non-blocking training runs |
| ML models | scikit-learn ≥ 1.4 + XGBoost ≥ 2.0 | — | Model training and prediction |
| AutoML | Optuna ≥ 3.5 | — | Hyperparameter optimization |
| Pipeline serialization | joblib ≥ 1.3 | — | Pipeline and model save/load |
| ONNX export | skl2onnx ≥ 1.16 + onnx ≥ 1.16 | — | ONNX model conversion |
| Data handling | pandas ≥ 2.0, pyarrow ≥ 14 | — | CSV/Parquet I/O, preprocessing |
| Database ORM | SQLAlchemy ≥ 2.0 + Alembic | — | SQLite access, schema migrations |
| PDF export | reportlab ≥ 4 | — | Evaluation report generation |
| Auth hashing | bcrypt ≥ 4 | — | Local password hashing |
| Testing (BE) | pytest ≥ 8 + httpx | — | Unit + integration tests |
| Testing (FE) | Vitest + React Testing Library | — | Component + integration tests |
| Packaging | electron-builder | ≥ 24 | Cross-platform installers (.dmg, .exe, .AppImage) |
| Python bundling | PyInstaller or embedded CPython | — | Bundle Python runtime with installer |

### 4.2 Electron–Python IPC Design

```
Electron Main Process
  │
  ├── Spawns Python subprocess:
  │   `python -m openneural_backend --port 0 --data-dir ~/openneural/`
  │   (port 0 = OS assigns random ephemeral port)
  │
  ├── Reads port from subprocess stdout on startup line:
  │   stdout: "OPENNEURAL_PORT=52841"
  │
  └── Sends port to renderer via contextBridge:
      ipcMain.handle('get-backend-port', () => 52841)
```

The renderer calls `window.electronAPI.getBackendPort()` once on mount and stores the port in Zustand for all subsequent API calls.

### 4.3 Training Orchestration

Training runs asynchronously in Python using `asyncio` + `concurrent.futures.ProcessPoolExecutor`. Each model candidate is trained in a separate OS process (bypasses the Python GIL, enables true parallelism). The training orchestrator:

1. Constructs the scikit-learn `Pipeline` from config JSON.
2. Fits the pipeline on the training split.
3. For each candidate model, submits an Optuna study to the process pool.
4. As each study completes, writes the run record to SQLite and updates the experiment status.
5. Polls emit a Server-Sent Events (SSE) stream at `/api/v1/experiments/{id}/stream` so the frontend receives live updates without polling.

### 4.4 AutoML — Optuna Integration

Each model family has a registered search space:

```python
MODEL_SEARCH_SPACES = {
  "random_forest": {
    "n_estimators":      ("int",   50,  500),
    "max_depth":         ("int",   3,   20),
    "min_samples_split": ("int",   2,   20),
  },
  "xgboost": {
    "n_estimators":      ("int",   50,  500),
    "max_depth":         ("int",   3,   10),
    "learning_rate":     ("float", 0.01, 0.3),
    "subsample":         ("float", 0.5,  1.0),
  },
  # ... etc.
}
```

Each Optuna trial calls `cross_val_score` with the configured CV folds. The best hyperparameters per model are selected; models are then compared by test-set metric to determine the overall best.

### 4.5 File Storage Layout

```
~/openneural/
├── openneural.db                          # SQLite metadata database
├── snapshots/
│   └── {snapshot_id}/
│       ├── data.parquet                # All snapshots stored internally as Parquet
│       └── schema.json
├── pipelines/
│   └── {pipeline_id}/
│       └── config.json
├── experiments/
│   └── {experiment_id}/
│       └── runs/
│           └── {run_id}/
│               ├── model.onnx
│               ├── model.joblib
│               ├── pipeline.joblib
│               └── run_metadata.json
├── exports/
│   └── {export_id}/
│       ├── report.pdf
│       ├── predictions.csv
│       └── manifest.json
└── logs/
    └── openneural_{date}.log
```

---

## 5. Security Considerations

### 5.1 Authentication

- On first launch, the user sets a local password. The bcrypt hash (cost factor 12) is stored in the `auth` table.
- The Electron main process validates the password at startup before spawning the Python backend. The renderer never receives the raw password hash.
- Session tokens are not used for local IPC; instead, the Python backend accepts requests only from the Electron main process's localhost origin, verified via a shared ephemeral secret injected as an environment variable at subprocess spawn time.
- The ephemeral secret is passed in the `X-OpenNeural-Secret` HTTP header on every IPC request. Requests missing or presenting an incorrect secret receive `401 Unauthorized`.

### 5.2 Network Isolation

- The Python FastAPI backend binds exclusively to `127.0.0.1`; it refuses connections from `0.0.0.0` or any external interface.
- No outbound network requests are made by the application at runtime. DNS is not queried. No telemetry is transmitted.
- The installer may download Python dependencies from PyPI at install time; after install, all dependencies are local.

### 5.3 Data Isolation

- All dataset files are copied into `~/openneural/snapshots/` on import and converted to Parquet internally. The original file is never modified.
- Snapshot files are written with OS-level permissions `600` (owner read/write only).
- Exported files are written to the user-specified directory with default OS permissions.
- Export manifests include SHA-256 checksums for all artifact files to enable integrity verification by downstream consumers.

### 5.4 Dependency Security

- Python dependencies are pinned in `requirements.lock` and verified against a hash manifest during build.
- The Electron renderer process runs with `nodeIntegration: false` and `contextIsolation: true`. All Node.js access is via a narrow `contextBridge` API.
- `Content-Security-Policy` headers are set on the renderer to prevent inline script execution and external resource loading.

### 5.5 Crash and Data Safety

- SQLite Write-Ahead Logging (WAL) mode is enabled for all database connections to prevent data corruption on process termination.
- The Python backend registers a `SIGTERM` / `SIGINT` handler that flushes all in-progress SQLite transactions and marks interrupted training experiments before exit.
- The Electron main process uses `app.on('before-quit')` to send `SIGTERM` to the Python subprocess and await its graceful shutdown (5-second timeout before `SIGKILL`).

---

*Document end — OpenNeural v0.1.0 PRD / SRS / TDD*
*Next review: prior to engineering kick-off sprint*