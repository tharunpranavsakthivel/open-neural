# Alembic Migrations for OpenNeural

This directory contains Alembic database migrations for the OpenNeural backend.

## Usage

### Create a new migration

```bash
cd /path/to/open-neural/backend
alembic revision --autogenerate -m "Description of changes"
```

### Run migrations

```bash
cd /path/to/open-neural/backend
alembic upgrade head
```

### Downgrade migrations

```bash
cd /path/to/open-neural/backend
alembic downgrade -1
```

### View current version

```bash
cd /path/to/open-neural/backend
alembic current
```

### View migration history

```bash
cd /path/to/open-neural/backend
alembic history
```

## Configuration

The `env.py` file is configured to:

- Use the runtime `OPENNEURAL_DATA_DIR` environment variable to locate the database
- Fall back to `~/.openneural/` if `OPENNEURAL_DATA_DIR` is not set
- Use `Base.metadata` from `openneural_backend.db.models` for autogenerate support
- Enable foreign key constraints and batch mode for SQLite compatibility

## Database Location

The database path is determined by the `OPENNEURAL_DATA_DIR` environment variable:

- If set: `{OPENNEURAL_DATA_DIR}/openneural.db`
- If not set: `~/.openneural/openneural.db`

This ensures migrations run against the same database as the application.
