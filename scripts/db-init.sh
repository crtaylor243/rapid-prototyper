#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
cd "${ROOT_DIR}/apps/api"

if [ -f "../../.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' ../../.env | xargs)
elif [ -f "../../.env.sample" ]; then
  export $(grep -v '^#' ../../.env.sample | xargs)
fi

npm run migrate:latest --if-present
npm run seed:run --if-present
