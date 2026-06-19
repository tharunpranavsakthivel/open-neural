# OpenNeural

OpenNeural is a local-first, no-code machine learning experimentation desktop application. It enables academic researchers, ML engineers, and data scientists to train, evaluate, compare, and export classical ML models on structured tabular datasets — entirely on their own machine, without cloud accounts, infrastructure setup, or programming knowledge.

## Features

- **Local-first**: All data stays on your machine. No cloud accounts or data egress required.
- **No-code by default**: Guided wizard interface for the full ML pipeline.
- **AutoML**: Automatic model selection and hyperparameter tuning with manual override.
- **Reproducibility**: Every experiment is fully versioned and traceable.
- **Export**: Models exported in ONNX and joblib formats; evaluation reports as PDF.

## System Requirements

- **Operating System**: macOS 12+ (Apple Silicon or Intel), Windows 10/11, Ubuntu 22.04 LTS
- **Node.js**: 20.0.0 or higher
- **npm**: 10.0.0 or higher
- **Python**: 3.11 or higher
- **RAM**: 8 GB minimum, 16 GB recommended
- **Disk Space**: 2 GB free space

## Quick Start

### One-Line Setup

```bash
git clone https://github.com/openneural/openneural.git
cd openneural
./scripts/bootstrap.sh
```

This will:
1. Install all Node.js dependencies (`npm install`)
2. Create a Python virtual environment (`.venv/`)
3. Install Python dependencies (`pip install -r backend/requirements.txt`)
4. Set up the initial database (if migrations exist)
5. Create a `.env` file with default configuration

### Start Development

```bash
# Start all development servers (frontend, electron, backend)
npm run dev
```

Or start individual services:

```bash
# React frontend (Vite dev server)
npm run dev:frontend

# Electron shell
npm run dev:electron

# Python backend (FastAPI + Uvicorn)
npm run dev:backend
```

## Workspace Structure

OpenNeural is organized as a monorepo with three main workspaces:

```
openneural/
├── electron/           # Electron shell (main process + preload)
│   ├── src/
│   │   ├── main.ts   # Main Electron process
│   │   └── preload.ts # Preload script with contextBridge
│   ├── renderer/       # Renderer fallback HTML
│   └── dist/           # Compiled TypeScript output
├── frontend/           # React 18 + TypeScript renderer
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── stores/     # Zustand state management
│   │   └── main.tsx    # Application entry point
│   └── dist/           # Vite build output
├── backend/            # Python FastAPI ML service
│   ├── openneural_backend/
│   │   ├── __init__.py
│   │   ├── __main__.py  # CLI entry point
│   │   └── app.py       # FastAPI application
│   ├── test/           # Python unit tests
│   └── requirements.txt # Python dependencies
├── scripts/            # Build and utility scripts
│   ├── bootstrap.sh   # One-command setup
│   └── verify_deps.py # Dependency verification
└── .kilo/             # AI agent configuration
    └── agents/

```

## Development Commands

### Install Dependencies

```bash
# All workspaces (Node.js only)
npm install

# Python backend
pip install -r backend/requirements.txt
pip install -e backend

# One-command setup
./scripts/bootstrap.sh
```

### Build

```bash
# Build all workspaces
npm run build

# Build individual workspaces
npm run build:frontend
npm run build:electron
npm run build:backend
```

### Test

```bash
# Run all tests
npm run test

# Frontend tests (Vitest)
cd frontend && npm run test

# Backend tests (pytest)
cd backend && python -m pytest
```

### Package

```bash
# Package Electron app for current platform
cd electron && npm run package

# Package for specific platforms
cd electron && npm run package:mac
cd electron && npm run package:win
cd electron && npm run package:linux
```

## Makefile

A `Makefile` is provided with common tasks:

```bash
make help      # Show available commands
make install   # Install all dependencies
make dev       # Start development servers
make build     # Build all workspaces
make test      # Run all tests
make package   # Package Electron app
make clean     # Clean build artifacts
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript 5
- **Build Tool**: Vite 5
- **State Management**: Zustand 4
- **HTTP Client**: Axios
- **UI Components**: Radix UI primitives
- **Testing**: Vitest + Testing Library

### Electron
- **Version**: 30.x
- **TypeScript**: 5.x with CommonJS output
- **Packaging**: electron-builder 24.x

### Backend
- **Framework**: FastAPI 0.110+
- **ASGI Server**: Uvicorn
- **Database**: SQLite with SQLAlchemy 2.0+
- **Migrations**: Alembic
- **ML Libraries**: scikit-learn 1.4+, XGBoost 2.0+, Optuna 3.5+
- **Model Export**: skl2onnx, ONNX
- **Security**: bcrypt for password hashing

## Development Guidelines

See [AGENTS.md](AGENTS.md) for detailed coding standards and development practices:

- Task completion mindset
- Context gathering requirements
- Code documentation standards
- Error handling patterns
- Testing requirements
- File organization
- Security practices

## Product Requirements

See [CONTEXT.md](CONTEXT.md) for complete product and technical documentation:

- Product Requirements Document (PRD)
- Software Requirements Specification (SRS)
- Technical Design Document (TDD)
- API contracts
- Database schema

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/openneural/openneural/issues)
- **Documentation**: [Wiki](https://github.com/openneural/openneural/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/openneural/openneural/discussions)

---

**Note**: OpenNeural is currently in alpha (v0.1.0). APIs and features may change. Not recommended for production use.
