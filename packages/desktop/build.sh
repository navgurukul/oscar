#!/bin/bash
# Local Tauri build script.
#
# Requires TAURI_SIGNING_PRIVATE_KEY to be set in your shell environment.
# Add to ~/.zshrc (one-time setup):
#
#   export TAURI_SIGNING_PRIVATE_KEY="<key>"
#   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
#
# CI builds use GitHub Actions secrets — no changes needed there.

set -e

if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
  echo "Error: TAURI_SIGNING_PRIVATE_KEY is not set."
  echo "Add it to your shell profile (~/.zshrc) and restart your terminal."
  exit 1
fi

npm run tauri build "$@"
