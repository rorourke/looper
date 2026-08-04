import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("./App.tsx", import.meta.url);
const stylesUrl = new URL("./styles.css", import.meta.url);

test("uses the marketing header only while the local library has no user sheets", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /localOnlyMode\s*\? presentedUserLibraryDocuments\.length === 0[\s\S]*className="signed-out-library-actions"[\s\S]*Create Sheet/
  );
  assert.match(
    app,
    /\(publicDemoMode \|\| !localOnlyMode\) && downloadAppButtonIsVisible/
  );
  assert.match(
    app,
    /localOnlyMode\s*\? presentedUserLibraryDocuments\.length > 0[\s\S]*localOnlyMode \|\| presentedAccountState\.status !== "anonymous"[\s\S]*newSheetCard/
  );
});

test("starts the logged-out preview at visible library content", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /const applySignedOutPreview = useCallback\([\s\S]*libraryScrollTopRef\.current = 0;[\s\S]*setViewMode\("library"\);[\s\S]*libraryScrollRef\.current\.scrollTop = 0;/
  );
  assert.match(
    app,
    /onSignedOutPreviewChanged\(\(enabled\) => \{[\s\S]*applySignedOutPreview\(enabled\);/
  );
});

test("does not evaluate a hidden authenticated sheet through the preview workbook", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /globalVariableWorkbook && activeDocument\s*\? globalVariableWorkbook\.evaluateDocumentIfPresent\(activeDocument\.id\)[\s\S]*workbookEvaluation \?\?[\s\S]*evaluateLooperText/
  );
});

test("keeps the centered Looper settings menu available in local-only mode", async () => {
  const [app, styles] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(
    app,
    /const shouldShowLibrarySettingsControl =\s*!publicDemoMode &&\s*\(localOnlyMode \|\|[\s\S]*presentedAccountState\.status === "authenticated"/
  );
  assert.match(
    app,
    /shouldShowLibrarySettingsControl \? \(\s*<div\s*className="library-settings-control library-centered-control"[\s\S]*localOnlyMode[\s\S]*\? "Looper"/
  );
  assert.match(
    styles,
    /\.library-centered-control \.library-settings-menu\s*\{[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s
  );
});

test("keeps the website footer out of the desktop library", async () => {
  const [app, styles] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.doesNotMatch(app, /ProductFooter|product-footer/);
  assert.doesNotMatch(styles, /\.product-footer/);
});

test("places the authenticated platform download button beside Search on the right", async () => {
  const app = await readFile(appUrl, "utf8");
  const getAppButtonIndex = app.indexOf(
    'className="titlebar-pill-button library-download-app-button"'
  );
  const searchControlIndex = app.indexOf(
    'className="library-search-control"',
    getAppButtonIndex
  );

  assert.match(
    app,
    /downloadAppButtonIsVisible[\s\S]*presentedAccountState\.status === "authenticated"[\s\S]*library-download-app-button[\s\S]*<span>\{downloadAppLabel\}<\/span>/
  );
  assert.ok(getAppButtonIndex > -1);
  assert.ok(searchControlIndex > getAppButtonIndex);
  assert.doesNotMatch(
    app.slice(getAppButtonIndex, getAppButtonIndex + 200),
    /library-centered-control/
  );
});

test("lays out the signed-out actions as a short horizontal card row", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.signed-out-library-actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*12px;/s
  );
  assert.match(
    styles,
    /\.signed-out-library-action\s*\{[^}]*width:\s*auto;[^}]*height:\s*40px;[^}]*flex:\s*0 0 auto;[^}]*justify-content:\s*flex-start;[^}]*padding:\s*0 20px 0 14px;[^}]*border-radius:\s*999px;[^}]*font-size:\s*15px;/s
  );
  assert.match(
    styles,
    /\.signed-out-library-action-icon\s*\{[^}]*width:\s*16px;[^}]*transform:\s*translateY\(0\.5px\);/s
  );
  assert.match(
    styles,
    /\.signed-out-library-action:hover\s*\{[^}]*transform:\s*translateY\(-1px\);/s
  );
  assert.doesNotMatch(styles, /\.signed-out-create-sheet-action(?:\s|:)*\{/);
});

test("optically balances the divider between the preceding content and Looper Basics", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.library-header\s*\{[^}]*width:\s*100%;[^}]*margin:\s*0 auto 30px;/s
  );
  assert.match(
    styles,
    /\.library-title-group\s*\{[^}]*padding:\s*0 2px;/s
  );
  assert.match(
    styles,
    /\.getting-started-title\s*\{[^}]*padding:\s*24px 2px;/s
  );
  assert.match(
    styles,
    /\.signed-out-library-actions\s*\{[^}]*margin:\s*0 auto 18px;/s
  );
  assert.match(
    styles,
    /\.signed-out-library-actions \+ \.library-divider\s*\{[^}]*margin-top:\s*22px;/s
  );
  assert.match(
    styles,
    /\.document-grid \+ \.library-divider\s*\{[^}]*margin-top:\s*40px;/s
  );
  assert.match(
    styles,
    /\.library-divider \+ \.getting-started-section \.getting-started-title\s*\{[^}]*padding-top:\s*30px;/s
  );
});

test("keeps breathing room below the final library row", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.document-library\s*\{[^}]*padding:[^;]*max\(48px, env\(safe-area-inset-bottom\)\);/s
  );
});

test("uses a wavy divider before Looper Basics", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.library-divider\s*\{[^}]*height:\s*9px;[^}]*flex:\s*0 0 9px;[^}]*mask-image:\s*url\("data:image\/svg\+xml,[^"]+"\);[^}]*mask-repeat:\s*repeat-x;[^}]*mask-size:\s*22px 9px;[^}]*-webkit-mask-image:/s
  );
});

test("uses the same optical divider spacing after user sheets", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.document-grid \+ \.library-divider\s*\{[^}]*margin-top:\s*40px;/s
  );
});

test("right-aligns the signed-out sign-in button with inverted theme colors", async () => {
  const [app, styles] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(
    app,
    /className="library-header-controls"[\s\S]*presentedAccountState\.status === "anonymous"[\s\S]*library-sign-in-button/
  );
  assert.doesNotMatch(
    app,
    /className="library-settings-control library-centered-control"[\s\S]{0,500}library-sign-in-button/
  );
  assert.match(
    styles,
    /--library-sign-in-bg:\s*#f5f5f7;[\s\S]*--library-sign-in-text:\s*#171717;/
  );
  assert.match(
    styles,
    /:root\[data-theme="light"\][\s\S]*--library-sign-in-bg:\s*#1d1d1f;[\s\S]*--library-sign-in-text:\s*#ffffff;/
  );
  assert.match(
    styles,
    /\.library-titlebar-controls \.library-sign-in-button\s*\{[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);/s
  );
});
