#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ARCHITECTURE="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/electron/release"

case "$EXPECTED_ARCHITECTURE" in
  all|arm64|x64)
    ;;
  *)
    echo "Usage: $0 <all|arm64|x64>" >&2
    exit 64
    ;;
esac

mapfile_command() {
  while IFS= read -r line; do
    printf '%s\0' "$line"
  done
}

app_bundles=()
while IFS= read -r -d '' app_bundle; do
  app_bundles+=("$app_bundle")
done < <(
  find "$RELEASE_DIR" -maxdepth 3 -type d -name "Looper.app" -print |
    sort |
    mapfile_command
)

if [ "${#app_bundles[@]}" -eq 0 ]; then
  echo "No packaged Looper.app bundle was found in $RELEASE_DIR." >&2
  exit 1
fi

seen_arm64=false
seen_x64=false
release_team_identifier=""
for app_bundle in "${app_bundles[@]}"; do
  executable="$app_bundle/Contents/MacOS/Looper"
  info_plist="$app_bundle/Contents/Info.plist"
  architectures="$(lipo -archs "$executable")"
  case " $architectures " in
    *" arm64 "*)
      seen_arm64=true
      ;;
  esac
  case " $architectures " in
    *" x86_64 "*)
      seen_x64=true
      ;;
  esac

  codesign --verify --deep --strict --verbose=2 "$app_bundle"
  signing_details="$(codesign -dvvv "$app_bundle" 2>&1)"
  if ! grep -q "^Authority=Developer ID Application:" <<<"$signing_details"; then
    echo "$app_bundle is not signed with a Developer ID Application certificate." >&2
    exit 1
  fi
  if ! grep -q "^Identifier=com.nickbolton.looper.electron$" <<<"$signing_details"; then
    echo "$app_bundle has an unexpected code-signing identifier." >&2
    exit 1
  fi
  app_team_identifier="$(
    sed -n 's/^TeamIdentifier=//p' <<<"$signing_details" |
      head -n 1
  )"
  if [[ ! "$app_team_identifier" =~ ^[A-Z0-9]{10}$ ]]; then
    echo "$app_bundle has no valid signing team identifier." >&2
    exit 1
  fi
  if [ -n "$release_team_identifier" ] &&
    [ "$release_team_identifier" != "$app_team_identifier" ]; then
    echo "Packaged Looper apps are signed by different teams." >&2
    exit 1
  fi
  release_team_identifier="$app_team_identifier"
  if ! grep -q "flags=.*runtime" <<<"$signing_details"; then
    echo "$app_bundle is missing the hardened runtime signature flag." >&2
    exit 1
  fi
  allows_arbitrary_loads="$(
    plutil -extract NSAppTransportSecurity.NSAllowsArbitraryLoads raw \
      -o - "$info_plist"
  )"
  if [ "$allows_arbitrary_loads" != "false" ]; then
    echo "$app_bundle must set NSAllowsArbitraryLoads to false." >&2
    exit 1
  fi
  if /usr/libexec/PlistBuddy \
    -c "Print :NSAppTransportSecurity:NSAllowsLocalNetworking" \
    "$info_plist" >/dev/null 2>&1; then
    echo "$app_bundle must not allow broad local-network ATS access." >&2
    exit 1
  fi
  if /usr/libexec/PlistBuddy \
    -c "Print :NSAppTransportSecurity:NSExceptionDomains:localhost" \
    "$info_plist" >/dev/null 2>&1; then
    echo "$app_bundle must not retain a localhost ATS exception." >&2
    exit 1
  fi
  loopback_http_exception="$(
    /usr/libexec/PlistBuddy \
      -c "Print :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads" \
      "$info_plist"
  )"
  if [ "$loopback_http_exception" != "true" ]; then
    echo "$app_bundle is missing the Squirrel.Mac loopback ATS exception." >&2
    exit 1
  fi
  app_entitlements="$(codesign -d --entitlements :- "$app_bundle" 2>&1)"
  if ! grep -q "com.apple.security.cs.allow-jit" <<<"$app_entitlements"; then
    echo "$app_bundle is missing the Electron JIT entitlement." >&2
    exit 1
  fi
  for forbidden_entitlement in \
    com.apple.security.cs.allow-unsigned-executable-memory \
    com.apple.security.cs.disable-library-validation; do
    if grep -q "$forbidden_entitlement" <<<"$app_entitlements"; then
      echo "$app_bundle includes forbidden entitlement $forbidden_entitlement." >&2
      exit 1
    fi
  done

  while IFS= read -r -d '' nested_app; do
    nested_entitlements="$(codesign -d --entitlements :- "$nested_app" 2>&1)"
    for forbidden_entitlement in \
      com.apple.security.cs.allow-unsigned-executable-memory \
      com.apple.security.cs.disable-library-validation; do
      if grep -q "$forbidden_entitlement" <<<"$nested_entitlements"; then
        echo "$nested_app includes forbidden entitlement $forbidden_entitlement." >&2
        exit 1
      fi
    done
  done < <(find "$app_bundle/Contents/Frameworks" -type d -name "*.app" -print0)

  fuse_output="$(
    cd "$ROOT_DIR/electron"
    pnpm exec electron-fuses read --app "$app_bundle"
  )"
  while IFS='|' read -r fuse_name expected_state; do
    if ! grep -Eq "^[[:space:]]*$fuse_name[[:space:]]+is[[:space:]]+$expected_state[[:space:]]*$" \
      <<<"$fuse_output"; then
      echo "$app_bundle has an unexpected $fuse_name fuse state." >&2
      exit 1
    fi
  done <<'FUSES'
