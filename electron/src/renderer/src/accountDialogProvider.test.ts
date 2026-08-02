import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accountDialogSourceUrl = new URL("./AccountDialog.tsx", import.meta.url);
const accountDialogCssUrl = new URL("./accountDialog.css", import.meta.url);
const appSourceUrl = new URL("./App.tsx", import.meta.url);
const mainSourceUrl = new URL("../../main/index.ts", import.meta.url);

test("keeps the production account dialog email-only", async () => {
  const [accountDialogSource, appSource] = await Promise.all([
    readFile(accountDialogSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8")
  ]);

  assert.match(accountDialogSource, /data-auth-method="email-code"/);
  assert.match(accountDialogSource, /type="email"/);
  assert.match(accountDialogSource, /onRequestCode/);
  assert.doesNotMatch(
    accountDialogSource,
    /signInWithGoogle|cancelGoogleSignIn|account-dialog-google/i
  );
  assert.doesNotMatch(
    accountDialogSource,
    />\s*(?:continue|sign in)\s+with\s+google\s*</i
  );
  assert.doesNotMatch(
    appSource,
    /window\.looper\.(?:signInWithGoogle|cancelGoogleSignIn)/
  );
});

test("keeps header appearance out of account settings and precision in the sheet menu", async () => {
  const appSource = await readFile(appSourceUrl, "utf8");

  assert.doesNotMatch(appSource, />\s*Header background\s*</);
  assert.doesNotMatch(appSource, /Show the header background/);
  assert.match(appSource, /const decimalPlaceOptions = \[0, 1, 2, 3\] as const/);
  assert.match(appSource, /className="document-menu-decimal-setting"/);
  assert.match(appSource, />\s*Decimal places\s*</);
  assert.match(appSource, /setDocumentDecimalPlaces\(option\)/);
});

test("removes account-state previews from the local-only Debug menu", async () => {
  const [appSource, mainSource] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8")
  ]);

  assert.doesNotMatch(appSource, />\s*Signed-out preview\s*</);
  assert.match(mainSource, /label: "Debug"/);
  assert.doesNotMatch(mainSource, /id: "debug-signed-out-preview"/);
  assert.doesNotMatch(mainSource, /label: "Preview Logged-Out Mode"/);
  assert.match(mainSource, /id: "debug-demo-time"/);
});

test("dismisses backdrop clicks from the email step only", async () => {
  const accountDialogSource = await readFile(accountDialogSourceUrl, "utf8");

  assert.match(
    accountDialogSource,
    /step !== "email" \|\| event\.target !== event\.currentTarget/
  );
  assert.match(accountDialogSource, /onClick=\{handleDialogClick\}/);
});

test("blurs the page with the native modal backdrop", async () => {
  const [accountDialogSource, accountDialogCss] = await Promise.all([
    readFile(accountDialogSourceUrl, "utf8"),
    readFile(accountDialogCssUrl, "utf8")
  ]);

  assert.match(
    accountDialogCss,
    /\.account-dialog::backdrop\s*\{[^}]*backdrop-filter:\s*blur\(/s
  );
  assert.doesNotMatch(accountDialogSource, /account-dialog-scrim/);
});

test("keeps the email field focus ring hidden in light mode", async () => {
  const accountDialogCss = await readFile(accountDialogCssUrl, "utf8");

  assert.match(
    accountDialogCss,
    /:root\[data-theme="light"\] \.account-dialog\s*\{[^}]*--account-dialog-field-focus-shadow:\s*none;/s
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-email-field:hover:not\(:has\(input:disabled\)\):not\(:focus-within\)/
  );
});

test("keeps the code field aligned with titlebar navigation at the frame edges", async () => {
  const [accountDialogSource, accountDialogCss] = await Promise.all([
    readFile(accountDialogSourceUrl, "utf8"),
    readFile(accountDialogCssUrl, "utf8")
  ]);

  assert.match(
    accountDialogSource,
    /className="account-dialog-close icon-button titlebar-icon-button"/
  );
  assert.match(
    accountDialogSource,
    /className="account-dialog-email-back-button icon-button titlebar-icon-button mobile-sheet-nav-button mobile-sheet-back-button"/
  );
  assert.doesNotMatch(accountDialogSource, /account-dialog-email-back-label/);
  assert.doesNotMatch(accountDialogCss, /account-dialog-email-back-label/);
  assert.match(
    accountDialogSource,
    /className="account-dialog-code-cells"[\s\S]*Sent to <strong/
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-form\.code-step\s*\{[^}]*margin-top:\s*28px;/
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-close\.titlebar-icon-button,\s*\.account-dialog-email-back-button\.titlebar-icon-button\s*\{[^}]*border:\s*0;[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);[^}]*box-shadow:\s*var\(--library-sign-in-shadow\);/s
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-close\.titlebar-icon-button:hover,\s*\.account-dialog-email-back-button\.titlebar-icon-button:hover\s*\{[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg-hover\);[^}]*box-shadow:\s*var\(--library-sign-in-shadow\);/s
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-close\.titlebar-icon-button:active,\s*\.account-dialog-email-back-button\.titlebar-icon-button:active\s*\{[^}]*background:\s*var\(--library-sign-in-bg-pressed\);/s
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-code-links\s*\{[^}]*position:\s*fixed;[^}]*bottom:[^;]+;[^}]*font-size:\s*13px;/s
  );
  assert.match(
    accountDialogCss,
    /--account-dialog-accent:\s*var\(--menu-check,\s*#(?:4b9cff|0a64d8)\)/
  );
  assert.doesNotMatch(
    accountDialogCss,
    /--account-dialog-(?:accent|focus-ring):\s*var\(--accent-color/
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-code-cell\s*\{[^}]*font-family:\s*inherit;/s
  );
});

test("presents sign-in failures in a compact bottom error pill", async () => {
  const [accountDialogSource, accountDialogCss] = await Promise.all([
    readFile(accountDialogSourceUrl, "utf8"),
    readFile(accountDialogCssUrl, "utf8")
  ]);

  assert.match(accountDialogSource, /request: "Could not send code"/);
  assert.match(accountDialogSource, /verify: "Could not sign in"/);
  assert.match(accountDialogSource, /<span>\{error\.message\}<\/span>/);
  assert.match(accountDialogSource, />\s*Retry\s*</);
  assert.equal(
    accountDialogSource.match(/className="account-dialog-error"/g)?.length,
    1
  );
  assert.match(
    accountDialogCss,
    /\.account-dialog-error\s*\{[^}]*position:\s*fixed;[^}]*bottom:[^;]+;[^}]*left:\s*50%;[^}]*width:\s*max-content;[^}]*border:\s*0;[^}]*border-radius:\s*999px;/s
  );
  assert.doesNotMatch(accountDialogCss, /account-dialog-invalid-shadow|data-invalid/);
});

test("keeps the account transition scale subtle", async () => {
  const accountDialogSource = await readFile(accountDialogSourceUrl, "utf8");

  assert.match(
    accountDialogSource,
    /scale\(\$\{1 \+ \(1 - clampedProgress\) \* 0\.2\}\)/
  );
  assert.doesNotMatch(accountDialogSource, /scale\(\$\{2 - clampedProgress\}\)/);
});
