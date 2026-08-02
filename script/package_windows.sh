#!/usr/bin/env bash
set -euo pipefail

ARCHITECTURE="${1:-x64}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/electron"

case "$ARCHITECTURE" in
  x64|arm64)
    ;;
  *)
    echo "Usage: $0 <x64|arm64>" >&2
    exit 64
    ;;
esac

BUNDLED_NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
BUNDLED_FALLBACK_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if [ -x "$BUNDLED_NODE_DIR/node" ]; then
  export PATH="$BUNDLED_NODE_DIR:$BUNDLED_FALLBACK_BIN:$PATH"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found. Install pnpm, then run this again." >&2
  exit 127
fi

export CI="${CI:-true}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$ROOT_DIR/.electron-cache}"
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-$ROOT_DIR/.electron-builder-cache}"
export CSC_IDENTITY_AUTO_DISCOVERY=false
export MAIN_VITE_LOOPER_API_URL="${MAIN_VITE_LOOPER_API_URL:-https://looper.app}"
export MAIN_VITE_INTERNAL_DEBUG_BUILD=false
export MAIN_VITE_UPDATE_CHANNEL=disabled

cd "$APP_DIR"
pnpm build
pnpm exec electron-builder \
  --win \
  "--$ARCHITECTURE" \
  --publish never \
  --config.forceCodeSigning=false
