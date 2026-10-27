#!/usr/bin/env bash

# AGY Web Copilot Bridge Launcher for macOS / Linux
echo "======================================================================"
echo "   AGY Web Copilot Bridge (macOS / Linux Launcher)"
echo "======================================================================"
echo ""

# Change to script directory
cd "$(dirname "$0")" || exit 1

# Check if Python 3 is installed
SYSTEM_PYTHON=""
if command -v python3 >/dev/null 2>&1; then
    SYSTEM_PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
    SYSTEM_PYTHON="python"
fi

if [ -z "$SYSTEM_PYTHON" ] && [ ! -x ".venv/bin/python" ]; then
    echo "❌ [ERROR] Python 3 is not installed or not in your PATH."
    echo "Please install Python 3 (e.g. via Homebrew: 'brew install python3') and try again."
    echo ""
    exit 1
fi

# Create virtual environment if needed (for PEP 668 externally managed environment compatibility)
if [ ! -d ".venv" ] && [ -n "$SYSTEM_PYTHON" ]; then
    echo "[INFO] Creating virtual environment (.venv)..."
    $SYSTEM_PYTHON -m venv .venv >/dev/null 2>&1
fi

if [ -x ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
else
    PYTHON_BIN="$SYSTEM_PYTHON"
fi

# Ensure required Python libraries are available
echo "[INFO] Checking dependencies (fastapi, uvicorn, pydantic)..."
$PYTHON_BIN -c "import fastapi, uvicorn, pydantic" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "[INFO] Installing required dependencies..."
    $PYTHON_BIN -m pip install --quiet fastapi "uvicorn[standard]" pydantic
fi

# Ensure bridge_server.py is present
if [ ! -f "bridge_server.py" ]; then
    echo "[INFO] Downloading bridge_server.py from GitHub..."
    curl -fsSL -o bridge_server.py https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/bridge_server.py
fi

echo ""
echo "======================================================================"
echo "   AGY Web Copilot Bridge running at http://127.0.0.1:8765"
echo "   (Keep this Terminal window open while using Chrome Extension)"
echo "======================================================================"
echo ""

# Run bridge server
$PYTHON_BIN bridge_server.py
