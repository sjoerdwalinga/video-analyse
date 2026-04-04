@echo off
setlocal enabledelayedexpansion

echo =========================================
echo   Video Analyse -- starting up
echo =========================================

cd /d "%~dp0"

:: ── Python virtual environment ────────────────────────────────────────────────
if not exist "backend\.venv" (
    echo.
    echo Creating Python virtual environment...
    python -m venv backend\.venv
    echo Installing Python dependencies ^(this may take a few minutes^)...
    backend\.venv\Scripts\pip install --upgrade pip --quiet
    backend\.venv\Scripts\pip install -r backend\requirements.txt
    echo Python dependencies installed.
) else (
    echo Python venv found. Skipping install.
)

:: ── Start backend ──────────────────────────────────────────────────────────────
echo.
echo Starting backend on http://localhost:8000 ...
start "Video-Analyse Backend" /B backend\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

:: ── Frontend dependencies ──────────────────────────────────────────────────────
if not exist "frontend\node_modules" (
    echo.
    echo Installing frontend dependencies...
    pushd frontend
    npm install
    popd
    echo Frontend dependencies installed.
) else (
    echo node_modules found. Skipping install.
)

:: ── Start frontend ──────────────────────────────────────────────────────────────
echo.
echo Starting frontend on http://localhost:5173 ...
start "Video-Analyse Frontend" /B cmd /c "cd frontend && npm run dev"

echo.
echo =========================================
echo   App running at http://localhost:5173
echo   Backend API at http://localhost:8000
echo   Close this window to stop both servers
echo =========================================

pause
