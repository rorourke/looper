#!/usr/bin/env bash
set -euo pipefail

PREVIEW_STATE="${1:-ready}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_APP="$ROOT_DIR/electron/release/installer-preview/Install Looper.app"
PREVIEW_EXECUTABLE="$PREVIEW_APP/Contents/MacOS/Install Looper"

case "$PREVIEW_STATE" in
  ready|progress)
    ;;
  *)
    echo "Usage: $0 <ready|progress>" >&2
    exit 64
    ;;
esac

"$ROOT_DIR/script/package_macos_installer.sh" preview
LOOPER_INSTALLER_PREVIEW_STATE="$PREVIEW_STATE" "$PREVIEW_EXECUTABLE"
