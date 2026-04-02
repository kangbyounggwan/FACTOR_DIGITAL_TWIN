#!/bin/bash

echo "================================================"
echo "  FACTOR Digital Twin - Starting Services"
echo "================================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Python path (adjust if needed)
PYTHON_PATH="${PYTHON_PATH:-python}"

# Start Backend
echo "[1/2] Starting Backend (FastAPI on port 8000)..."
cd "$SCRIPT_DIR/backend"
$PYTHON_PATH -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to initialize
sleep 2

# Start Frontend
echo "[2/2] Starting Frontend (Vite on port 5173)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================================"
echo "  Services Started!"
echo "================================================"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "  Frontend: http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop all services."
echo "================================================"

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
