import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appCssUrl = new URL("../app/globals.css", import.meta.url);
const appLayoutUrl = new URL("../app/layout.tsx", import.meta.url);
const sharedAppUrl = new URL(
  "../../electron/src/renderer/src/App.tsx",
  import.meta.url
);

test("turns the mobile library into a full-width marketing page", async () => {
  const [appCss, sharedApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\]\s*\{[^}]*--mobile-library-left-inset:\s*max\(12px, env\(safe-area-inset-left\)\);[^}]*--mobile-library-right-inset:\s*max\(12px, env\(safe-area-inset-right\)\);[^}]*background:\s*var\(--library-canvas-bg\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-action\s*\{[^}]*display:\s*inline-flex;[^}]*width:\s*auto;[^}]*border-radius:\s*999px;/s
  );
  assert.match(
    appCss,
    /\.library-divider\.mobile-marketing-concept-divider\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;[^}]*margin:\s*28px 0;/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept-result\s*\{[^}]*color:\s*var\(--text-editor-number\);/s
  );
  assert.doesNotMatch(sharedApp, /className="mobile-marketing-nav"/);
  assert.match(
    sharedApp,
    /isMobileWebLayout \? \(\s*<MobileMarketingLibrary[\s\S]*?downloadHref=\{downloadHref\}/s
  );
  assert.match(sharedApp, /libraryConcepts\.map\(\(concept, index\) =>/);
  assert.match(sharedApp, /index > 0 \? \([\s\S]*mobile-marketing-concept-divider/);
  assert.match(sharedApp, /<span>Get Mac App<\/span>/);
  assert.match(sharedApp, /<span>View Source<\/span>/);
  assert.match(sharedApp, /https:\/\/github\.com\/rorourke\/looper/);
  const mobileMarketingLibrary = sharedApp.slice(
    sharedApp.indexOf("function MobileMarketingLibrary"),
    sharedApp.indexOf("type LibraryDocumentCardProps")
  );
  assert.doesNotMatch(
    mobileMarketingLibrary,
    /className="library-divider mobile-marketing-divider"/
  );
  assert.match(mobileMarketingLibrary, /aria-label="Looper examples"/);
  assert.match(
    mobileMarketingLibrary,
    /is an open source desktop notebook calculator\. It uses the magic word /
  );
  assert.match(
    mobileMarketingLibrary,
    /className="mobile-marketing-loop">loop<\/span>/
  );
  assert.match(
    mobileMarketingLibrary,
    /to manipulate calculations over time\./
  );
  assert.doesNotMatch(
    mobileMarketingLibrary,
    /Create Sheet|newDocument|An alternative to spreadsheets|mobile-marketing-examples-heading|Mac notebook calculator/
  );
});

test("extends the mobile surface into safe areas with a defined top edge and no library header", async () => {
  const [appCss, appLayout, sharedApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(appLayoutUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(appLayout, /viewportFit:\s*"cover"/);
  assert.match(appCss, /:root\[data-platform="web"\],[^}]*background:\s*var\(--bg-editor-opaque\);/s);
  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\][\s\S]*> \.native-titlebar\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\]::before\s*\{[^}]*content:\s*none;/s
  );
  assert.match(
    appCss,
    /\.looper-shell::after\s*\{[^}]*top:\s*0;[^}]*height:\s*0\.5px;[^}]*background:\s*var\(--divider-content\);/s
  );
  assert.match(sharedApp, /const handleLibraryScroll = useCallback\(/);
  assert.match(sharedApp, /onScroll=\{handleLibraryScroll\}/);
});

test("keeps the public demo actions explicit and hides account controls", async () => {
  const [appCss, sharedApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(
    appCss,
    /\.mobile-sheet-nav-button,[\s\S]*\.mobile-library-glass-control\s*\{[^}]*background:\s*var\(--header-control-bg\);[^}]*backdrop-filter:\s*none;/s
  );
  assert.match(
    appCss,
    /\.titlebar-pill-button\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s
  );
  assert.doesNotMatch(appCss, /--mobile-sheet-glass-/);
  assert.match(
    sharedApp,
    /!publicDemoMode &&\s*!localOnlyMode &&\s*presentedAccountState\.status === "anonymous"[\s\S]*library-sign-in-button/
  );
  assert.match(
    sharedApp,
    /className="mobile-marketing-action mobile-marketing-download"[\s\S]*<span>Get Mac App<\/span>/s
  );
  assert.match(
    sharedApp,
    /className="mobile-marketing-action mobile-marketing-source"[\s\S]*<span>View Source<\/span>/s
  );
});

test("keeps the web library search glyph compact without changing its tap target", async () => {
  const appCss = await readFile(appCssUrl, "utf8");

  assert.match(
    appCss,
    /:root\[data-platform="web"\][\s\S]*\.library-search-button[\s\S]*\.ui-icon\.compact-titlebar-icon\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s
  );
  assert.match(
    appCss,
    /:root\[data-platform="web"\] \.titlebar-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s
  );
});

test("uses safe-area-backed flat iOS-sized controls for the mobile sheet header", async () => {
  const [appCss, sharedApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="editor"\]\s*\{[^}]*background:\s*var\(--bg-editor-opaque\);/s
  );
  assert.match(
    appCss,
    /\.native-titlebar\.sheet-titlebar::before\s*\{[^}]*height:\s*env\(safe-area-inset-top\);[^}]*background:\s*var\(--bg-editor-opaque\);/s
  );
  assert.match(
    appCss,
    /\.titlebar-controls\s*\{[^}]*padding-right:\s*max\(16px, env\(safe-area-inset-right\)\);[^}]*padding-left:\s*max\(16px, env\(safe-area-inset-left\)\);[^}]*gap:\s*8px;/s
  );
  assert.match(
    appCss,
    /\.mobile-sheet-nav-button\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*height:\s*44px;/s
  );
  assert.match(
    appCss,
    /\.titlebar-pill-button\.header-loop-count-button\s*\{[^}]*min-width:\s*80px;[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s
  );
  assert.match(sharedApp, /className="mobile-sheet-nav-button mobile-sheet-back-button"/);
  assert.match(sharedApp, /className="mobile-sheet-nav-button mobile-sheet-sidebar-button"/);
  assert.match(sharedApp, /isMobileWebLayout \? "Loop" : "Loop:"/);
});

test("lets mobile content extend beneath Safari chrome with terminal scroll room", async () => {
  const appCss = await readFile(appCssUrl, "utf8");

  assert.match(appCss, /--mobile-browser-ui-offset:\s*max\(0px, calc\(100lvh - 100dvh\)\);/);
  assert.match(
    appCss,
    /\.looper-shell\s*\{[^}]*height:\s*100vh;[^}]*height:\s*100lvh;/s
  );
  assert.match(
    appCss,
    /\.document-library\s*\{[^}]*height:\s*100lvh;[^}]*var\(--mobile-browser-ui-offset\)[^}]*overscroll-behavior-y:\s*auto;/s
  );
  assert.match(
    appCss,
    /\.native-editor-panel \.editor-input\s*\{[^}]*padding-bottom:[^}]*var\(--mobile-browser-ui-offset\)[^}]*overscroll-behavior-y:\s*auto;/s
  );
});
