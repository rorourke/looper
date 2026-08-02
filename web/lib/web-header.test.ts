import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webCssUrl = new URL("../app/globals.css", import.meta.url);
const sharedAppUrl = new URL("../../electron/src/renderer/src/App.tsx", import.meta.url);

test("fades in a density-aware outside web main-menu hairline only after scrolling", async () => {
  const [webCss, sharedApp] = await Promise.all([
    readFile(webCssUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(
    webCss,
    /:root\[data-platform="web"\]\s*\{[^}]*--web-header-hairline-width:\s*1px;/s
  );
  assert.match(
    webCss,
    /@media \(-webkit-min-device-pixel-ratio: 2\), \(min-resolution: 2dppx\)\s*\{[\s\S]*:root\[data-platform="web"\]\s*\{[^}]*--web-header-hairline-width:\s*0\.5px;/s
  );
  assert.match(
    webCss,
    /@media \(min-width: 768px\)[\s\S]*\.looper-shell\[data-view-mode="library"\]::before\s*\{[^}]*height:\s*var\(--titlebar-height\);[^}]*border-bottom:\s*0;[^}]*background:\s*var\(--library-canvas-bg\);[^}]*box-shadow:\s*0 var\(--web-header-hairline-width\) 0 transparent;[^}]*transition:\s*box-shadow 160ms ease;/s
  );
  assert.match(
    webCss,
    /\.looper-shell\[data-view-mode="library"\]\[data-library-scrolled="true"\]::before\s*\{[^}]*box-shadow:\s*0 var\(--web-header-hairline-width\) 0 var\(--divider-content\);/s
  );
  assert.match(sharedApp, /setIsLibraryScrolled\(event\.currentTarget\.scrollTop > 0\)/);
  assert.match(
    sharedApp,
    /data-library-scrolled=\{isLibraryScrolled \? "true" : undefined\}/
  );
});

test("keeps the desktop web titlebar invisible and surfaces only the content column", async () => {
  const webCss = await readFile(webCssUrl, "utf8");

  assert.match(
    webCss,
    /@media \(min-width: 768px\)[\s\S]*\.looper-shell\[data-view-mode="editor"\][\s\S]*> \.native-titlebar\.sheet-titlebar\s*\{[^}]*border-bottom:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s
  );
  assert.match(
    webCss,
    /\.looper-shell\[data-view-mode="editor"\][\s\S]*\.native-editor-panel::after\s*\{[^}]*height:\s*var\(--titlebar-height\);[^}]*border-bottom:\s*0\.5px solid var\(--divider-content\);[^}]*background:\s*var\(--bg-editor-opaque\);/s
  );
  assert.doesNotMatch(
    webCss,
    /\[data-view-mode="editor"\][\s\S]*\.native-editor-panel::after,[\s\S]*\.loop-results::before\s*\{[^}]*content:\s*none;/s
  );
});

test("centers and animates the transparent title with the desktop web sheet column", async () => {
  const webCss = await readFile(webCssUrl, "utf8");

  assert.match(
    webCss,
    /\.sheet-titlebar-editor-controls[\s\S]*> \.document-title-control\s*\{[^}]*position:\s*absolute;[^}]*left:\s*calc\(\(100% - var\(--loop-sidebar-width\)\) \/ 2\);[^}]*transform:\s*translateX\(-50%\);[^}]*transition:\s*left 180ms ease,\s*max-width 180ms ease;/s
  );
  assert.match(
    webCss,
    /\.native-titlebar\.results-hidden[\s\S]*> \.document-title-control\s*\{[^}]*left:\s*50%;/s
  );
  assert.match(
    webCss,
    /\.document-title-button:hover,[\s\S]*\.document-title-button:active,[\s\S]*\.document-title-button\.active,[\s\S]*\.document-title-button\s*\{[^}]*background:\s*transparent;[^}]*font-size:\s*calc\(var\(--titlebar-emphasized-pill-font-size\) \+ 2px\);/s
  );
  assert.match(
    webCss,
    /\.looper-shell\.loop-sidebar-resizing[\s\S]*> \.document-title-control\s*\{[^}]*transition:\s*none;/s
  );
});

test("scales the visible desktop web header controls with the sheet title", async () => {
  const webCss = await readFile(webCssUrl, "utf8");

  assert.match(
    webCss,
    /\.titlebar-pill-button\.header-loop-count-button,[\s\S]*\.library-brand-settings-button,[\s\S]*\.library-sign-in-button,[\s\S]*\.titlebar-pill-button\.library-download-app-button\s*\{[^}]*height:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);[^}]*min-height:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);[^}]*font-size:\s*calc\(var\(--titlebar-emphasized-pill-font-size\) \+ 2px\);/s
  );
  assert.match(
    webCss,
    /\.titlebar-icon-button\s*\{[^}]*width:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);[^}]*min-width:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);[^}]*height:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);[^}]*min-height:\s*calc\(var\(--titlebar-control-size\) \+ 4px\);/s
  );
  assert.match(
    webCss,
    /\.titlebar-pill-button\.header-loop-count-button\s*\{[^}]*padding-right:\s*14px;[^}]*padding-left:\s*18px;/s
  );
  assert.match(
    webCss,
    /\.library-titlebar-controls[\s\S]*\.library-brand-settings-button\s*\{[^}]*padding-right:\s*14px;[^}]*padding-left:\s*18px;/s
  );
  assert.match(
    webCss,
    /\.library-titlebar-controls[\s\S]*\.library-sign-in-button\s*\{[^}]*padding-right:\s*18px;[^}]*padding-left:\s*18px;/s
  );
  assert.match(
    webCss,
    /\.titlebar-pill-button\.library-download-app-button\s*\{[^}]*padding-right:\s*14px;[^}]*padding-left:\s*14px;/s
  );
});
