#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="Looper"
BUNDLE_ID="com.nickbolton.looper.electron"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOCK="$ROOT_DIR/.build_and_run.lock"

if [ "${LOOPER_BUILD_LOCK_HELD:-false}" != "true" ]; then
  export LOOPER_BUILD_LOCK_HELD=true
  exec /usr/bin/lockf -t 0 "$BUILD_LOCK" "$0" "$@"
fi

APP_DIR="$ROOT_DIR/electron"
RELEASE_DIR="$APP_DIR/release"
INSTALL_BUNDLE="$HOME/Applications/Looper.app"
LEGACY_INSTALL_BUNDLE="$HOME/Applications/Looper Electron.app"
STAGING_DIR=""

cleanup_staging() {
  if [ -z "$STAGING_DIR" ]; then
    return
  fi

  case "$STAGING_DIR" in
    "$ROOT_DIR"/.looper-package.*)
      rm -rf "$STAGING_DIR"
      ;;
    *)
      echo "Refusing to clean an unexpected staging directory: $STAGING_DIR" >&2
      ;;
  esac
}

trap cleanup_staging EXIT

export CI="${CI:-true}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$ROOT_DIR/.electron-cache}"
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-$ROOT_DIR/.electron-builder-cache}"
export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"
export MAIN_VITE_INTERNAL_DEBUG_BUILD="${MAIN_VITE_INTERNAL_DEBUG_BUILD:-true}"

BUNDLED_NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
BUNDLED_FALLBACK_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if [ -x "$BUNDLED_NODE_DIR/node" ]; then
  export PATH="$BUNDLED_NODE_DIR:$BUNDLED_FALLBACK_BIN:$PATH"
fi

find_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    command -v pnpm
    return
  fi

  local bundled_pnpm="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"
  if [ -x "$bundled_pnpm" ]; then
    echo "$bundled_pnpm"
    return
  fi

  echo "pnpm was not found. Install pnpm, then run this again." >&2
  exit 127
}

stop_running_app() {
  if ! pgrep -x "$APP_NAME" >/dev/null 2>&1; then
    return
  fi

  if ! /usr/bin/osascript -e "tell application id \"$BUNDLE_ID\" to quit"; then
    echo "Could not ask $APP_NAME to quit cleanly; leaving the current app and bundle untouched." >&2
    exit 1
  fi

  for _ in {1..100}; do
    if ! pgrep -x "$APP_NAME" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done

  echo "$APP_NAME did not quit cleanly; leaving the current bundle untouched." >&2
  exit 1
}

clean_packaging_output() {
  if [ "$RELEASE_DIR" != "$APP_DIR/release" ]; then
    echo "Refusing to clean an unexpected release directory: $RELEASE_DIR" >&2
    exit 1
  fi

  rm -rf "$RELEASE_DIR/mac-arm64" "$RELEASE_DIR/mac"
}

build_app() {
  local pnpm_bin
  pnpm_bin="$(find_pnpm)"
  STAGING_DIR="$(mktemp -d "$ROOT_DIR/.looper-package.XXXXXX")"

  cd "$APP_DIR"
  "$pnpm_bin" build
  "$pnpm_bin" exec electron-builder \
    --mac dir \
    --publish never \
    --config.directories.output="$STAGING_DIR"
}

find_app_bundle() {
  local search_dir="${1:-$RELEASE_DIR}"
  local preferred_arm="$search_dir/mac-arm64/$APP_NAME.app"
  local preferred_intel="$search_dir/mac/$APP_NAME.app"

  if [ -d "$preferred_arm" ]; then
    echo "$preferred_arm"
    return
  fi

  if [ -d "$preferred_intel" ]; then
    echo "$preferred_intel"
    return
  fi

  find "$search_dir" -maxdepth 3 -type d -name "$APP_NAME.app" | head -n 1
}

promote_app_bundle() {
  local staged_bundle="$1"
  local architecture_dir
  architecture_dir="$(basename "$(dirname "$staged_bundle")")"

  if [ "$architecture_dir" != "mac-arm64" ] && [ "$architecture_dir" != "mac" ]; then
    echo "Refusing to promote an app from an unexpected directory: $staged_bundle" >&2
    exit 1
  fi

  stop_running_app
  clean_packaging_output
  mkdir -p "$RELEASE_DIR/$architecture_dir"
  mv "$staged_bundle" "$RELEASE_DIR/$architecture_dir/$APP_NAME.app"
}

install_app_bundle() {
  local app_bundle="$1"
  mkdir -p "$(dirname "$INSTALL_BUNDLE")"

  if [ -e "$INSTALL_BUNDLE" ]; then
    local installed_bundle_id
    installed_bundle_id="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INSTALL_BUNDLE/Contents/Info.plist" 2>/dev/null || true)"
    if [ "$installed_bundle_id" != "$BUNDLE_ID" ]; then
      echo "Refusing to replace $INSTALL_BUNDLE because it is not this Electron Looper app." >&2
      exit 1
    fi
    rm -rf "$INSTALL_BUNDLE"
  fi

  cp -R "$app_bundle" "$INSTALL_BUNDLE"
  touch "$INSTALL_BUNDLE"

  local lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  if [ -x "$lsregister" ]; then
    "$lsregister" -f "$INSTALL_BUNDLE" >/dev/null 2>&1 || true
  fi

  if [ -e "$LEGACY_INSTALL_BUNDLE" ]; then
    local legacy_bundle_id
    legacy_bundle_id="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$LEGACY_INSTALL_BUNDLE/Contents/Info.plist" 2>/dev/null || true)"
    if [ "$legacy_bundle_id" = "$BUNDLE_ID" ]; then
      rm -rf "$LEGACY_INSTALL_BUNDLE"
    fi
  fi

  echo "$INSTALL_BUNDLE"
}

open_app() {
  /usr/bin/open -n "$1"
}

run_packaged_app() {
  build_app

  local staged_bundle
  staged_bundle="$(find_app_bundle "$STAGING_DIR")"
  if [ -z "$staged_bundle" ] || [ ! -d "$staged_bundle" ]; then
    echo "Built app, but could not find $APP_NAME.app in $STAGING_DIR." >&2
    exit 1
  fi
  promote_app_bundle "$staged_bundle"

  local app_bundle
  app_bundle="$(find_app_bundle)"

  if [ "$MODE" = "--install" ] || [ "$MODE" = "install" ]; then
    app_bundle="$(install_app_bundle "$app_bundle")"
  fi

  open_app "$app_bundle"
  echo "Opened $app_bundle"
}

case "$MODE" in
  run)
    run_packaged_app
    ;;
  --install|install)
    run_packaged_app
    ;;
  --verify|verify)
    run_packaged_app
    sleep 2
    pgrep -x "$APP_NAME" >/dev/null
    echo "$APP_NAME is running."
    ;;
  --logs|logs)
    run_packaged_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --debug|debug)
    build_app
    staged_bundle="$(find_app_bundle "$STAGING_DIR")"
    if [ -z "$staged_bundle" ] || [ ! -d "$staged_bundle" ]; then
      echo "Built app, but could not find $APP_NAME.app in $STAGING_DIR." >&2
      exit 1
    fi
    promote_app_bundle "$staged_bundle"
    app_bundle="$(find_app_bundle)"
    lldb -- "$app_bundle/Contents/MacOS/$APP_NAME"
    ;;
  --dev|dev)
    cd "$APP_DIR"
    "$(find_pnpm)" dev
    ;;
  *)
    echo "usage: $0 [run|--install|--verify|--logs|--debug|--dev]" >&2
    exit 2
    ;;
esac
