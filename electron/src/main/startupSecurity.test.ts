import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  disallowedPackagedChromiumSwitches,
  findDisallowedPackagedChromiumSwitch,
  isTrustedPackagedRendererDocumentUrl,
  packagedRendererEntryUrl,
  packagedRendererScheme,
  packagedSettingsRendererEntryUrl,
  resolvePackagedRendererRequestPath,
  resolveDevRendererUrl
} from "./startupSecurity.ts";

test("accepts only canonical loopback HTTP renderer origins in development", () => {
  assert.equal(
    resolveDevRendererUrl("http://localhost:5173", false),
    "http://localhost:5173"
  );
  assert.equal(
    resolveDevRendererUrl("http://127.0.0.1:4443/path?q=1#fragment", false),
    "http://127.0.0.1:4443"
  );
  assert.equal(
    resolveDevRendererUrl("http://[::1]:5173/renderer", false),
    "http://[::1]:5173"
  );
});

test("ignores every development renderer override in packaged builds", () => {
  for (const value of [
    "http://localhost:5173",
    "https://127.0.0.1:4443",
    "https://attacker.example",
    "not a URL",
    undefined
  ]) {
    assert.equal(resolveDevRendererUrl(value, true), undefined);
  }
});

test("rejects non-loopback and ambiguous development renderer URLs", () => {
  for (const value of [
    "https://attacker.example",
    "https://127.0.0.1:4443",
    "http://localhost.attacker.example",
    "http://attacker.localhost",
    "http://0.0.0.0:5173",
    "file:///tmp/renderer.html",
    "data:text/html,unsafe",
    "http://user:password@localhost:5173",
    " http://localhost:5173",
    "http://localhost:5173 ",
    "",
    "not a URL",
    undefined,
    5173,
    `http://localhost/${"x".repeat(2_048)}`
  ]) {
    assert.equal(resolveDevRendererUrl(value, false), undefined, String(value));
  }
});

test("blocks dangerous Chromium switches only in packaged builds", () => {
  for (const blockedSwitch of disallowedPackagedChromiumSwitches) {
    const commandLine = {
      hasSwitch: (name: string) => name === blockedSwitch
    };
    assert.equal(
      findDisallowedPackagedChromiumSwitch(commandLine, true),
      blockedSwitch
    );
    assert.equal(
      findDisallowedPackagedChromiumSwitch(commandLine, false),
      undefined
    );
  }

  assert.equal(
    findDisallowedPackagedChromiumSwitch(
      { hasSwitch: () => false },
      true
    ),
    undefined
  );
});

test("resolves packaged renderer files inside one dedicated bundle root", () => {
  const rendererRoot = resolve("/Applications/Looper.app/Contents/Resources/app.asar/out/renderer");

  assert.equal(
    resolvePackagedRendererRequestPath(
      `${packagedRendererEntryUrl}?window=settings`,
      rendererRoot
    ),
    join(rendererRoot, "index.html")
  );
  assert.equal(
    resolvePackagedRendererRequestPath(
      `${packagedRendererEntryUrl.replace("index.html", "assets/app%20icon.svg")}?v=1`,
      rendererRoot
    ),
    join(rendererRoot, "assets/app icon.svg")
  );
});

test("rejects custom-protocol traversal and URL ambiguity", () => {
  const rendererRoot = resolve("/Applications/Looper.app/Contents/Resources/app.asar/out/renderer");
  const unsafeUrls = [
    "file:///Applications/Looper.app/Contents/Resources/app.asar/out/renderer/index.html",
    "https://renderer/index.html",
    `${packagedRendererScheme}://attacker/index.html`,
    `${packagedRendererScheme}://RENDERER/index.html`,
    `${packagedRendererScheme}://user@renderer/index.html`,
    `${packagedRendererScheme}://renderer:443/index.html`,
    `${packagedRendererScheme}://renderer/../main/index.js`,
    `${packagedRendererScheme}://renderer/%2e%2e/main/index.js`,
    `${packagedRendererScheme}://renderer/assets%2f..%2fmain/index.js`,
    `${packagedRendererScheme}://renderer/assets%5c..%5cmain/index.js`,
    `${packagedRendererScheme}://renderer/%00index.html`,
    `${packagedRendererScheme}://renderer/%`,
    `${packagedRendererEntryUrl}#fragment`,
    "not a URL"
  ];

  for (const unsafeUrl of unsafeUrls) {
    assert.equal(
      resolvePackagedRendererRequestPath(unsafeUrl, rendererRoot),
      undefined,
      unsafeUrl
    );
  }
});

