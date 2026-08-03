import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appCssUrl = new URL("../app/globals.css", import.meta.url);
const appLayoutUrl = new URL("../app/layout.tsx", import.meta.url);
const webAppUrl = new URL("../app/LooperWebApp.tsx", import.meta.url);
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
    /\.signed-out-download-app-action,[\s\S]*\.library-download-app-button,[\s\S]*\.mobile-marketing-action\.mobile-marketing-download\s*\{[^}]*border-color:\s*transparent;[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);[^}]*box-shadow:\s*var\(--library-sign-in-shadow\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-action\.mobile-marketing-download:hover\s*\{[^}]*background:\s*var\(--library-sign-in-bg-hover\);/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-action\.mobile-marketing-download:active\s*\{[^}]*background:\s*var\(--library-sign-in-bg-pressed\);/s
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
  assert.match(
    appCss,
    /\.mobile-marketing-concept-result\.looped\s*\{[^}]*color:\s*var\(--text-editor-looped-number\);[^}]*cursor:\s*pointer;/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept-result\.looped::before\s*\{[^}]*color:\s*var\(--line-number-color\);[^}]*content:\s*"\[";/s
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept-result\.looped::after\s*\{[^}]*color:\s*var\(--line-number-color\);[^}]*content:\s*"\]";/s
  );
  assert.doesNotMatch(sharedApp, /className="mobile-marketing-nav"/);
  assert.match(
    sharedApp,
    /isMobileWebLayout \? \(\s*<MobileMarketingLibrary[\s\S]*?downloadHref=\{downloadHref\}[\s\S]*?downloadLabel=\{downloadAppLabel\}/s
  );
  assert.match(sharedApp, /libraryConcepts\.map\(\(concept\) =>/);
  assert.match(sharedApp, /const loopValues = concept\.loopValues\?\.\[lineNumber\]/);
  assert.match(sharedApp, /data-loop-result-concept={concept\.id}/);
  assert.match(sharedApp, /mobile-loop-result-history-popover/);
  assert.match(sharedApp, /loopResultPopoverValues\.map\(\(value, index\) =>/);
  assert.match(
    sharedApp,
    /window\.addEventListener\("pointerdown", handlePointerDown\)/
  );
  assert.match(sharedApp, /<span>\{downloadLabel\}<\/span>/);
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
  assert.match(sharedApp, />\s*View GitHub Project\s*<\/a>/);
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
    /@media \(max-width:\s*767px\)[\s\S]*?\.document-library\.public-demo-library\s*\{[^}]*padding-bottom:\s*calc\(20px \+ env\(safe-area-inset-bottom\)\);/
  );
  assert.match(
    appCss,
    /@media \(max-width:\s*767px\)[\s\S]*?\.mobile-marketing-intro h1\s*\{[^}]*padding-inline:\s*2px;/
  );
  assert.match(
    appCss,
    /@media \(max-width:\s*767px\)[\s\S]*?\.public-website-footer-content\s*>\s*span\s*\{[^}]*display:\s*none;/
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
  assert.match(
    sharedApp,
    /function highlightMobileMarketingLoop\(text: string\): ReactNode/
  );
  assert.match(
    sharedApp,
    /concept\.id === "loop-keyword"[\s\S]*?mobile-marketing-magic-word-subtitle/
  );
  assert.match(
    appCss,
    /\.mobile-marketing-concept p\.mobile-marketing-magic-word-subtitle\s*\{[^}]*font-size:\s*clamp\(11px, 4vw, 16px\);[^}]*white-space:\s*nowrap;/s
  );
  assert.doesNotMatch(
    mobileMarketingLibrary,
    /Create Sheet|newDocument|An alternative to spreadsheets|mobile-marketing-examples-heading|Mac notebook calculator/
  );
});

test("extends the core mobile surface through the status bar without a header treatment", async () => {
  const [appCss, appLayout, sharedApp, webApp] = await Promise.all([
    readFile(appCssUrl, "utf8"),
    readFile(appLayoutUrl, "utf8"),
    readFile(sharedAppUrl, "utf8"),
    readFile(webAppUrl, "utf8")
  ]);

  assert.match(appLayout, /viewportFit:\s*"cover"/);
  assert.match(
    appLayout,
    /themeColor:[\s\S]*color:\s*"#171717"[\s\S]*color:\s*"#f7f7f7"/
  );
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
  assert.match(
    webApp,
    /activeView === "library"\s*\? "--library-canvas-bg"\s*:\s*"--bg-editor-opaque"/
  );
  assert.match(
    webApp,
    /attributeFilter:\s*\["data-view-mode"\]/
  );
  assert.match(webApp, /root\.style\.backgroundColor = themeColor/);
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
    /className="mobile-marketing-action mobile-marketing-download"[\s\S]*<span>\{downloadLabel\}<\/span>/s
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

test("lets Safari scroll the mobile library beneath its floating chrome", async () => {
  const appCss = await readFile(appCssUrl, "utf8");

  assert.match(appCss, /--mobile-browser-ui-offset:\s*max\(0px, calc\(100lvh - 100dvh\)\);/);
  assert.match(
    appCss,
    /\.looper-shell\s*\{[^}]*height:\s*100vh;[^}]*height:\s*100lvh;/s
  );
  assert.match(
    appCss,
    /\.looper-shell\[data-view-mode="library"\]\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100lvh;[^}]*overflow:\s*visible;/s
  );
  assert.match(
    appCss,
    /:root\[data-platform="web"\]:has\([\s\S]*?\.looper-shell\[data-view-mode="library"\][\s\S]*?\) body\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s
  );
  const mobileLibrary = appCss.match(
    /:root\[data-platform="web"\] \.document-library\s*\{([^}]*)\}/s
  );
  assert.ok(mobileLibrary);
  assert.match(mobileLibrary[1], /height:\s*auto;/);
  assert.match(mobileLibrary[1], /min-height:\s*100lvh;/);
  assert.match(mobileLibrary[1], /overflow:\s*visible;/);
  assert.match(
    mobileLibrary[1],
    /calc\(42px \+ env\(safe-area-inset-bottom\)\)/
  );
  assert.doesNotMatch(mobileLibrary[1], /mobile-browser-ui-offset/);
  assert.match(
    appCss,
    /\.native-editor-panel \.editor-input\s*\{[^}]*padding-bottom:[^}]*var\(--mobile-browser-ui-offset\)[^}]*overscroll-behavior-y:\s*auto;/s
  );
});
