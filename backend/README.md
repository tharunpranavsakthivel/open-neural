# OpenNeural Backend

The machine learning backend for OpenNeural. It runs as a FastAPI HTTP server which is spawned and managed by the Electron desktop shell.

## Python Environment Setup

The backend requires Python 3.10+ (Python 3.11 recommended).

1. **Create a Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install Dependencies**:
   Install core and development requirements:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```
   Or editable install:
   ```bash
   pip install -e .
   ```

## Running the FastAPI Server in Development

To start the FastAPI backend server manually on port `8765` with a temporary development directory:

```bash
python -m openneural_backend --port 8765 --data-dir /tmp/openneural_dev
```

- `--port`: The local port the HTTP server binds to (default: random free port).
- `--data-dir`: The base directory where OpenNeural stores configuration, SQLite databases, and snapshots (default: `~/openneural`).

Once running, interactive OpenAPI/Swagger docs are available at `http://127.0.0.1:8765/docs` or `http://127.0.0.1:8765/redoc`.

## Running Database Migrations

OpenNeural uses Alembic to manage database schema migrations for SQLite.

1. **Check Migration Status**:
   ```bash
   alembic current
   ```

2. **Run Outstanding Migrations**:
   ```bash
   alembic upgrade head
   ```

3. **Revert Migrations (Rollback)**:
   ```bash
   alembic downgrade -1
   ```

## Running Tests

We use `pytest` for unit and integration testing.

To run the full backend test suite:
```bash
pytest
```

To run with coverage reporting:
```bash
pytest --cov=openneural_backend
```
