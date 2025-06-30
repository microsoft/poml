#!/usr/bin/env bash
set -euo pipefail

npm ci
python -m pip install -e .[dev]
npm run build-webview
npm run build-cli

