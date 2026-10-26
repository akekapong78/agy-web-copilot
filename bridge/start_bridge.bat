@echo off
title AGY Web Copilot - Auto Setup ^& Bridge
chcp 65001 >nul
echo ======================================================================
echo    AGY Web Copilot Bridge (Standalone Setup)
echo ======================================================================
echo.

:: 1. ตรวจสอบ Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] ไม่พบ Python ในเครื่องนี้!
    echo กรุณาติดตั้ง Python 3.10 ขึ้นไปจาก Microsoft Store หรือ python.org
    echo อย่าลืมติ๊กเลือก "Add Python to PATH" ตอนติดตั้งด้วยครับ
    echo.
    pause
    exit /b
)

:: 2. ตรวจสอบ AGY CLI
where agy >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] ไม่พบ agy CLI ในระบบ!
    echo หากยังไม่ได้ติดตั้ง AGY สามารถติดตั้งได้ผ่าน PowerShell:
    echo irm https://raw.githubusercontent.com/google-deepmind/antigravity/main/install.ps1 ^| iex
    echo หรือดูวิธีติดตั้งที่: https://github.com/google-deepmind/antigravity
    echo.
)

:: 3. ดาวน์โหลด bridge_server.py หากยังไม่มีในโฟลเดอร์เดียวกัน
cd /d "%~dp0"
if not exist "bridge_server.py" (
    echo [INFO] กำลังดาวน์โหลด bridge_server.py จาก GitHub...
    curl -sL https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/bridge_server.py -o bridge_server.py
    if not exist "bridge_server.py" (
        powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/akekapong78/agy-web-copilot/main/bridge/bridge_server.py' -OutFile 'bridge_server.py'"
    )
)

:: 4. ติดตั้ง Python Libraries ที่จำเป็น
echo [INFO] ตรวจสอบ FastAPI, Uvicorn...
python -c "import fastapi, uvicorn" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] กำลังติดตั้ง fastapi, uvicorn...
    pip install fastapi uvicorn pydantic -q
)

:: 5. เริ่มรัน Service
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cls
echo ======================================================================
echo    AGY Web Copilot Bridge กำลังทำงานที่ http://127.0.0.1:8765
echo    (เปิดหน้าต่างนี้ทิ้งไว้ขณะใช้งาน Chrome Extension)
echo ======================================================================
echo.
python bridge_server.py
echo.
echo [Bridge หยุดทำงาน หรือมีข้อผิดพลาดด้านบน]
pause
