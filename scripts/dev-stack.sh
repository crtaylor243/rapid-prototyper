#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/.logs"
API_LOG="${LOG_DIR}/api.log"
UI_LOG="${LOG_DIR}/ui.log"
WORKER_LOG="${LOG_DIR}/worker.log"

mkdir -p "${LOG_DIR}"
truncate -s 0 "${API_LOG}"
truncate -s 0 "${UI_LOG}"
truncate -s 0 "${WORKER_LOG}"

cd "${ROOT_DIR}"

echo "[dev-stack] Running database migrations and seeds..."
npm run db:init

cleanup() {
  echo
  echo "[dev-stack] Shutting down..."
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${UI_PID:-}" ]]; then
    kill "${UI_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${WORKER_PID:-}" ]]; then
    kill "${WORKER_PID}" >/dev/null 2>&1 || true
  fi
  wait "${API_PID:-}" "${UI_PID:-}" "${WORKER_PID:-}" >/dev/null 2>&1 || true
}
trap cleanup INT TERM

prefix_and_tee() {
  local label="$1"
  local log_file="$2"
  local pid_var="$3"
  shift 3

  (
    set -o pipefail
    "$@" 2>&1 | while IFS= read -r line || [[ -n "$line" ]]; do
      printf '[%s] %s\n' "${label}" "${line}"
    done | tee -a "${log_file}"
  ) &

  local pid=$!
  printf -v "${pid_var}" '%s' "${pid}"
}

echo "[dev-stack] Starting API server..."
prefix_and_tee api "${API_LOG}" API_PID npm run dev:api

echo "[dev-stack] Starting UI dev server..."
prefix_and_tee ui "${UI_LOG}" UI_PID npm run dev:ui

echo "[dev-stack] Starting Codex worker..."
prefix_and_tee worker "${WORKER_LOG}" WORKER_PID npm run dev:worker

echo "[dev-stack] Logs are being tailed and saved to ${LOG_DIR}"
echo "[dev-stack] API ⇒ http://localhost:4000"
echo "[dev-stack] UI  ⇒ http://localhost:5173"
echo "[dev-stack] Worker logs ⇒ ${WORKER_LOG}"
echo "[dev-stack] Press Ctrl+C to stop all services."

wait "${API_PID}" "${UI_PID}" "${WORKER_PID}"
