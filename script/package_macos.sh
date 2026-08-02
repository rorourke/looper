#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-release}"
ARCHITECTURE="${2:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/electron"

case "$MODE" in
  release|unsigned)
    ;;
  *)
    echo "Usage: $0 <release|unsigned> <all|arm64|x64>" >&2
    exit 64
    ;;
esac

case "$ARCHITECTURE" in
  all|arm64|x64)
    ;;
  *)
    echo "Usage: $0 <release|unsigned> <all|arm64|x64>" >&2
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

has_notary_credentials() {
  if [ -n "${APPLE_API_KEY:-}" ] &&
    [ -n "${APPLE_API_KEY_ID:-}" ] &&
    [ -n "${APPLE_API_ISSUER:-}" ]; then
    return 0
  fi
  if [ -n "${APPLE_ID:-}" ] &&
    [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] &&
    [ -n "${APPLE_TEAM_ID:-}" ]; then
    return 0
  fi
  if [ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]; then
    return 0
  fi
  return 1
}

has_developer_id() {
  security find-identity -p codesigning -v 2>/dev/null |
    grep -q '"Developer ID Application:'
}

require_release_environment() {
  if ! has_developer_id; then
    echo "A Developer ID Application certificate is required." >&2
    echo "Install the certificate and private key in the build keychain." >&2
    exit 1
  fi
  if ! has_notary_credentials; then
    echo "Apple notarization credentials are required." >&2
    echo "Set the APPLE_API_KEY trio, APPLE_ID trio, or APPLE_KEYCHAIN_PROFILE." >&2
    exit 1
  fi
}

verify_release_debug_build_is_disabled() {
  local compiled_main="$APP_DIR/out/main/index.js"
  local enabled_pattern='isInternalDebugBuild[[:space:]]*=[[:space:]]*isDev[[:space:]]*\|\|[[:space:]]*true'
  local disabled_pattern='isInternalDebugBuild[[:space:]]*=[[:space:]]*isDev[[:space:]]*\|\|[[:space:]]*false'

  if [ ! -f "$compiled_main" ]; then
    echo "The compiled Electron main bundle is missing: $compiled_main" >&2
    exit 1
  fi
  if grep -Eq "$enabled_pattern" "$compiled_main"; then
    echo "Refusing to package a release with internal debug access enabled." >&2
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

builder_args=(
  --mac
  dmg
  zip
  --publish
  never
)
case "$ARCHITECTURE" in
  all)
    builder_args+=(--arm64 --x64)
    ;;
  arm64)
    builder_args+=(--arm64)
    ;;
  x64)
    builder_args+=(--x64)
    ;;
esac

if [ "$MODE" = "release" ]; then
  require_release_environment
  # This is intentionally not caller-overridable. Stable packages must never
  # compile in the internal debug bypass used by local build-and-run workflows.
  export MAIN_VITE_INTERNAL_DEBUG_BUILD=false
  export MAIN_VITE_UPDATE_CHANNEL=stable
  builder_args+=(
    --config.forceCodeSigning=true
    --config.mac.notarize=true
  )
else
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  export MAIN_VITE_UPDATE_CHANNEL=disabled
  builder_args+=(
    --config.forceCodeSigning=false
    --config.mac.identity=null
    --config.mac.notarize=false
  )
fi

cd "$APP_DIR"
pnpm test
pnpm build
if [ "$MODE" = "release" ]; then
  verify_release_debug_build_is_disabled
fi
pnpm exec electron-builder "${builder_args[@]}"
"$ROOT_DIR/script/package_macos_installer.sh" "$MODE"

if [ "$MODE" = "release" ]; then
  "$ROOT_DIR/script/verify_macos_release.sh" "$ARCHITECTURE"
fi
