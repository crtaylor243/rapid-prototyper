#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
cd "${ROOT_DIR}/apps/api"

load_env_file() {
  local env_file="$1"
  if [[ ! -f "${env_file}" ]]; then
    return
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "${line}" || "${line}" =~ ^\s*# ]] && continue
    if [[ "${line}" != *"="* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"
    key="$(echo "${key}" | xargs)"
    # Preserve any intentional leading/trailing spaces in the value
    if [[ -n "${key}" ]]; then
      export "${key}=${value}"
    fi
  done < "${env_file}"

  echo "[db-init] Loaded environment from ${env_file}"
}

if [ -f "../../.env" ]; then
  load_env_file "../../.env"
elif [ -f "../../.env.sample" ]; then
  load_env_file "../../.env.sample"
fi

npm run migrate:latest --if-present
npm run seed:run --if-present
