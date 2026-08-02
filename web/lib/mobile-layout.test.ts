import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appCssUrl = new URL("../app/globals.css", import.meta.url);
const appLayoutUrl = new URL("../app/layout.tsx", import.meta.url);
const vercelIgnoreUrl = new URL("../../.vercelignore", import.meta.url);
const sharedAppUrl = new URL(
  "../../electron/src/renderer/src/App.tsx",
  import.meta.url
);

test("keeps the client artifact verifier in Vercel uploads", async () => {
  const vercelIgnore = await readFile(vercelIgnoreUrl, "utf8");

  assert.match(vercelIgnore, /^script\/\*$/m);
  assert.match(vercelIgnore, /^!script\/verify_client_artifacts\.mjs$/m);
  assert.doesNotMatch(vercelIgnore, /^script\/$/m);
});

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
    /\.mobile-marketing-concept\s*\{[^}]*padding:\s*22px;[^}]*border:\s*1px solid var\(--library-card-border\);[^}]*border-radius:\s*18px;[^}]*background:\s*var\(--library-card-bg\);[^}]*box-shadow:\s*var\(--library-card-shadow\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-action\s*\{[^}]*display:\s*inline-flex;[^}]*width:\s*auto;[^}]*border-radius:\s*999px;/s
  );
  const mobileBreakpointIndex = appCss.indexOf("@media (max-width: 767px)");
  const invertedDownloadIndex = appCss.indexOf(
    ':root[data-platform="web"] .signed-out-download-app-action'
  );
  assert.ok(invertedDownloadIndex >= 0);
  assert.ok(invertedDownloadIndex < mobileBreakpointIndex);
  assert.match(
    appCss,
    /\.signed-out-download-app-action,[\s\S]*\.library-download-app-button,[\s\S]*\.mobile-marketing-download\s*\{[^}]*border-color:\s*transparent;[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);[^}]*box-shadow:\s*var\(--library-sign-in-shadow\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concepts\s*\{[^}]*padding:\s*0;[^}]*margin-top:\s*30px;/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*gap:\s*12px;/s
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
  assert.match(sharedApp, /libraryConcepts\.map\(\(concept\) =>/);
  assert.match(sharedApp, /<span>Get Mac App<\/span>/);
  assert.match(sharedApp, /<span>View Source<\/span>/);
  assert.match(sharedApp, /https:\/\/github\.com\/rorourke\/looper/);
  assert.match(sharedApp, /function PublicWebsiteFooter\(\): ReactElement/);
  assert.match(sharedApp, /const looperCreatorUrl = "https:\/\/rourkery\.com\/"/);
  assert.match(sharedApp, /Created by\{" "\}/);
  assert.match(
    sharedApp,
    /href=\{looperCreatorUrl\}[\s\S]*Ryan O&apos;Rourke/
  );
  assert.match(sharedApp, /<span aria-hidden="true">·<\/span>/);
  assert.match(sharedApp, />\s*View Source\s*<\/a>/);
  assert.match(
    sharedApp,
    /className="public-website-footer-divider" role="separator"/
  );
  assert.doesNotMatch(sharedApp, /© \{currentYear\}|Ryan Rorke/);
  assert.match(
    sharedApp,
    /\{publicDemoMode \? <PublicWebsiteFooter \/> : null\}\s*<\/section>/
  );
  assert.match(
    sharedApp,
    /const shouldShowLibrarySearchControl =\s*!publicDemoMode &&\s*\(localOnlyMode \|\| presentedAccountState\.status === "authenticated"\);/
  );
  assert.match(
    sharedApp,
    /key === "f" &&\s*!publicDemoMode &&\s*viewMode === "library"/
  );
  assert.match(
    sharedApp,
    /\{shouldShowLibrarySearchControl \? \(\s*<div className="library-search-control"/
  );
  assert.match(
    appCss,
    /\.public-website-footer\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*1120px;[^}]*padding-top:\s*48px;[^}]*margin:\s*auto auto 0;/s
  );
  assert.match(
    appCss,
    /\.public-website-footer-divider\s*\{[^}]*height:\s*9px;[^}]*margin-bottom:\s*24px;[^}]*mask-image:\s*url\("data:image\/svg\+xml,[^"]*M0 4\.5C4 0\.5 8 0\.5 12 4\.5s8 4 12 0[^"]*"\);[^}]*mask-repeat:\s*repeat-x;[^}]*mask-size:\s*22px 9px;[^}]*-webkit-mask-image:/s
  );
  assert.match(
    appCss,
    /\.public-website-footer-content\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*4px 9px;/s
  );
  assert.match(
    appCss,
    /@media \(min-width:\s*768px\)\s*\{[^}]*\.document-library\.public-demo-library\s*\{[^}]*padding-bottom:\s*24px;/s
  );
  assert.match(
    appCss,
    /@media \(max-width:\s*767px\)[\s\S]*?\.public-website-footer-divider\s*\{[^}]*display:\s*none;[\s\S]*?\.public-website-footer-content\s*\{[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/
  );
  assert.match(
    appCss,
    /\.public-website-footer a\s*\{[^}]*(?:color-mix)[^}]*transition:\s*color 140ms ease;/s
  );
  assert.doesNotMatch(
    appCss,
    /\.public-website-footer a(?:\:hover)?\s*\{[^}]*(?:background|border-radius):/s
  );
  const mobileMarketingLibrary = sharedApp.slice(
    sharedApp.indexOf("function MobileMarketingLibrary"),
    sharedApp.indexOf("type LibraryDocumentCardProps")
  );
  assert.doesNotMatch(
    mobileMarketingLibrary,
    /mobile-marketing-(?:concept-)?divider/
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

test("extends the core mobile surface through the status bar without a header treatment", async () => {
  const [appCss, appLayout, sharedApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(appLayoutUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(appLayout, /viewportFit:\s*"cover"/);
  const mobileStyles = appCss.slice(
    appCss.indexOf("@media (max-width: 767px)"),
    appCss.indexOf("@media (max-width: 767px) and (prefers-reduced-motion: reduce)")
  );
  const mobileRootSurface = mobileStyles.match(
    /:root\[data-platform="web"\],[\s\S]*?:root\[data-platform="web"\] #root\s*\{([^}]*)\}/
  );
  assert.ok(mobileRootSurface);
  assert.doesNotMatch(mobileRootSurface[1], /background:/);
  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\][\s\S]*> \.native-titlebar\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\]::before\s*\{[^}]*content:\s*none;/s
  );
  assert.doesNotMatch(mobileStyles, /\.looper-shell::after/);
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
