#!/usr/bin/env bash
#
# Bootstrap script for OpenNeural development environment.
#
# This script installs all workspace dependencies and sets up the initial
# development environment including:
#   - Node.js dependencies via npm
#   - Python virtual environment and dependencies
#   - Initial database setup with Alembic migrations
#
# Usage:
#   ./scripts/bootstrap.sh [options]
#
# Options:
#   --skip-python     Skip Python setup (useful if already configured)
#   --skip-node       Skip Node.js setup (useful if already configured)
#   --skip-db         Skip database migration
#   --clean           Clean existing node_modules and .venv before install
#   --help            Show this help message
#
# Examples:
#   ./scripts/bootstrap.sh                    # Full setup
#   ./scripts/bootstrap.sh --clean            # Clean install
#   ./scripts/bootstrap.sh --skip-python      # Only Node.js setup
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"
PYTHON_VERSION="3.11"

# Flags
SKIP_PYTHON=false
SKIP_NODE=false
SKIP_DB=false
CLEAN=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    head -n 25 "$0" | tail -n 23 | sed 's/^# //'
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-python)
            SKIP_PYTHON=true
            shift
            ;;
        --skip-node)
            SKIP_NODE=true
            shift
            ;;
        --skip-db)
            SKIP_DB=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 20+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -lt 20 ]]; then
        log_error "Node.js 20+ is required. Found: $(node --version)"
        exit 1
    fi
    log_success "Node.js $(node --version) found"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install Python ${PYTHON_VERSION}+ first."
        exit 1
    fi
    
    PYTHON_CMD=$(command -v python3)
    log_success "Python found at: $PYTHON_CMD"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm 10+ first."
        exit 1
    fi
    log_success "npm $(npm --version) found"
}

# Clean existing installations
clean_installations() {
    if [[ "$CLEAN" == true ]]; then
        log_info "Cleaning existing installations..."
        
        # Remove node_modules
        if [[ -d "${PROJECT_ROOT}/node_modules" ]]; then
            rm -rf "${PROJECT_ROOT}/node_modules"
            log_info "Removed node_modules/"
        fi
        
        # Remove workspace node_modules
        for workspace in frontend electron backend; do
            if [[ -d "${PROJECT_ROOT}/${workspace}/node_modules" ]]; then
                rm -rf "${PROJECT_ROOT}/${workspace}/node_modules"
                log_info "Removed ${workspace}/node_modules/"
            fi
        done
        
        # Remove Python virtual environment
        if [[ -d "$VENV_DIR" ]]; then
            rm -rf "$VENV_DIR"
            log_info "Removed .venv/"
        fi
        
        log_success "Clean completed"
    fi
}

# Install Node.js dependencies
install_node_deps() {
    if [[ "$SKIP_NODE" == true ]]; then
        log_info "Skipping Node.js setup (--skip-node)"
        return
    fi
    
    log_info "Installing Node.js dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install root dependencies
    log_info "Installing root dependencies..."
    npm install
    
    # Verify workspace dependencies
    log_info "Verifying workspace dependencies..."
    npm run install:node 2>/dev/null || true
    
    log_success "Node.js dependencies installed"
}

# Setup Python environment
setup_python() {
    if [[ "$SKIP_PYTHON" == true ]]; then
        log_info "Skipping Python setup (--skip-python)"
        return
    fi
    
    log_info "Setting up Python environment..."
    
    cd "$PROJECT_ROOT"
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "$VENV_DIR" ]]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv "$VENV_DIR"
    else
        log_info "Virtual environment already exists"
    fi
    
    # Activate virtual environment
    source "${VENV_DIR}/bin/activate"
    
    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip
    
    # Install requirements
    log_info "Installing Python dependencies..."
    pip install -r backend/requirements.txt
    
    # Install package in editable mode
    log_info "Installing openneural-backend package..."
    pip install -e backend
    
    log_success "Python environment configured"
}

# Setup database
setup_database() {
    if [[ "$SKIP_DB" == true ]]; then
        log_info "Skipping database setup (--skip-db)"
        return
    fi
    
    log_info "Setting up database..."
    
    cd "$PROJECT_ROOT"
    
    # Activate virtual environment if not already active
    if [[ -z "${VIRTUAL_ENV:-}" ]]; then
        source "${VENV_DIR}/bin/activate"
    fi
    
    # Check if alembic is available
    if ! command -v alembic &> /dev/null; then
        log_warning "Alembic not found. Database migrations may not be available yet."
        return
    fi
    
    # Run Alembic migrations if they exist
    if [[ -d "${PROJECT_ROOT}/backend/alembic" ]]; then
        log_info "Running database migrations..."
        cd "${PROJECT_ROOT}/backend"
        alembic upgrade head || log_warning "Migration failed - you may need to run it manually"
        cd "$PROJECT_ROOT"
    else
        log_info "No Alembic migrations found. Skipping database setup."
        log_info "Run 'alembic init alembic' in the backend directory to initialize migrations."
    fi
    
    log_success "Database setup completed"
}

# Create .env file if it doesn't exist
create_env_file() {
    if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
        log_info "Creating .env file..."
        cat > "${PROJECT_ROOT}/.env" << 'EOF'
# OpenNeural Environment Configuration
NODE_ENV=development
PYTHON_ENV=development

# Backend Configuration
OPENNEURAL_BACKEND_HOST=127.0.0.1
OPENNEURAL_BACKEND_PORT=8000

# Database
OPENNEURAL_DATABASE_URL=sqlite:///./openneural.db

# Frontend
OPENNEURAL_RENDERER_URL=http://127.0.0.1:5173
EOF
        log_success ".env file created"
    else
        log_info ".env file already exists"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "========================================"
    log_success "OpenNeural bootstrap completed!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Start development servers:"
    echo "     npm run dev"
    echo ""
    echo "  2. Or start individual services:"
    echo "     npm run dev:frontend  # React dev server"
    echo "     npm run dev:electron  # Electron shell"
    echo "     npm run dev:backend   # Python backend"
    echo ""
    echo "  3. Build for production:"
    echo "     npm run build"
    echo ""
    echo "  4. Package the application:"
    echo "     cd electron && npm run package"
    echo ""
    echo "Documentation:"
    echo "  - README.md           # Project overview"
    echo "  - AGENTS.md           # Development guidelines"
    echo "  - CONTEXT.md          # Product requirements"
    echo ""
    echo "Happy coding! 🚀"
    echo ""
}

# Main execution
main() {
    echo "========================================"
    echo "OpenNeural Bootstrap"
    echo "========================================"
    echo ""
    
    check_prerequisites
    clean_installations
    install_node_deps
    setup_python
    setup_database
    create_env_file
    print_summary
}

main "$@"
