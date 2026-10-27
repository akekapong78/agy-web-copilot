#!/usr/bin/env bash

# AGY Web Copilot Bridge Launcher for macOS / Linux
echo "======================================================================"
echo "   AGY Web Copilot Bridge (macOS / Linux Launcher)"
echo "======================================================================"
echo ""

# Change to script directory
cd "$(dirname "$0")" || exit 1

# Check if Python 3 is installed
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "❌ [ERROR] Python 3 is not installed or not in your PATH."
    echo "Please install Python 3 (e.g. via Homebrew: 'brew install python3') and try again."
    echo ""
    exit 1
fi

# Ensure required Python libraries are available
echo "[INFO] Checking dependencies (fastapi, uvicorn, pydantic)..."
$PYTHON_BIN -c "import fastapi, uvicorn, pydantic" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "[INFO] Installing required dependencies..."
    $PYTHON_BIN -m pip install --quiet fastapi "uvicorn[standard]" pydantic
fi

echo ""
echo "======================================================================"
echo "   AGY Web Copilot Bridge running at http://127.0.0.1:8765"
echo "   (Keep this Terminal window open while using Chrome Extension)"
echo "======================================================================"
echo ""

# Run bridge server
$PYTHON_BIN bridge_server.py
