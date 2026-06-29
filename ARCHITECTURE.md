# OpenNeural System Architecture

OpenNeural is a local-first, single-user desktop application designed to bridge structured tabular datasets with reproducible and exportable machine learning models. 

This document describes the three-process system architecture, inter-process communication (IPC) security protocol, local file storage layout, and the SQLite relational schema.

---

## 1. Three-Process Architecture

OpenNeural consists of three distinct processes executing concurrently on the user's host operating system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP SHELL                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              RENDERER PROCESS (React/TypeScript)          │   │
│  │   - Wizard Steps, Leaderboard, Evaluation Dashboard      │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ Electron IPC (contextBridge)         │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │              MAIN PROCESS (Node.js)                       │   │
│  │   - Window management, authentication, process lifecycle │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ Local HTTP (127.0.0.1:port)         │
│                           │ with "X-OpenNeural-Secret" header   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    PYTHON ML BACKEND (FastAPI)                    │
│   - Pipeline parsing, AutoML Orchestration, Model training      │
│   - Handles SQLite database read/write and file serialization  │
└─────────────────────────────────────────────────────────────────┘
```

1. **Electron Main Process (Node.js)**:
   - Orchestrates the application lifecycle (launch, shutdown, crashes).
   - Validates user session credentials (bcrypt-hashed password stored locally).
   - Dynamically spawns the Python sidecar process on a random available port.
   - Generates an ephemeral shared security secret.
   - Terminates child processes gracefully on exit.

2. **Electron Renderer Process (Chromium / React & TypeScript)**:
   - Displays the interactive, premium wizard-driven user interface.
   - Manages state via Zustand (current project, active steps, pipelines, and results).
   - Communicates with the Python backend via local HTTP requests over Axios.
   - Leverages a secure, isolated `preload.ts` context bridge to access main process filesystem hooks.

3. **Python ML Backend Process (FastAPI)**:
   - Executes tabular dataset preprocessing, validation, profiling, and schema inference.
   - Orchestrates hyperparameter searches and automated training (AutoML) on candidate model families.
   - Persists project, snapshot, and run metadata via SQLite/SQLAlchemy.
   - Compiles and exports serialized ONNX/joblib models, pandas predictions, and PDF evaluation reports.

---

## 2. IPC Security Mechanism

To ensure maximum security and isolate local-only processes from external intrusion, OpenNeural enforces a strict zero-trust loopback boundary:

- **Localhost Binding**: The Python backend binds strictly to loopback IP `127.0.0.1`. It explicitly refuses any connection requests from external IPs or network interfaces.
- **Dynamic Port Selection**: On startup, the Main process scans and reserves a dynamic ephemeral port, passing it to the spawned Python process (via command line arguments `--port`). This avoids static port collisions and port scanning vulnerabilities.
- **Ephemeral Token Authentication**:
  1. The Main process generates an ephemeral, cryptographically secure shared validation key.
  2. This key is passed privately to the spawned Python process environment or command line parameter.
  3. All HTTP requests from the Renderer process to the Python backend must include this token in the custom `X-OpenNeural-Secret` header.
  4. The Python backend uses a custom middleware to reject all requests missing or possessing a mismatched validation secret.

---

## 3. File Storage Layout

OpenNeural operates entirely on-device, isolating all active files, artifacts, and databases inside a single user-home namespace:

```
~/openneural/ (Default Local Storage Root)
├── openneural.db                     # SQLite metadata database
├── snapshots/                        # Raw tabular dataset versions (e.g., checksum.csv)
├── pipelines/                        # Saved visual preprocessing configurations
├── models/                           # Serialized joblib and ONNX trained models
├── reports/                          # Generated PDF model evaluation reports
└── predictions/                      # CSV tables of test-set predictions
```

---

## 4. SQLite Schema Relationships

All project structural relationships, metadata snapshots, hyperparameter trials, evaluations, and export histories are mapped inside the relational schema below.

```
                  ┌──────────────────────┐
                  │         Auth         │
                  └──────────────────────┘
                  
                  ┌──────────────────────┐
                  │   SchemaMigration    │
                  └──────────────────────┘

                  ┌──────────────────────┐
                  │       Project        │
                  └──────────┬───────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │ 1                   │ 1                   │ 1
       ▼ 0..*                ▼ 0..*                ▼ 0..*
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│DatasetSnapshot│      │   Pipeline   │      │    Export    │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │ 1                   │ 1                   │
       │                     │                     │
       │ 0..*                │ 0..*                │ 1..*
       │              ┌──────▼───────┐             │
       └─────────────>│  Experiment  │<────────────┘
                      └──────┬───────┘
                             │ 1
                             ▼ 0..*
                      ┌──────────────┐
                      │     Run      │
                      └──────┬───────┘
                             │ 1
                             ▼ 0..*
                      ┌──────────────┐
                      │  Evaluation  │
                      └──────┬───────┘
                             │ 1
                             ▼ 0..*
                      ┌──────────────┐
                      │SubgroupAnalys│
                      └──────────────┘
```

### Table Properties and Schema Definition

1. **`Project`**: The parent container. Defined by unique UUID primary key, `name`, and ML `task_type` (`classification` or `regression`).
2. **`DatasetSnapshot`**: Immutable metadata representing a version of uploaded raw CSV or Parquet data. Linked to `Project`. Contains `checksum_sha256` and dataset profiles.
3. **`Pipeline`**: A sequential list of visual blocks serialized as JSON. Linked to `Project` and `DatasetSnapshot`.
4. **`Experiment`**: A versioned experiment run config. Linked to `Project` and `Pipeline`. Contains run status, parameters, and optimizer metrics.
5. **`Run`**: An individual trial or hyperparameter iteration. Linked to `Experiment`. Holds model families (e.g., Random Forest, XGBoost), parameters, metrics, and state.
6. **`Evaluation`**: Realized test-set outputs of the champion run. Linked to `Run` and `Experiment`. Stores threshold levels and confusion matrix objects.
7. **`SubgroupAnalysis`**: Target cohort slices evaluating performance disparities. Linked to `Evaluation`.
8. **`Export`**: Audit record of written artifacts. Contains specific file system targets, format types, and checksums. Linked to `Project` and `Experiment`.
