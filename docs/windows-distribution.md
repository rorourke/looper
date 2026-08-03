# Windows distribution

Looper ships Windows installers and portable ZIP archives for x64 and ARM64.
The website sends Windows visitors to the current x64 NSIS installer, which is
compatible with the broadest set of Windows PCs. Both architectures remain
available as immutable release artifacts.

## Local commands

From `electron/`:

- `pnpm dist:windows` builds the x64 installer and ZIP.
- `pnpm dist:windows:arm64` builds the ARM64 installer and ZIP.
- `../script/package_windows.sh all` builds both architectures.
- `node ../script/verify_windows_release.mjs all` checks the artifact names,
  PE architectures, archive layout, and embedded packaged app.

Release artifacts are written to `electron/release/` as
`Looper-<version>-Windows-<architecture>.exe` and `.zip`.

## Automated releases

Pushing a stable semantic-version tag such as `v1.2.3` runs
`.github/workflows/windows-release.yml`. The workflow installs locked
dependencies on Windows, takes the package version from the tag, runs the full
Electron test and production-build gates, packages x64 and ARM64, verifies both
archives, and uploads immutable artifacts to public Vercel Blob storage. It
publishes `releases/windows/latest-download.json` only after every artifact is
available.

`https://looper.app/download` detects a Windows user agent and resolves the x64
installer from that manifest. The route returns `503` instead of falling back to
an old or untrusted package when the manifest is unavailable or invalid.

The workflow supports Authenticode signing when both of these GitHub Actions
secrets are configured:

- `WINDOWS_CERTIFICATE_PFX_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

Without those secrets, electron-builder produces functional unsigned Windows
packages. Windows may show a Microsoft Defender SmartScreen warning until a
trusted signing certificate is configured and establishes reputation.
