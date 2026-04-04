#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  Video Analyse — starting up"
echo "========================================="

# ── Python virtual environment ────────────────────────────────────────────────
if [ ! -d "backend/.venv" ]; then
  echo ""
  echo "Creating Python virtual environment..."
  python3.12 -m venv backend/.venv
  echo "Installing Python dependencies (this may take a few minutes)..."
  backend/.venv/bin/pip install --upgrade pip --quiet
  backend/.venv/bin/pip install -r backend/requirements.txt
  echo "Python dependencies installed."
else
  echo "Python venv found. Skipping install."
fi

# ── Start backend (from project root so 'backend.main:app' module path works) ─
echo ""
echo "Starting backend on http://localhost:8000 ..."
backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend dependencies ──────────────────────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
  echo ""
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
  echo "Frontend dependencies installed."
else
  echo "node_modules found. Skipping install."
fi

# ── Start frontend ─────────────────────────────────────────────────────────────
echo ""
echo "Starting frontend on http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  App running at http://localhost:5173"
echo "  Backend API at http://localhost:8000"
echo "  Press Ctrl+C to stop both servers"
echo "========================================="

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM

wait
