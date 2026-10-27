#!/usr/bin/env bash

# AGY Web Copilot Bridge Launcher (Root)
# Double-click in Finder to run!

cd "$(dirname "$0")/bridge" || exit 1
exec ./start_bridge.command
