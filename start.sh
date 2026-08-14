#!/usr/bin/env bash
# HexForge Studio - macOS / Linux launcher
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.9+ is required but was not found on PATH." >&2
  exit 1
fi
exec python3 run.py "$@"
