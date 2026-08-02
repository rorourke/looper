#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-release}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/installer"
OUTPUT_DIR="${LOOPER_INSTALLER_OUTPUT_DIR:-$ROOT_DIR/electron/release}"
APP_NAME="Install Looper"

case "$MODE" in
  release|unsigned|debug|preview)
    ;;
  *)
    echo "Usage: $0 <release|unsigned|debug|preview>" >&2
    exit 64
    ;;
esac

if [ "$OUTPUT_DIR" != "$ROOT_DIR/electron/release" ] &&
  [[ "$OUTPUT_DIR" != /tmp/* ]] &&
  [[ "$OUTPUT_DIR" != "$ROOT_DIR"/.looper-installer-output.* ]]; then
  echo "Refusing to write installer artifacts to an unexpected directory: $OUTPUT_DIR" >&2
  exit 1
fi

for command_name in swiftc lipo sips codesign hdiutil plutil; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required to build the Looper installer." >&2
    exit 127
  fi
done

BUNDLED_NODE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
BUNDLED_FALLBACK_BIN="${XDG_CACHE_HOME:-$HOME/.cache}/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if [ -x "$BUNDLED_NODE_DIR/node" ]; then
  export PATH="$BUNDLED_NODE_DIR:$BUNDLED_FALLBACK_BIN:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to read the Looper release version." >&2
  exit 127
fi

VERSION="$(
  node -e '
    const value = require(process.argv[1]).version;
    if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
      throw new Error(`Invalid Looper version: ${String(value)}`);
    }
    process.stdout.write(value);
  ' "$ROOT_DIR/electron/package.json"
)"
BUILD_NUMBER="$VERSION"
ARTIFACT_PATH="$OUTPUT_DIR/Looper-Installer-$VERSION.dmg"
if [ "$MODE" = "preview" ]; then
  APP_OUTPUT_DIR="$OUTPUT_DIR/installer-preview"
else
  APP_OUTPUT_DIR="$OUTPUT_DIR/installer"
fi
APP_BUNDLE="$APP_OUTPUT_DIR/$APP_NAME.app"
STAGING_DIR="$(mktemp -d "$ROOT_DIR/.looper-installer-package.XXXXXX")"
STAGED_APP="$STAGING_DIR/$APP_NAME.app"

cleanup() {
  case "$STAGING_DIR" in
    "$ROOT_DIR"/.looper-installer-package.*)
      rm -rf "$STAGING_DIR"
      ;;
    *)
      echo "Refusing to clean an unexpected installer staging directory: $STAGING_DIR" >&2
      ;;
  esac
}
trap cleanup EXIT

create_icon() {
  local iconset="$STAGING_DIR/AppIcon.iconset"
  local source_icon="$ROOT_DIR/electron/build/icon.png"
  mkdir -p "$iconset"

  if [ ! -f "$source_icon" ]; then
    echo "The signed-out Looper icon is missing: $source_icon" >&2
    exit 1
  fi

  sips -s format png -z 16 16 "$source_icon" --out "$iconset/icon_16x16.png" >/dev/null
  sips -s format png -z 32 32 "$source_icon" --out "$iconset/icon_16x16@2x.png" >/dev/null
  sips -s format png -z 32 32 "$source_icon" --out "$iconset/icon_32x32.png" >/dev/null
  sips -s format png -z 64 64 "$source_icon" --out "$iconset/icon_32x32@2x.png" >/dev/null
  sips -s format png -z 128 128 "$source_icon" --out "$iconset/icon_128x128.png" >/dev/null
  sips -s format png -z 256 256 "$source_icon" --out "$iconset/icon_128x128@2x.png" >/dev/null
  sips -s format png -z 256 256 "$source_icon" --out "$iconset/icon_256x256.png" >/dev/null
  sips -s format png -z 512 512 "$source_icon" --out "$iconset/icon_256x256@2x.png" >/dev/null
  sips -s format png -z 512 512 "$source_icon" --out "$iconset/icon_512x512.png" >/dev/null
  sips -s format png -z 1024 1024 "$source_icon" --out "$iconset/icon_512x512@2x.png" >/dev/null
  node "$SOURCE_DIR/scripts/create_icns.mjs" \
    "$iconset" "$STAGING_DIR/AppIcon.icns"
}

compile_installer() {
  local compile_flags=(
    -O
    -whole-module-optimization
    -parse-as-library
    -module-cache-path "$STAGING_DIR/module-cache"
    "$SOURCE_DIR/Sources/InstallerApp.swift"
    -framework AppKit
    -framework Security
  )
  if [ "$MODE" = "debug" ] || [ "$MODE" = "preview" ]; then
    compile_flags+=(-DDEBUG_INSTALLER)
  fi

  if [ "$MODE" = "preview" ]; then
    case "$(uname -m)" in
      arm64)
        swiftc -target arm64-apple-macos13.0 "${compile_flags[@]}" \
          -o "$STAGING_DIR/Install-Looper-universal"
        ;;
      x86_64)
        swiftc -target x86_64-apple-macos13.0 "${compile_flags[@]}" \
          -o "$STAGING_DIR/Install-Looper-universal"
        ;;
      *)
        echo "The Looper installer preview requires an Apple Silicon or Intel Mac." >&2
        exit 1
        ;;
    esac
    return
  fi

  swiftc -target arm64-apple-macos13.0 "${compile_flags[@]}" \
    -o "$STAGING_DIR/Install-Looper-arm64"
  swiftc -target x86_64-apple-macos13.0 "${compile_flags[@]}" \
    -o "$STAGING_DIR/Install-Looper-x64"
  lipo -create \
    "$STAGING_DIR/Install-Looper-arm64" \
    "$STAGING_DIR/Install-Looper-x64" \
    -output "$STAGING_DIR/Install-Looper-universal"
}

assemble_app() {
  mkdir -p "$STAGED_APP/Contents/MacOS" "$STAGED_APP/Contents/Resources"
  cp "$SOURCE_DIR/Info.plist" "$STAGED_APP/Contents/Info.plist"
  plutil -replace CFBundleShortVersionString -string "$VERSION" \
    "$STAGED_APP/Contents/Info.plist"
  plutil -replace CFBundleVersion -string "$BUILD_NUMBER" \
    "$STAGED_APP/Contents/Info.plist"
  plutil -lint "$STAGED_APP/Contents/Info.plist"

  cp "$STAGING_DIR/Install-Looper-universal" \
    "$STAGED_APP/Contents/MacOS/$APP_NAME"
  cp "$STAGING_DIR/AppIcon.icns" "$STAGED_APP/Contents/Resources/AppIcon.icns"
  chmod 755 "$STAGED_APP/Contents/MacOS/$APP_NAME"
}

release_team_identifier() {
  local team_identifier=""
  local app_bundle
  local app_team_identifier

  while IFS= read -r -d '' app_bundle; do
    app_team_identifier="$(
      codesign -dvvv "$app_bundle" 2>&1 |
        sed -n 's/^TeamIdentifier=//p' |
        head -n 1
    )"
    if [[ ! "$app_team_identifier" =~ ^[A-Z0-9]{10}$ ]]; then
      echo "$app_bundle has no valid signing team identifier." >&2
      exit 1
    fi
    if [ -n "$team_identifier" ] &&
      [ "$team_identifier" != "$app_team_identifier" ]; then
      echo "Packaged Looper apps are signed by different teams." >&2
      exit 1
    fi
    team_identifier="$app_team_identifier"
  done < <(
    find "$OUTPUT_DIR" -maxdepth 3 -type d -name "Looper.app" -print0
  )

  if [ -z "$team_identifier" ]; then
    echo "No signed Looper app was found for installer identity selection." >&2
    exit 1
  fi
  printf '%s' "$team_identifier"
}

find_signing_identity() {
  local team_identifier
  team_identifier="$(release_team_identifier)"
  security find-identity -p codesigning -v 2>/dev/null |
    sed -n "s/.*\"\\(Developer ID Application:.*($team_identifier)\\)\"/\\1/p" |
    head -n 1
}

sign_app() {
  if [ "$MODE" = "release" ]; then
    local signing_identity
    signing_identity="$(find_signing_identity)"
    if [ -z "$signing_identity" ]; then
      echo "A Developer ID Application certificate matching the signed Looper app is required." >&2
      exit 1
    fi
    codesign --force --deep --options runtime --timestamp \
      --sign "$signing_identity" "$STAGED_APP"
  else
    codesign --force --deep --sign - "$STAGED_APP"
  fi
}

notary_arguments() {
  if [ -n "${APPLE_API_KEY:-}" ] &&
    [ -n "${APPLE_API_KEY_ID:-}" ] &&
    [ -n "${APPLE_API_ISSUER:-}" ]; then
    printf '%s\0' \
      --key "$APPLE_API_KEY" \
      --key-id "$APPLE_API_KEY_ID" \
      --issuer "$APPLE_API_ISSUER"
    return
  fi
  if [ -n "${APPLE_ID:-}" ] &&
    [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] &&
    [ -n "${APPLE_TEAM_ID:-}" ]; then
    printf '%s\0' \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID"
    return
  fi
  if [ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]; then
    printf '%s\0' --keychain-profile "$APPLE_KEYCHAIN_PROFILE"
    return
  fi

  echo "Apple notarization credentials are required for the installer." >&2
  exit 1
}

notarize_app() {
  local notary_args=()
  while IFS= read -r -d '' item; do
    notary_args+=("$item")
  done < <(notary_arguments)

  /usr/bin/ditto -c -k --keepParent "$STAGED_APP" "$STAGING_DIR/installer-notary.zip"
  xcrun notarytool submit "$STAGING_DIR/installer-notary.zip" \
    "${notary_args[@]}" --wait
  xcrun stapler staple "$STAGED_APP"
  xcrun stapler validate "$STAGED_APP"
}

create_dmg() {
  local dmg_source="$STAGING_DIR/dmg"
  mkdir -p "$dmg_source"
  cp -R "$STAGED_APP" "$dmg_source/$APP_NAME.app"
  hdiutil create \
    -volname "Looper Installer" \
    -srcfolder "$dmg_source" \
    -format UDZO \
    -imagekey zlib-level=9 \
    -ov \
    "$STAGING_DIR/Looper-Installer.dmg"
}

notarize_dmg() {
  local notary_args=()
  while IFS= read -r -d '' item; do
    notary_args+=("$item")
  done < <(notary_arguments)

  xcrun notarytool submit "$STAGING_DIR/Looper-Installer.dmg" \
    "${notary_args[@]}" --wait
  xcrun stapler staple "$STAGING_DIR/Looper-Installer.dmg"
  xcrun stapler validate "$STAGING_DIR/Looper-Installer.dmg"
}

create_icon
compile_installer
assemble_app
sign_app
if [ "$MODE" != "preview" ]; then
  if [ "$MODE" = "release" ]; then
    notarize_app
  fi
  create_dmg
  if [ "$MODE" = "release" ]; then
    notarize_dmg
  fi
fi

mkdir -p "$OUTPUT_DIR"
if [ -e "$APP_OUTPUT_DIR" ]; then
  rm -rf "$APP_OUTPUT_DIR"
fi
if [ "$MODE" != "preview" ] && [ -e "$ARTIFACT_PATH" ]; then
  rm -f "$ARTIFACT_PATH"
fi
mkdir -p "$APP_OUTPUT_DIR"
cp -R "$STAGED_APP" "$APP_BUNDLE"
if [ "$MODE" != "preview" ]; then
  cp "$STAGING_DIR/Looper-Installer.dmg" "$ARTIFACT_PATH"
fi

echo "Built $APP_BUNDLE"
if [ "$MODE" != "preview" ]; then
  echo "Built $ARTIFACT_PATH"
fi
