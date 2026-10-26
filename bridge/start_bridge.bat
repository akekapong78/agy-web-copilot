@echo off
title AGY Web Copilot - Auto Setup and Bridge
echo ======================================================================
echo    AGY Web Copilot Bridge (Standalone Setup)
echo ======================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found in PATH!
    echo Please install Python 3.10+ from python.org or Microsoft Store.
    echo.
    pause
    exit /b
)

where agy >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] agy CLI not found in PATH!
    echo.
)

cd /d "%~dp0"
if not exist "bridge_server.py" (
    echo [INFO] Downloading bridge_server.py from GitHub...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/bridge_server.py' -OutFile 'bridge_server.py'"
)

echo [INFO] Checking dependencies (FastAPI, Uvicorn)...
python -c "import fastapi, uvicorn" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing fastapi, uvicorn, pydantic...
    pip install fastapi uvicorn pydantic -q
)

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cls
echo ======================================================================
echo    AGY Web Copilot Bridge running at http://127.0.0.1:8765
echo    (Keep this window open while using Chrome Extension)
echo ======================================================================
echo.
python bridge_server.py
echo.
pause
