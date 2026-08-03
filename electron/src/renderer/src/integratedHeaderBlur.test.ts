import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("./styles.css", import.meta.url);
const appUrl = new URL("./App.tsx", import.meta.url);
const entrypointUrl = new URL("./main.tsx", import.meta.url);

test("has one integrated header design with no alternate presentation switch", async () => {
  const sources = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(entrypointUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /HeaderPresentation|headerPresentation|header-presentation|contained-header|contained-titlebar/
    );
  }
});

test("progressively blurs scrolling content beneath the integrated header", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /--integrated-header-blur-radius:\s*14px;/);
  assert.match(styles, /--integrated-header-overlay-opacity:\s*25%;/);
  assert.match(
    styles,
    /@supports\s*\([^{}]*backdrop-filter:\s*blur\(1px\)[^{}]*mask-image:\s*linear-gradient\(#000, transparent\)[^{}]*\)\s*\{/s
  );
  assert.match(
    styles,
    /\.looper-shell\[data-view-mode="library"\]::before,[\s\S]*\.native-editor-panel::after,[\s\S]*\.loop-results::before\s*\{[^}]*backdrop-filter:\s*blur\(var\(--integrated-header-blur-radius\)\);[^}]*mask-image:\s*var\(--integrated-header-mask\);/s
  );
  assert.match(
    styles,
    /--integrated-header-editor-tint:\s*color-mix\([\s\S]*var\(--bg-editor-opaque\) var\(--integrated-header-overlay-opacity\)/
  );
  assert.match(
    styles,
    /--integrated-header-results-tint:\s*color-mix\([\s\S]*var\(--bg-results-opaque\) var\(--integrated-header-overlay-opacity\)/
  );
  assert.doesNotMatch(
    styles,
    /\.looper-shell[^{}]*::(?:before|after)\s*\{[^}]*opacity:\s*0?\.25/s
  );
});
