import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("the light library canvas is gray while cards use the sheet content color", () => {
  const lightTheme = styles.split(':root[data-theme="light"]')[1]?.split("\n}")[0] ?? "";

  assert.match(lightTheme, /--library-canvas-bg:\s*var\(--bg-results-opaque\);/);
  assert.match(
    styles,
    /\.looper-shell\[data-view-mode="library"\] \.document-library\s*\{[^}]*background:\s*var\(--library-canvas-bg\);/s
  );

  for (const token of [
    "library-card-bg",
    "library-card-bg-active",
    "library-card-bg-hover",
    "library-card-preview-bg",
    "library-card-preview-bg-hover"
  ]) {
    assert.match(lightTheme, new RegExp(`--${token}:\\s*var\\(--bg-editor-opaque\\);`));
  }
});
