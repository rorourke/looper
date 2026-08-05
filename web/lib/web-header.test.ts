import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webCssUrl = new URL("../app/globals.css", import.meta.url);
const electronCssUrl = new URL(
  "../../electron/src/renderer/src/styles.css",
  import.meta.url
);

test("lets the desktop web library scroll through the window without changing Electron's header", async () => {
  const [webCss, electronCss] = await Promise.all([
    readFile(webCssUrl, "utf8"),
    readFile(electronCssUrl, "utf8")
  ]);

  assert.doesNotMatch(webCss, /--web-header-hairline-width/);
  assert.doesNotMatch(webCss, /\[data-library-scrolled="true"\]::before/);
  assert.match(
    webCss,
    /@media \(min-width:\s*768px\)[\s\S]*?:root\[data-platform="web"\]:has\(\.document-library\.public-demo-library\) body\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s
  );
  assert.match(
    webCss,
    /> \.native-titlebar\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    webCss,
    /\)::before\s*\{[^}]*content:\s*none;/s
  );
  assert.match(
    webCss,
    /\.document-library\.public-demo-library\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100vh;[^}]*overflow:\s*visible;[^}]*padding-top:\s*calc\(var\(--titlebar-height\) \+ 28px\);/s
  );
  assert.match(
    electronCss,
    /\.looper-shell\[data-view-mode="library"\]::before\s*\{[^}]*content:\s*"";[^}]*height:\s*var\(--integrated-header-fade-end\);[^}]*background:\s*linear-gradient/s
  );
  assert.match(
    electronCss,
    /@supports[\s\S]*\.looper-shell\[data-view-mode="library"\]::before,[\s\S]*\{[^}]*backdrop-filter:\s*blur\(var\(--integrated-header-blur-radius\)\);/s
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
