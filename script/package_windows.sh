#!/usr/bin/env bash
set -euo pipefail

ARCHITECTURE="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/electron"

case "$ARCHITECTURE" in
  all|x64|arm64)
    ;;
  *)
    echo "Usage: $0 <all|x64|arm64>" >&2
    exit 64
    ;;
esac

BUNDLED_NODE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
BUNDLED_FALLBACK_BIN="${XDG_CACHE_HOME:-$HOME/.cache}/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if [ -x "$BUNDLED_NODE_DIR/node" ]; then
  export PATH="$BUNDLED_NODE_DIR:$BUNDLED_FALLBACK_BIN:$PATH"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found. Install pnpm, then run this again." >&2
  exit 127
fi

verify_release_debug_build_is_disabled() {
  local compiled_main="$APP_DIR/out/main/index.js"
  local debug_source='(isDev|devRendererUrl[[:space:]]*!==[[:space:]]*(void[[:space:]]+0|undefined))'
  local enabled_pattern="isInternalDebugBuild[[:space:]]*=[[:space:]]*$debug_source[[:space:]]*\\|\\|[[:space:]]*true"
  local disabled_pattern="isInternalDebugBuild[[:space:]]*=[[:space:]]*$debug_source[[:space:]]*\\|\\|[[:space:]]*false"

  if [ ! -f "$compiled_main" ]; then
    echo "The compiled Electron main bundle is missing: $compiled_main" >&2
    exit 1
  fi
  if grep -Eq "$enabled_pattern" "$compiled_main"; then
    echo "Refusing to package a Windows release with internal debug access enabled." >&2
    exit 1
  fi
  if ! grep -Eq "$disabled_pattern" "$compiled_main"; then
    echo "Could not verify that internal debug access is disabled in $compiled_main." >&2
    exit 1
  fi
}

export CI="${CI:-true}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$ROOT_DIR/.electron-cache}"
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-$ROOT_DIR/.electron-builder-cache}"
export MAIN_VITE_LOOPER_API_URL="${MAIN_VITE_LOOPER_API_URL:-https://looper.app}"
export MAIN_VITE_INTERNAL_DEBUG_BUILD=false
export MAIN_VITE_UPDATE_CHANNEL=disabled

signing_args=(--config.forceCodeSigning=false)
if [ -n "${CSC_LINK:-}" ] || [ -n "${CSC_KEY_PASSWORD:-}" ]; then
  if [ -z "${CSC_LINK:-}" ] || [ -z "${CSC_KEY_PASSWORD:-}" ]; then
    echo "Both CSC_LINK and CSC_KEY_PASSWORD are required for Windows signing." >&2
    exit 1
  fi
  export CSC_IDENTITY_AUTO_DISCOVERY=true
  signing_args=(--config.forceCodeSigning=true)
else
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi

builder_args=(
  --win
  --publish
  never
)
case "$ARCHITECTURE" in
  all)
    builder_args+=(--x64 --arm64)
    ;;
  x64)
    builder_args+=(--x64)
    ;;
  arm64)
    builder_args+=(--arm64)
    ;;
esac

cd "$APP_DIR"
pnpm verify:security-config
pnpm test
pnpm build
verify_release_debug_build_is_disabled
pnpm exec electron-builder "${builder_args[@]}" "${signing_args[@]}"
