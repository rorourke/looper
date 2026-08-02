import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveDownloadPlatform,
  shouldShowDownloadAppButton
} from "./downloadLinkPreference.ts";

const stylesUrl = new URL("./styles.css", import.meta.url);

test("always shows Get App on the web and hides it in the app", () => {
  assert.equal(
    shouldShowDownloadAppButton({
      alwaysShow: false,
      runtimePlatform: "web"
    }),
    true
  );
  assert.equal(
    shouldShowDownloadAppButton({
      alwaysShow: false,
      runtimePlatform: "darwin"
    }),
    false
  );
  assert.equal(
    shouldShowDownloadAppButton({
      alwaysShow: false,
      runtimePlatform: "win32"
    }),
    false
  );
});

test("supports the desktop debug override", () => {
  assert.equal(
    shouldShowDownloadAppButton({
      alwaysShow: true,
      runtimePlatform: "darwin"
    }),
    true
  );
});

test("spoofs the Windows download language and target in debug mode", () => {
  assert.equal(
    resolveDownloadPlatform({
      configuredPlatform: "macos",
      runtimePlatform: "darwin",
      spoofWindows: true
    }),
    "windows"
  );
  assert.equal(
    resolveDownloadPlatform({
      runtimePlatform: "darwin",
      spoofWindows: false
    }),
    "macos"
  );
});

test("styles the authenticated Get App button like the inverse Sign In button", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.titlebar-pill-button\.library-download-app-button\s*\{[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);[^}]*font-weight:\s*560;/s
  );
  assert.match(
    styles,
    /\.titlebar-pill-button\.library-download-app-button:hover\s*\{[^}]*background:\s*var\(--library-sign-in-bg-hover\);/s
  );
});
