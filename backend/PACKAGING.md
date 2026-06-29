# Backend Packaging Strategy: PyInstaller

We have chosen **PyInstaller** over embedded CPython for bundling the Python backend. This document outlines the rationale behind this decision and the structure of our configuration.

## Rationale: PyInstaller vs. Embedded CPython

| Feature | PyInstaller (Chosen) | Embedded CPython |
|---|---|---|
| **Self-Contained** | Compiles Python code, C extensions, and dependencies into a single, cohesive directory. No need to manage external virtual environments or manual package installs in the production app. | Requires downloading and extracting a full Python runtime, manually installing dependencies for the exact target OS/architecture, and maintaining paths. |
| **Startup Performance** | Using a single-directory bundle (`--onedir`) avoids the extraction overhead of `--onefile`, matching the raw execution speed of embedded CPython. | Requires starting up the interpreter and loading site-packages dynamically, comparable to standard execution. |
| **Footprint Optimization** | Excludes unnecessary standard library modules (`tkinter`, `tcl`, `idlelib`, etc.) and non-essential binary/data files. | Bundles the complete standard library and site-packages, including unused components, increasing disk footprint. |
| **OS Portability** | Generates a binary customized for the build environment with automated dependency resolution. | Requires downloading different zip archives per target platform and maintaining complex logic to handle dynamic library resolution. |

## Configuration Details (`backend/openneural_backend.spec`)

- **Bundle Format**: `--onedir` (single-directory) to guarantee sub-second startup times.
- **Datas Included**:
  - `alembic/` (database migration scripts)
  - `alembic.ini` (database configuration)
- **Exclusions**: `tkinter`, `tcl`, `idlelib`, `unittest`, `pdb`, `pydoc`, and `lib2to3` are omitted to keep the bundle footprint minimal.
- **Hidden Imports**: Critical libraries (e.g., `uvicorn`, `alembic`, `sqlalchemy`, `sqlite3`, `pandas`, `pyarrow`, `xgboost`, `optuna`, `joblib`, `skl2onnx`, `onnx`, `reportlab`, `bcrypt`) are explicitly declared to ensure they are discovered and included by the packaging step.
