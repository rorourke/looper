import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

test("macOS packages register the restrictive ATS after-pack hook", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8")
  );
  assert.equal(
    packageJson.build?.afterPack,
    "build/restrictMacTransportSecurity.cjs"
  );
});

test("the macOS after-pack hook removes Electron Builder's broad ATS exception", {
  skip: process.platform === "darwin" ? false : "requires macOS plutil"
}, async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "looper-package-security-")
  );
  const infoPlistPath = join(
    temporaryDirectory,
    "Looper.app/Contents/Info.plist"
  );
  await mkdir(dirname(infoPlistPath), { recursive: true });
  await writeFile(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>NSAppTransportSecurity</key><dict>
<key>NSAllowsArbitraryLoads</key><true/>
<key>NSAllowsLocalNetworking</key><true/>
<key>NSExceptionDomains</key><dict><key>localhost</key><dict/></dict>
</dict></dict></plist>`
  );

  try {
    const restrictMacTransportSecurity = require(
      "../../build/restrictMacTransportSecurity.cjs"
    ) as (context: {
      appOutDir: string;
      electronPlatformName: string;
      packager: { appInfo: { productFilename: string } };
    }) => Promise<void>;
    await restrictMacTransportSecurity({
      appOutDir: temporaryDirectory,
      electronPlatformName: "darwin",
      packager: { appInfo: { productFilename: "Looper" } }
    });

    const { stdout } = await execFileAsync(
      "/usr/bin/plutil",
      ["-convert", "json", "-o", "-", infoPlistPath],
      { encoding: "utf8" }
    );
    const info = JSON.parse(stdout);
    assert.deepEqual(info.NSAppTransportSecurity, {
      NSAllowsArbitraryLoads: false,
      NSExceptionDomains: {
        "127.0.0.1": {
          NSExceptionAllowsInsecureHTTPLoads: true,
          NSIncludesSubdomains: false
        }
      }
    });
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("macOS releases bind the installer to the app signing team without a hard-coded team", async () => {
  const [installerSource, packageScript, verificationScript] =
    await Promise.all([
      readFile(
        new URL("../../../installer/Sources/InstallerApp.swift", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../../../script/package_macos_installer.sh", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../../../script/verify_macos_release.sh", import.meta.url),
        "utf8"
      )
    ]);

  for (const source of [installerSource, packageScript, verificationScript]) {
    assert.doesNotMatch(source, /5ES339A7SN/);
  }
  assert.match(installerSource, /kSecCodeInfoTeamIdentifier/);
  assert.match(packageScript, /release_team_identifier/);
  assert.match(
    verificationScript,
    /installer_team_identifier[\s\S]*release_team_identifier/
  );
});

test("the macOS installer verifies the downloaded executable architecture with valid lipo syntax", async () => {
  const installerSource = await readFile(
    new URL("../../../installer/Sources/InstallerApp.swift", import.meta.url),
    "utf8"
  );

  assert.match(
    installerSource,
    /arguments:\s*\[executableURL\.path, "-verify_arch", looperArchitecture\]/
  );
  assert.doesNotMatch(
    installerSource,
    /arguments:\s*\["-verify_arch", looperArchitecture, executableURL\.path\]/
  );
  assert.ok(installerSource.includes('"-R=\\(requirement)"'));
  assert.ok(
    !installerSource.includes('"--test-requirement=\\(requirement)"')
  );
});

test("the macOS installer tolerates destination-added Finder metadata after strict archive verification", async () => {
  const installerSource = await readFile(
    new URL("../../../installer/Sources/InstallerApp.swift", import.meta.url),
    "utf8"
  );

  assert.match(
    installerSource,
    /verifySignature\(of: appURL, strict: true\)/
  );
  assert.match(
    installerSource,
    /verifySignature\(of: incoming, strict: false\)/
  );
  assert.match(
    installerSource,
    /if strict \{\s*verificationArguments\.insert\("--strict", at: 2\)/
  );
});
test("each macOS installer release has a distinct Launch Services identity", async () => {
  const [packageScript, verificationScript] = await Promise.all([
    readFile(
      new URL("../../../script/package_macos_installer.sh", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../../script/verify_macos_release.sh", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(
    packageScript,
    /INSTALLER_BUNDLE_IDENTIFIER="com\.nickbolton\.looper\.installer\.release-\$\{VERSION\/\/\.\/-\}"/
  );
  assert.match(
    packageScript,
    /plutil -replace CFBundleIdentifier -string "\$INSTALLER_BUNDLE_IDENTIFIER"/
  );
  assert.match(
    verificationScript,
    /expected_installer_bundle_identifier="com\.nickbolton\.looper\.installer\.release-\$\{installer_version\/\/\.\/-\}"/
  );
  assert.match(
    verificationScript,
    /installer_bundle_identifier[^]*expected_installer_bundle_identifier/
  );
});

test("Windows releases compile out internal debug access before packaging", async () => {
  const windowsPackageScript = await readFile(
    new URL("../../../script/package_windows.sh", import.meta.url),
    "utf8"
  );

  assert.match(
    windowsPackageScript,
    /export MAIN_VITE_INTERNAL_DEBUG_BUILD=false/
  );
  assert.match(
    windowsPackageScript,
    /pnpm build\s+verify_release_debug_build_is_disabled\s+pnpm exec electron-builder/
  );
  assert.match(
    windowsPackageScript,
    /Refusing to package a Windows release with internal debug access enabled\./
  );
});
