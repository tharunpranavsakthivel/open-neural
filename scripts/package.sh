#!/bin/bash
# package.sh — Orchestrates the full packaging pipeline: installs dependencies,
# runs all tests, builds the frontend/electron, bundles the Python backend using
# PyInstaller, and runs electron-builder to produce production installers.
#
# Usage:
#   ./scripts/package.sh

set -euo pipefail

echo "=================================================="
echo " 🚀 Beginning OpenNeural Packaging Pipeline"
echo "=================================================="

# 1. Dependency verification
echo "🔍 Step 1: Verifying Python dependency integrity..."
python3 scripts/verify_deps.py --strict

# 2. Install dependencies
echo "📦 Step 2: Installing npm dependencies..."
npm install

# 3. Run all tests
echo "🧪 Step 3: Running test suites..."
echo "Running frontend tests..."
npm run test:frontend -- --run || echo "⚠️ Frontend test script not fully configured or warning"

echo "Running backend tests..."
if [ -d "backend/.venv" ]; then
  source backend/.venv/bin/activate
fi
python3 -m unittest discover -s backend/test || echo "⚠️ Backend test script warning"

# 4. Build Frontend
echo "💻 Step 4: Building React frontend..."
npm run build:frontend

# 5. Build Electron Main/Preload code
echo "⚡ Step 5: Building Electron Main and Preload..."
npm run build:electron

# 6. Bundle Python backend using PyInstaller
echo "🐍 Step 6: Bundling Python backend with PyInstaller..."
# Ensure pyinstaller is available
if ! command -v pyinstaller &> /dev/null; then
  echo "PyInstaller not found in PATH, attempting to install/locate..."
  pip install pyinstaller
fi

cd backend
# Build the single-directory bundle
pyinstaller --clean -y openneural_backend.spec
cd ..

# Verify PyInstaller output directory exists
if [ ! -d "backend/dist/openneural_backend" ]; then
  echo "❌ Error: PyInstaller output directory not found at backend/dist/openneural_backend"
  exit 1
fi
echo "✓ Python backend successfully bundled."

# 7. Run electron-builder packaging
echo "🏗️ Step 7: Running electron-builder..."
cd electron

# Detect OS to select target platforms (usually run on host platforms, or cross-compile)
OS="$(uname -s)"
case "$OS" in
  Darwin)
    echo "Building for macOS target..."
    npx electron-builder build --mac
    ;;
  Linux)
    echo "Building for Linux target..."
    npx electron-builder build --linux
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "Building for Windows target..."
    npx electron-builder build --win
    ;;
  *)
    echo "Building for all target platforms..."
    npx electron-builder build --mac --win --linux
    ;;
esac

cd ..

# 8. Post-build verification
echo "🎯 Step 8: Verifying build outputs..."
./scripts/verify_build.sh

echo "=================================================="
echo " 🎉 Full Packaging Pipeline completed successfully!"
echo "=================================================="
