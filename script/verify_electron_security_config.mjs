#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);

const packageJson = JSON.parse(
  await readFile(join(rootDir, "electron/package.json"), "utf8")
);
assert.match(
  packageJson.scripts?.build ?? "",
  /verify_client_artifacts\.mjs electron/,
  "Electron builds must scan compiled client artifacts for privileged values."
);
const build = packageJson.build;
assert.equal(build?.asar, true, "Electron packaging must keep application code in app.asar.");
assert.equal(
  packageJson.devDependencies?.["@electron/fuses"],
  "2.1.3",
  "The fuse verifier must understand every fuse shipped by Electron 43."
);

const expectedFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false,
  resetAdHocDarwinSignature: true
};
for (const [name, expected] of Object.entries(expectedFuses)) {
  assert.equal(
    build?.electronFuses?.[name],
    expected,
    `Electron fuse ${name} must be ${String(expected)}.`
  );
}
assert.equal(
  build?.mac?.extendInfo?.NSAppTransportSecurity?.NSAllowsArbitraryLoads,
  false,
  "The packaged macOS app must not allow arbitrary insecure network loads."
);
assert.equal(
  build?.afterPack,
  "build/restrictMacTransportSecurity.cjs",
  "macOS packaging must undo Electron Builder's broad transport exception."
);
const macTransportHook = await readFile(
  join(rootDir, "electron/build/restrictMacTransportSecurity.cjs"),
  "utf8"
);
assert.match(
  macTransportHook,
  /NSAllowsArbitraryLoads:\s*false/,
  "The after-pack hook must keep arbitrary transport loads disabled."
);
assert.match(
  macTransportHook,
  /"127\.0\.0\.1"/,
  "The after-pack hook must retain the loopback exception required by Squirrel.Mac."
);
assert.doesNotMatch(
  macTransportHook,
  /NSAllowsLocalNetworking|["']localhost["']/,
  "The after-pack hook must not retain Electron Builder's broad local-network exceptions."
);

const entitlementPaths = [
  "electron/build/entitlements.mac.plist",
  "electron/build/entitlements.mac.inherit.plist"
];
for (const entitlementPath of entitlementPaths) {
  const contents = await readFile(join(rootDir, entitlementPath), "utf8");
  assert.match(
    contents,
    /<key>com\.apple\.security\.cs\.allow-jit<\/key>/,
    `${entitlementPath} must retain the JIT entitlement required by Electron.`
  );
  assert.doesNotMatch(
    contents,
    /com\.apple\.security\.cs\.allow-unsigned-executable-memory/,
    `${entitlementPath} must not allow unrestricted unsigned executable memory.`
  );
  assert.doesNotMatch(
    contents,
    /com\.apple\.security\.cs\.disable-library-validation/,
    `${entitlementPath} must not disable hardened-runtime library validation.`
  );
}

const packageScript = await readFile(
  join(rootDir, "script/package_macos.sh"),
  "utf8"
);
assert.match(
  packageScript,
  /export MAIN_VITE_INTERNAL_DEBUG_BUILD=false/,
  "The signed macOS release path must force internal debug access off."
);
assert.match(
  packageScript,
  /verify_release_debug_build_is_disabled/,
  "The signed macOS release path must verify the compiled debug flag."
);

const electronMainSource = await readFile(
  join(rootDir, "electron/src/main/index.ts"),
  "utf8"
);
assert.equal(
  electronMainSource.match(/process\.env\.ELECTRON_RENDERER_URL/g)?.length,
  1,
  "The untrusted development renderer environment variable must be consumed exactly once."
);
assert.match(
  electronMainSource,
  /resolveDevRendererUrl\(\s*process\.env\.ELECTRON_RENDERER_URL,\s*app\.isPackaged\s*\)/,
  "The development renderer URL must be rejected in packaged builds."
);
assert.doesNotMatch(
  electronMainSource,
  /(?:loadURL|new URL)\(process\.env\.ELECTRON_RENDERER_URL\)/,
  "Browser windows must never consume the raw development renderer environment variable."
);
assert.match(
  electronMainSource,
  /const isDev = devRendererUrl !== undefined/,
  "Internal development behavior must derive from the validated renderer URL."
);
assert.match(
  electronMainSource,
  /if \(devRendererUrl\) \{\s*const expected = new URL\(devRendererUrl\)/,
  "IPC sender trust must derive from the validated renderer URL."
);
assert.match(
  electronMainSource,
  /createdWindow\.loadURL\(devRendererUrl\)/,
  "The main development window must load only the validated renderer URL."
);
assert.match(
  electronMainSource,
  /protocol\.registerSchemesAsPrivileged\(/,
  "The renderer scheme must be registered before Electron becomes ready."
);
assert.match(
  electronMainSource,
  /protocol\.handle\(packagedRendererScheme/,
  "The renderer scheme must use Electron's current protocol.handle API."
);
assert.match(
  electronMainSource,
  /resolvePackagedRendererRequestPath\(\s*request\.url,\s*packagedRendererRoot\s*\)/,
  "The packaged protocol handler must confine every request to the renderer root."
);
assert.match(
  electronMainSource,
  /createdWindow\.loadURL\(packagedRendererEntryUrl\)/,
  "The packaged main window must use the custom renderer protocol."
);
assert.doesNotMatch(
  electronMainSource,
  /\.loadFile\(/,
  "Packaged application windows must not use file://."
);
assert.match(
  electronMainSource,
  /findDisallowedPackagedChromiumSwitch\(\s*app\.commandLine,\s*app\.isPackaged\s*\)/,
  "Packaged startup must inspect Chromium switches before creating a window."
);
assert.match(
  electronMainSource,
  /if \(disallowedPackagedChromiumSwitch\) \{[\s\S]{0,300}app\.exit\(1\);[\s\S]{0,100}\}/,
  "Packaged startup must fail closed when a dangerous Chromium switch is present."
);
const browserWindowCount =
  electronMainSource.match(/new BrowserWindow\s*\(/g)?.length ?? 0;
assert.ok(
  browserWindowCount > 0,
  "Electron must define at least one application window."
);
assert.equal(
  electronMainSource.match(/devTools: !app\.isPackaged/g)?.length ?? 0,
  browserWindowCount,
  "Every BrowserWindow must disable DevTools in packaged builds."
);

const startupSecuritySource = await readFile(
  join(rootDir, "electron/src/main/startupSecurity.ts"),
  "utf8"
);
for (const blockedSwitch of [
  "disable-web-security",
  "ignore-certificate-errors",
  "no-sandbox",
  "remote-debugging-pipe",
  "remote-debugging-port"
]) {
  assert.match(
    startupSecuritySource,
    new RegExp(`"${blockedSwitch}"`),
    `Packaged startup must reject --${blockedSwitch}.`
  );
}

const ciWorkflow = await readFile(
  join(rootDir, ".github/workflows/ci.yml"),
  "utf8"
);
assert.match(
  ciWorkflow,
  /^\s+- prod\s*$/m,
  "CI must run on the documented Vercel production branch."
);

const webEnvironmentExample = await readFile(
  join(rootDir, "web/.env.example"),
  "utf8"
);
assert.doesNotMatch(
  webEnvironmentExample,
  /(?:SUPABASE|STRIPE|LOOPER_ADMIN_|NEXT_PUBLIC_.*ADMIN)/,
  "The open-source marketing site must not advertise cloud, payment, or admin configuration."
);

const webPackageJson = JSON.parse(
  await readFile(join(rootDir, "web/package.json"), "utf8")
);
assert.match(
  webPackageJson.scripts?.build ?? "",
  /verify_client_artifacts\.mjs web/,
  "Web builds must scan static browser artifacts for privileged values."
);

const electronEnvironmentExample = await readFile(
  join(rootDir, "electron/.env.example"),
  "utf8"
);
assert.doesNotMatch(
  electronEnvironmentExample,
  /LOOPER_ADMIN_(?:MFA_READY_USER_IDS|TOTP_FACTOR_IDS|USER_IDS)/,
  "Admin UUID and TOTP-factor allowlists must not be compiled into Electron."
);

console.log("Verified Electron release security configuration.");
