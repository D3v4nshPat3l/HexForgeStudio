#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm config set registry https://registry.npmjs.org/
if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi
npm run dev