RunAsNode|Disabled
EnableCookieEncryption|Enabled
EnableNodeOptionsEnvironmentVariable|Disabled
EnableNodeCliInspectArguments|Disabled
EnableEmbeddedAsarIntegrityValidation|Enabled
OnlyLoadAppFromAsar|Enabled
LoadBrowserProcessSpecificV8Snapshot|Disabled
GrantFileProtocolExtraPrivileges|Disabled
WasmTrapHandlers|Enabled
FUSES

  spctl --assess --type execute --verbose=4 "$app_bundle"
  xcrun stapler validate "$app_bundle"
done

if [ "$EXPECTED_ARCHITECTURE" = "all" ] || [ "$EXPECTED_ARCHITECTURE" = "arm64" ]; then
  if [ "$seen_arm64" != "true" ]; then
    echo "The arm64 app bundle is missing." >&2
    exit 1
  fi
fi
if [ "$EXPECTED_ARCHITECTURE" = "all" ] || [ "$EXPECTED_ARCHITECTURE" = "x64" ]; then
  if [ "$seen_x64" != "true" ]; then
    echo "The x64 app bundle is missing." >&2
    exit 1
  fi
fi

dmg_count=0
while IFS= read -r -d '' dmg_path; do
  hdiutil verify "$dmg_path"
  dmg_count=$((dmg_count + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f -name "Looper-*-macOS-*.dmg" -print0)
if [ "$dmg_count" -eq 0 ]; then
  echo "No DMG installer was produced." >&2
  exit 1
fi

zip_count=0
zip_validation_root="${TMPDIR:-/tmp}"
zip_validation_root="${zip_validation_root%/}"
zip_validation_dir=""
cleanup_zip_validation() {
  if [ -z "$zip_validation_dir" ]; then
    return
  fi
  case "$zip_validation_dir" in
    "$zip_validation_root"/looper-zip-verify.*)
      rm -rf "$zip_validation_dir"
      zip_validation_dir=""
      ;;
    *)
      echo "Refusing to clean unexpected ZIP validation directory: $zip_validation_dir" >&2
      ;;
  esac
}
trap cleanup_zip_validation EXIT