test("trusts only the packaged renderer entry documents", () => {
  assert.equal(
    isTrustedPackagedRendererDocumentUrl(packagedRendererEntryUrl),
    true
  );
  assert.equal(
    isTrustedPackagedRendererDocumentUrl(
      packagedSettingsRendererEntryUrl
    ),
    true
  );

  for (const untrustedUrl of [
    `${packagedRendererEntryUrl}?window=admin`,
    `${packagedRendererEntryUrl}?window=settings&window=settings`,
    `${packagedRendererEntryUrl}#fragment`,
    `${packagedRendererEntryUrl.replace("index.html", "assets/app.js")}`,
    `${packagedRendererScheme}://attacker/index.html`,
    "file:///tmp/index.html"
  ]) {
    assert.equal(
      isTrustedPackagedRendererDocumentUrl(untrustedUrl),
      false,
      untrustedUrl
    );
  }
});

test("wires one validated renderer URL and packaged-only startup protections", async () => {
  const mainSource = await readFile(new URL("./index.ts", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8")
  );

  assert.equal(
    mainSource.match(/process\.env\.ELECTRON_RENDERER_URL/g)?.length,
    1,
    "The raw renderer environment variable must be consumed exactly once."
  );
  assert.match(
    mainSource,
    /resolveDevRendererUrl\(\s*process\.env\.ELECTRON_RENDERER_URL,\s*app\.isPackaged\s*\)/
  );
  assert.doesNotMatch(
    mainSource,
    /(?:loadURL|new URL)\(process\.env\.ELECTRON_RENDERER_URL\)/
  );
  assert.match(mainSource, /const isDev = devRendererUrl !== undefined/);
  assert.match(
    mainSource,
    /if \(devRendererUrl\) \{\s*const expected = new URL\(devRendererUrl\)/
  );
  assert.match(mainSource, /createdWindow\.loadURL\(devRendererUrl\)/);
  assert.match(mainSource, /protocol\.registerSchemesAsPrivileged\(/);
  assert.match(mainSource, /standard:\s*true/);
  assert.match(mainSource, /secure:\s*true/);
  assert.match(mainSource, /protocol\.handle\(packagedRendererScheme/);
  assert.match(
    mainSource,
    /resolvePackagedRendererRequestPath\(\s*request\.url,\s*packagedRendererRoot\s*\)/
  );
  assert.match(mainSource, /net\.fetch\(pathToFileURL\(filePath\)\.toString\(\)\)/);
  assert.match(
    mainSource,
    /createdWindow\.loadURL\(packagedRendererEntryUrl\)/,
    "The packaged main window must use the custom renderer origin."
  );
  assert.match(
    mainSource,
    /createdWindow\.loadURL\(packagedSettingsRendererEntryUrl\)/,
    "The packaged settings window must use the custom renderer origin."
  );
  assert.doesNotMatch(
    mainSource,
    /\.loadFile\(/,
    "Application windows must not use file:// in packaged builds."
  );
  assert.match(
    mainSource,
    /findDisallowedPackagedChromiumSwitch\(\s*app\.commandLine,\s*app\.isPackaged\s*\)/
  );
  assert.match(
    mainSource,
    /if \(disallowedPackagedChromiumSwitch\) \{[\s\S]{0,300}app\.exit\(1\);[\s\S]{0,100}\}/
  );
  assert.ok(
    mainSource.indexOf("findDisallowedPackagedChromiumSwitch(") <
      mainSource.indexOf("new BrowserWindow("),
    "Packaged command-line validation must run before any BrowserWindow is created."
  );
  assert.equal(
    mainSource.match(/devTools: !app\.isPackaged/g)?.length,
    2,
    "Every application BrowserWindow must disable DevTools when packaged."
  );
  assert.equal(
    packageJson.build?.electronFuses?.grantFileProtocolExtraPrivileges,
    false
  );
  assert.equal(packageJson.build?.electronFuses?.enableCookieEncryption, true);
  assert.equal(
    packageJson.build?.mac?.extendInfo?.NSAppTransportSecurity
      ?.NSAllowsArbitraryLoads,
    false
  );
});
