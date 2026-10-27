#!/usr/bin/env bash

# AGY Web Copilot Bridge Launcher for macOS (.command)
# Double-click in Finder to run!

cd "$(dirname "$0")" || exit 1

if [ ! -f "start_bridge.sh" ]; then
    echo "[INFO] Downloading start_bridge.sh from GitHub..."
    curl -fsSL -o start_bridge.sh https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/start_bridge.sh
    chmod +x start_bridge.sh
fi

exec ./start_bridge.sh
