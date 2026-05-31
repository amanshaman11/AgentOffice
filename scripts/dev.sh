#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d ".venv" ]]; then
  echo "Error: .venv not found."
  echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [[ ! -x ".venv/bin/uvicorn" ]]; then
  echo "Error: uvicorn not installed in .venv."
  echo "Run: source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [[ ! -d "frontend/node_modules" ]]; then
  echo "Error: frontend/node_modules not found."
  echo "Run: cd frontend && npm install"
  exit 1
fi

cleanup() {
  trap - INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend  → http://localhost:8000"
echo "Starting frontend → http://localhost:3000"
echo "Press Ctrl+C to stop both"
echo

.venv/bin/uvicorn src.lib.server:app --reload --port 8000 &
(cd frontend && npm run dev) &
wait
