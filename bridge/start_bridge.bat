@echo off
chcp 65001 >nul
title AGY Web Copilot Bridge (Standalone)

echo ======================================================================
echo    AGY Web Copilot Bridge (Standalone Setup)
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. If agy-bridge.exe exists in root or dist, launch immediately
if exist "agy-bridge.exe" (
    goto RUN
)
if exist "dist\agy-bridge\agy-bridge.exe" (
    cd dist\agy-bridge
    goto RUN
)

:: 2. If not found, download prebuilt standalone binary with embedded icon from GitHub Release
echo [INFO] Downloading prebuilt standalone AGY Bridge from GitHub...
echo (No Python or additional dependencies required)
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/akekapong78/agy-web-copilot/releases/download/v1.0.0/agy-bridge-windows.zip' -OutFile 'agy-bridge-windows.zip'"

if exist "agy-bridge-windows.zip" (
    echo [INFO] Extracting files...
    powershell -Command "Expand-Archive -Path 'agy-bridge-windows.zip' -DestinationPath '.' -Force"
    del agy-bridge-windows.zip
)

:RUN
if exist "agy-bridge.exe" (
    cls
    echo ======================================================================
    echo    AGY Web Copilot Bridge running at http://127.0.0.1:8765
    echo    (Keep this window open while using Chrome Extension)
    echo ======================================================================
    echo.
    agy-bridge.exe
) else (
    echo [ERROR] Could not find or launch agy-bridge.exe
    echo You can download directly from: https://github.com/akekapong78/agy-web-copilot/releases
)

echo.
pause
