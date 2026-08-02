# macOS distribution

Looper ships outside the Mac App Store through a small native bootstrap
installer. The first download is a roughly 3 MiB DMG containing
`Install Looper.app`. Double-clicking that app downloads the correct signed
Looper build for the Mac, installs it in `/Applications` (or the user's
Applications folder when necessary), and opens it.

The full architecture-specific DMGs remain release artifacts and fallback
downloads. Architecture-specific ZIPs are used by both the installer and
automatic updates. Every distributed app and disk image is Developer ID-signed,
hardened, and notarized.

The packaged Electron runtime also disables `ELECTRON_RUN_AS_NODE`,
`NODE_OPTIONS`, and Node inspector arguments. It validates the embedded
`app.asar` and refuses alternate unpacked application directories. Release
packaging forces the internal debug flag off and checks the compiled main
bundle before signing. Hardened-runtime entitlements retain only
`com.apple.security.cs.allow-jit`; Looper does not disable library validation or
allow unrestricted unsigned executable memory. [Electron's notarization
guidance](https://github.com/electron/notarize#prerequisites) says the latter
should not be applied to Electron 12 and later because it expands attack
surface, while [Apple's JIT
guidance](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.cs.allow-jit)
identifies `allow-jit` as the scoped `MAP_JIT` exception.

## Why a bootstrap app instead of PKG

A native bootstrap app keeps the initial download small even though Looper uses
Electron. It also avoids a click-through PKG and its separate `Developer ID
Installer` certificate. `Install Looper.app` and `Looper.app` both use the
existing `Developer ID Application` identity.

Before replacing anything, the installer checks the production HTTPS update
feed, artifact name and architecture, Looper's bundle identifier, Developer ID
team, and Gatekeeper acceptance. It refuses to overwrite an unrelated app named
Looper.

## Size baseline

The previous arm64 build measured:

| Artifact | Size |
| --- | ---: |
| Uncompressed `Looper.app` | about 313 MiB (328,051,175 file bytes) |
| Electron framework inside the app | about 274 MiB on disk |
| Looper's compiled renderer | about 2 MiB |
| Compressed ZIP download | 126,209,830 bytes (about 120 MiB) |
| Native installer DMG | about 3 MiB |

Electron is the dominant cost. The release configuration keeps only the English
Electron locale and does not copy dependencies already bundled by Vite. The
resulting unsigned arm64 build measured 251,377,375 file bytes (about 240 MiB).
Its DMG is 112,039,928 bytes (about 107 MiB) and its updater ZIP is 111,833,446
bytes (about 107 MiB). Signing adds a small amount of metadata but does not
materially change those figures.

## Local commands

From `electron/`:

- `pnpm dist:unsigned` builds a local arm64 DMG and ZIP without signing or
  enabling updates, plus an unsigned universal installer DMG.
- `pnpm dist:installer:unsigned` builds only the unsigned universal installer
  DMG for UI testing.
- `pnpm preview:installer` builds and opens the ready installer window without
  downloading or installing Looper. Use `../script/preview_macos_installer.sh
  progress` to open directly in the progress state. Clicking Install Looper in
  either preview only swaps the controls; it never starts an installation.
- `pnpm dist` builds both arm64 and Intel releases and refuses to proceed
  without signing, notarization, and production cloud configuration.
- `../script/verify_macos_release.sh all` independently checks Developer ID
  signatures, hardened runtime, Electron entitlements, Gatekeeper acceptance,
  stapled notarization tickets, DMGs, ZIPs, and both architectures.

Release artifacts are written to `electron/release/` as
`Looper-<version>-macOS-<architecture>.dmg` and `.zip`.
The bootstrap download is `Looper-Installer-<version>.dmg`, with its unpackaged
app retained under `electron/release/installer/` for verification.

## Automated releases

Pushing a stable semantic-version tag such as `v1.2.3` runs
`.github/workflows/macos-release.yml`. The workflow:

1. installs the locked Electron dependencies;
2. takes the app version from the tag;
3. imports the Developer ID identity into the build keychain;
4. builds Apple Silicon and Intel Looper artifacts and a universal native
   installer;
5. signs every executable with hardened runtime;
6. notarizes the apps and disk images with Apple and staples their tickets;
7. runs the independent release verifier;
8. uploads versioned DMGs, ZIPs, and ZIP blockmaps to public Vercel Blob
   storage;
9. computes each ZIP's SHA-512 checksum and exact byte size;
10. publishes `latest-mac.yml` for installed apps and
    `latest-download.json` for new downloads only after every immutable
    artifact is available.

The verifier also checks the production fuse states and rejects the two removed
hardened-runtime exceptions before any artifact is published.

The tag is the release switch. Before pushing it, make sure the target commit
has passed the Electron tests and build, then create and push a version higher
than the current production version:

```text
git tag v1.2.3
git push origin v1.2.3
```

Do not reuse or move a published tag. Release artifacts are immutable, and the
uploader refuses to overwrite a versioned file. If a release needs to be
corrected or rolled back, publish the fix as a newer patch version; installed
apps intentionally reject downgrades.

Configure these GitHub Actions secrets:

- `MACOS_CERTIFICATE_P12_BASE64`: base64-encoded `Developer ID Application`
  certificate and private key exported as a P12.
- `MACOS_CERTIFICATE_PASSWORD`: the P12 export password.
- `APPLE_API_KEY_P8_BASE64`: base64-encoded App Store Connect API private key.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER`: App Store Connect API issuer ID.
- `BLOB_READ_WRITE_TOKEN`: token for a public Vercel Blob store.

The web deployment defaults to Looper's public Blob release directory. Set this
only when moving releases to another public store:

```text
LOOPER_MAC_UPDATE_BASE_URL=https://<store>.public.blob.vercel-storage.com/releases/macos
```

`https://looper.app/download` only resolves artifacts from the signed-release
manifest. It prefers the universal installer DMG; manifests from older releases
that do not contain an installer URL fall back to that manifest's arm64 app DMG.
If no valid release manifest exists, the route returns `503` instead of serving
an unverified fixed or legacy download.

## Automatic updates

Only release builds compile in the `stable` update channel. Local packaged
builds never contact the updater.

A signed release checks the public `latest-mac.yml` release manifest after 15
seconds and every four hours. The manifest includes both architecture-specific
ZIPs, their exact sizes, and SHA-512 checksums. The updater selects the ZIP
matching the running architecture, compares semantic versions locally, and
never offers a downgrade. A check is skipped while another check is in
progress or an update is already available, so the same update is not offered
twice.

When a newer release is available, Looper shows a floating **Update App**
button in the bottom-right corner. It does not spend the user's bandwidth until
they click. On click, the pill contracts into a circle and shows real byte
download progress. The updater verifies the ZIP checksum, stages the signed
app, and then automatically closes Looper, installs the update, and relaunches
the new build. A download or staging failure restores the button so the user
can retry.

ZIP blockmaps let later releases attempt differential downloads against the
cached previous ZIP. The updater safely falls back to downloading the complete
ZIP when no compatible cache or blockmap exists.

Internal development builds include a Debug menu with **Preview Update Button**. It
previews the complete pill-to-progress animation in both local and release
builds without contacting the feed, downloading an artifact, or restarting the
app.

Automatic updating depends on all of these remaining true:

- the running app and replacement app use the same bundle identifier;
- the replacement is signed with the expected Developer ID identity;
- the release ZIP contains the signed app at its root;
- `latest-mac.yml` and the matching ZIP are available over HTTPS;
- the manifest's ZIP size and SHA-512 checksum match the published artifact;
- the published semantic version is newer than the running version.
