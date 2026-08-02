import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  migrateToSystemTheme,
  resolveWebTheme,
  systemThemeMigrationKey,
  themeStorageKey
} from "./web-theme.ts";

const webAppUrl = new URL("../app/LooperWebApp.tsx", import.meta.url);
const webCssUrl = new URL("../app/globals.css", import.meta.url);

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    values
  };
}

test("migrates the old forced web theme to the system preference once", () => {
  const storage = memoryStorage({ [themeStorageKey]: "dark" });

  assert.equal(migrateToSystemTheme(storage), "system");
  assert.equal(storage.values.get(themeStorageKey), "system");
  assert.equal(storage.values.get(systemThemeMigrationKey), "1");

  storage.setItem(themeStorageKey, "light");
  assert.equal(migrateToSystemTheme(storage), "light");
});

test("resolves system theme changes in both directions", () => {
  assert.equal(resolveWebTheme("system", false), "light");
  assert.equal(resolveWebTheme("system", true), "dark");
  assert.equal(resolveWebTheme("light", true), "light");
  assert.equal(resolveWebTheme("dark", false), "dark");
});

test("enables system theme support in the shared Looper app", async () => {
  const [webApp, webCss] = await Promise.all([
    readFile(webAppUrl, "utf8"),
    readFile(webCssUrl, "utf8")
  ]);
  assert.match(webApp, /supportsSystemTheme:\s*true/);
  assert.match(webApp, /headerControlSize:\s*"compact"/);
  assert.doesNotMatch(webApp, /headerPresentation/);
  assert.match(
    webCss,
    /@media \(prefers-color-scheme: light\)[\s\S]*\.web-app-status[\s\S]*\.shared-sheet-unavailable/
  );
});

test("covers content beneath web headers with opaque gradients instead of blur", async () => {
  const webCss = await readFile(webCssUrl, "utf8");

  assert.match(
    webCss,
    /\.looper-shell\[data-view-mode="library"\]::before,[\s\S]*\.native-editor-panel::after,[\s\S]*\.loop-results::before\s*\{[^}]*backdrop-filter:\s*none;[^}]*mask-image:\s*none;/s
  );
  assert.match(
    webCss,
    /\[data-view-mode="library"\]::before\s*\{[^}]*var\(--library-canvas-bg\) var\(--titlebar-height\)[^}]*transparent calc\(var\(--titlebar-height\) \+ 16px\)/s
  );
  assert.match(
    webCss,
    /\.native-editor-panel::after\s*\{[^}]*var\(--bg-editor-opaque\) var\(--titlebar-height\)/s
  );
  assert.match(
    webCss,
    /\.loop-results::before\s*\{[^}]*var\(--bg-results-opaque\) var\(--titlebar-height\)/s
  );
});
