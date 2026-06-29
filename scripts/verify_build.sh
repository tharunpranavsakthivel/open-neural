#!/bin/bash
# verify_build.sh — Verify that packaged installers exist and the embedded Python backend starts successfully.
#
# Usage:
#   ./scripts/verify_build.sh

set -euo pipefail

echo "=================================================="
echo " Starting Post-Build Package Verification"
echo "=================================================="

# Detect operating system
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS (${ARCH})"

# 1. Check for expected build outputs
case "$OS" in
  Darwin)
    echo "Verifying macOS bundle..."
    # Match any dmg file in electron/dist/
    DMG_FILE=$(find electron/dist -maxdepth 1 -name "*.dmg" -print -quit)
    if [ -z "$DMG_FILE" ]; then
      echo "❌ Error: Could not find packaged .dmg installer in electron/dist/"
      exit 1
    fi
    echo "✓ Found .dmg installer: $DMG_FILE"

    # Find the unpacked App for embedded binary testing
    UNPACKED_APP=$(find electron/dist/mac*/ -name "OpenNeural.app" -print -quit || find electron/dist/mac/ -name "OpenNeural.app" -print -quit || echo "")
    if [ -z "$UNPACKED_APP" ] || [ ! -d "$UNPACKED_APP" ]; then
      echo "❌ Error: Could not find unpacked OpenNeural.app directory under electron/dist/mac*"
      exit 1
    fi
    echo "✓ Found unpacked App: $UNPACKED_APP"
    BACKEND_EXE="$UNPACKED_APP/Contents/Resources/backend/openneural_backend"
    ;;

  Linux)
    echo "Verifying Linux bundle..."
    APPIMAGE_FILE=$(find electron/dist -maxdepth 1 -name "*.AppImage" -print -quit)
    if [ -z "$APPIMAGE_FILE" ]; then
      echo "❌ Error: Could not find packaged .AppImage in electron/dist/"
      exit 1
    fi
    echo "✓ Found .AppImage package: $APPIMAGE_FILE"

    # Find the unpacked backend
    BACKEND_EXE="electron/dist/linux-unpacked/resources/backend/openneural_backend"
    ;;

  MINGW*|MSYS*|CYGWIN*)
    echo "Verifying Windows bundle..."
    EXE_FILE=$(find electron/dist -maxdepth 1 -name "*.exe" -print -quit)
    if [ -z "$EXE_FILE" ]; then
      echo "❌ Error: Could not find packaged NSIS .exe installer in electron/dist/"
      exit 1
    fi
    echo "✓ Found .exe installer: $EXE_FILE"

    BACKEND_EXE="electron/dist/win-unpacked/resources/backend/openneural_backend.exe"
    ;;

  *)
    echo "❌ Error: Unsupported platform $OS"
    exit 1
    ;;
esac

# 2. Check if the embedded backend executable exists
if [ ! -f "$BACKEND_EXE" ]; then
  echo "❌ Error: Embedded Python backend executable not found at: $BACKEND_EXE"
  exit 1
fi
echo "✓ Found embedded Python backend executable: $BACKEND_EXE"

# 3. Test launch the embedded Python backend
echo "--------------------------------------------------"
echo " Launching embedded Python backend in test mode..."
echo " Expecting 'OPENNEURAL_PORT=' line within 10 seconds..."
echo "--------------------------------------------------"

# Prepare temporary log file
LOG_FILE=$(mktemp)
trap 'rm -f "$LOG_FILE"' EXIT

# Generate secure token
TEST_SECRET="verification-test-token"

# Start backend process in background
# Pass --port 0 to auto-assign port
# Pass --data-dir to a temporary folder
TEMP_DATA_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DATA_DIR" "$LOG_FILE"' EXIT

export OPENNEURAL_SECRET="$TEST_SECRET"
"$BACKEND_EXE" --port 0 --data-dir "$TEMP_DATA_DIR" > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!

# Ensure background process is terminated on script exit
trap 'kill $BACKEND_PID 2>/dev/null || true; rm -rf "$TEMP_DATA_DIR" "$LOG_FILE"' EXIT

# Poll log file for port announcement
start_time=$(date +%s)
success=false

while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  if grep -q "OPENNEURAL_PORT=" "$LOG_FILE"; then
    PORT_LINE=$(grep "OPENNEURAL_PORT=" "$LOG_FILE")
    echo "✓ Success! Detected port announcement:"
    echo "  $PORT_LINE"
    success=true
    break
  fi

  if [ "$elapsed" -ge 10 ]; then
    echo "❌ Error: Timeout waiting for port announcement (10s elapsed)"
    echo "--- Last 20 lines of backend logs ---"
    tail -n 20 "$LOG_FILE"
    echo "-------------------------------------"
    break
  fi

  sleep 0.5
done

# Clean up backend
echo "Shutting down test backend..."
kill $BACKEND_PID 2>/dev/null || true
wait $BACKEND_PID 2>/dev/null || true

if [ "$success" = "true" ]; then
  echo "=================================================="
  echo " 🎉 Verification PASSED successfully!"
  echo "=================================================="
  exit 0
else
  echo "=================================================="
  echo " ❌ Verification FAILED!"
  echo "=================================================="
  exit 1
fi
