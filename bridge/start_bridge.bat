@echo off
title AGY Web Copilot Bridge (Standalone - No Python Needed)
echo ======================================================================
echo    AGY Web Copilot Bridge (Standalone Setup)
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. หากมี agy-bridge.exe อยู่แล้ว ให้รันทันที
if exist "agy-bridge.exe" (
    goto RUN
)
if exist "dist\agy-bridge\agy-bridge.exe" (
    cd dist\agy-bridge
    goto RUN
)

:: 2. หากยังไม่มี agy-bridge.exe ให้ดาวน์โหลดตัวพร้อมใช้งานจาก GitHub Release
echo [INFO] ไม่พบไฟล์ executable ในเครื่อง กำลังดาวน์โหลดตัว Standalone จาก GitHub...
echo (ไม่ต้องติดตั้ง Python หรือไลบรารีใดๆ)
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/akekapong78/agy-web-copilot/releases/download/v1.0.0/agy-bridge-windows.zip' -OutFile 'agy-bridge-windows.zip'"

if exist "agy-bridge-windows.zip" (
    echo [INFO] กำลังคลายไฟล์...
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
    echo [ERROR] ไม่สามารถเริ่มรัน agy-bridge.exe ได้
    echo สามารถดาวน์โหลดตรงได้ที่: https://github.com/akekapong78/agy-web-copilot/releases
)

echo.
pause
