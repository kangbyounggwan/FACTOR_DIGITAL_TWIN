@echo off
echo ================================================
echo   FACTOR Digital Twin - Starting Services
echo ================================================
echo.

REM Set Python path (Anaconda)
set PYTHON_PATH=C:\Users\USER\anaconda3\python.exe

REM Start Backend (FastAPI)
echo [1/2] Starting Backend (FastAPI on port 8000)...
cd /d "%~dp0backend"
start "FACTOR Backend" cmd /k "%PYTHON_PATH% -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

REM Start Frontend (Vite)
echo [2/2] Starting Frontend (Vite on port 5173)...
cd /d "%~dp0frontend"
start "FACTOR Frontend" cmd /k "npm run dev"

echo.
echo ================================================
echo   Services Started!
echo ================================================
echo.
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:5173
echo.
echo   Close the terminal windows to stop services.
echo ================================================