while IFS= read -r -d '' zip_path; do
  zip_name="$(basename "$zip_path")"
  if [[ ! "$zip_name" =~ ^Looper-([0-9]+\.[0-9]+\.[0-9]+)-macOS-(arm64|x64)\.zip$ ]]; then
    echo "Unexpected updater ZIP name: $zip_name" >&2
    exit 1
  fi
  expected_version="${BASH_REMATCH[1]}"
  case "${BASH_REMATCH[2]}" in
    arm64)
      expected_zip_architecture="arm64"
      ;;
    x64)
      expected_zip_architecture="x86_64"
      ;;
  esac

  unzip -tq "$zip_path"
  zip_validation_dir="$(
    mktemp -d "$zip_validation_root/looper-zip-verify.XXXXXX"
  )"
  /usr/bin/ditto -x -k --noqtn "$zip_path" "$zip_validation_dir"
  zip_app="$zip_validation_dir/Looper.app"
  if [ ! -d "$zip_app" ] || [ -L "$zip_app" ]; then
    echo "$zip_name does not contain Looper.app at its root." >&2
    exit 1
  fi

  zip_bundle_identifier="$(
    /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" \
      "$zip_app/Contents/Info.plist"
  )"
  zip_version="$(
    /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
      "$zip_app/Contents/Info.plist"
  )"
  if [ "$zip_bundle_identifier" != "com.nickbolton.looper.electron" ]; then
    echo "$zip_name has an unexpected bundle identifier." >&2
    exit 1
  fi
  if [ "$zip_version" != "$expected_version" ]; then
    echo "$zip_name contains Looper $zip_version, expected $expected_version." >&2
    exit 1
  fi

  lipo "$zip_app/Contents/MacOS/Looper" \
    -verify_arch "$expected_zip_architecture"
  codesign --verify --deep --strict --all-architectures \
    "-R=anchor apple generic and identifier \"com.nickbolton.looper.electron\" and certificate leaf[subject.OU] = \"$release_team_identifier\"" \
    "$zip_app"
  spctl --assess --type execute --verbose=4 "$zip_app"
  xcrun stapler validate "$zip_app"

  cleanup_zip_validation
  zip_count=$((zip_count + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f -name "Looper-*-macOS-*.zip" -print0)
trap - EXIT
if [ "$zip_count" -eq 0 ]; then
  echo "No ZIP updater archive was produced." >&2
  exit 1
fi

verify_installer_app() {
  local app_bundle="$1"
  local architectures
  local signing_details
  local installer_team_identifier

  if [ ! -d "$app_bundle" ]; then
    echo "No packaged Install Looper.app bundle was found at $app_bundle." >&2
    exit 1
  fi

  architectures="$(lipo -archs "$app_bundle/Contents/MacOS/Install Looper")"
  if [ "$architectures" != "x86_64 arm64" ] &&
    [ "$architectures" != "arm64 x86_64" ]; then
    echo "Install Looper.app is not universal: $architectures" >&2
    exit 1
  fi
  codesign --verify --deep --strict --verbose=2 "$app_bundle"
  signing_details="$(codesign -dvvv "$app_bundle" 2>&1)"
  if ! grep -q "^Authority=Developer ID Application:" <<<"$signing_details"; then
    echo "$app_bundle is not signed with a Developer ID Application certificate." >&2
    exit 1
  fi
  installer_team_identifier="$(
    sed -n 's/^TeamIdentifier=//p' <<<"$signing_details" |
      head -n 1
  )"
  if [ "$installer_team_identifier" != "$release_team_identifier" ]; then
    echo "$app_bundle is not signed by the same team as Looper.app." >&2
    exit 1
  fi
  if ! grep -q "flags=.*runtime" <<<"$signing_details"; then
    echo "$app_bundle is missing the hardened runtime signature flag." >&2
    exit 1
  fi
  spctl --assess --type execute --verbose=4 "$app_bundle"
  xcrun stapler validate "$app_bundle"
}

installer_app="$RELEASE_DIR/installer/Install Looper.app"
verify_installer_app "$installer_app"
installer_version="$(
  /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
    "$installer_app/Contents/Info.plist"
)"
installer_dmg="$RELEASE_DIR/Looper-Installer-$installer_version.dmg"

if [ ! -f "$installer_dmg" ]; then
  echo "No Looper installer DMG was produced." >&2
  exit 1
fi
hdiutil verify "$installer_dmg"
xcrun stapler validate "$installer_dmg"

installer_mount_root="${TMPDIR:-/tmp}"
installer_mount_root="${installer_mount_root%/}"
installer_mount_dir=""
cleanup_installer_mount() {
  if [ -z "$installer_mount_dir" ]; then
    return
  fi
  if mount | grep -F " on $installer_mount_dir " >/dev/null; then
    hdiutil detach "$installer_mount_dir" >/dev/null || true
  fi
  case "$installer_mount_dir" in
    "$installer_mount_root"/looper-installer-verify.*)
      rm -rf "$installer_mount_dir"
      ;;
    *)
      echo "Refusing to clean unexpected mount directory: $installer_mount_dir" >&2
      ;;
  esac
}
trap cleanup_installer_mount EXIT

installer_mount_dir="$(
  mktemp -d "$installer_mount_root/looper-installer-verify.XXXXXX"
)"
hdiutil attach -readonly -nobrowse \
  -mountpoint "$installer_mount_dir" "$installer_dmg" >/dev/null
verify_installer_app "$installer_mount_dir/Install Looper.app"
hdiutil detach "$installer_mount_dir" >/dev/null
rmdir "$installer_mount_dir"
installer_mount_dir=""
trap - EXIT

echo "Verified signed, hardened, notarized app, updater, and installer artifacts in $RELEASE_DIR"
