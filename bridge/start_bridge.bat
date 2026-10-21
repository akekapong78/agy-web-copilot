@echo off
title AGY Web Copilot Bridge
echo ============================================================
echo   Starting AGY Web Copilot Bridge Service...
echo ============================================================
cd /d "%~dp0"
python bridge_server.py
pause
