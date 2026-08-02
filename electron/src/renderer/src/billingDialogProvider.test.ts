import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("./App.tsx", import.meta.url);
const accountDialogUrl = new URL("./AccountDialog.tsx", import.meta.url);
const dialogUrl = new URL("./BillingDialog.tsx", import.meta.url);
const dialogStylesUrl = new URL("./billingDialog.css", import.meta.url);
const appStylesUrl = new URL("./styles.css", import.meta.url);
const mainUrl = new URL("../../main/index.ts", import.meta.url);

test("presents state-aware cloud storage with both sheet-pack purchases", async () => {
  const [app, dialog] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(dialogUrl, "utf8")
  ]);

  assert.match(dialog, /atLimit \? "Limit Reached" : "Cloud Storage"/);
  assert.doesNotMatch(dialog, /Your account’s cloud sheet allowance/);
  assert.doesNotMatch(dialog, /status\.unusedSheetCount/);
  assert.match(dialog, /status\.sheetCount/);
  assert.match(dialog, /status\.sheetLimit/);
  assert.match(dialog, /sheetPackOffers\.map/);
  assert.match(dialog, /offer\.name/);
  assert.match(dialog, /offer\.displayPrice/);
  assert.doesNotMatch(dialog, /One-time purchase/);
  assert.match(dialog, /billing-purchase-title/);
  assert.match(
    dialog,
    /billing-purchase-action[\s\S]*billing-purchase-price[\s\S]*billing-apple-pay-button/
  );
  assert.match(dialog, /billing-apple-pay-button/);
  assert.match(dialog, /billing-apple-logo">/);
  assert.match(dialog, /role="progressbar"/);
  assert.doesNotMatch(dialog, /billing-quota-progress-bulb/);
  assert.match(dialog, /await onCheckout\(product\)/);
  assert.doesNotMatch(
    dialog,
    /billing-debug-toggle|onDebugAtLimitChange|admin: boolean/
  );
  assert.doesNotMatch(dialog, /Account Type|Looper Free|Looper Unlimited/);
  assert.doesNotMatch(dialog, /Local Only|localAvailable|selectStorageProvider/);
  assert.doesNotMatch(dialog, /open source|View on GitHub/i);

  assert.match(
    app,
    /sheetUsageIsAtLimit \? "Limit Reached" : "Storage limit"/
  );
  assert.match(app, /className="settings-sheet-usage-action">\s*Buy more\s*<\/span>/);
  assert.match(
    app,
    /`Buy more storage with \$\{SHEET_PACK_SIZE\} additional sheets\.[^`]+`/
  );
  assert.match(
    app,
    /className=\{`settings-sheet-usage-card[\s\S]+?onClick=\{\(\) => \{[\s\S]+?setIsBillingDialogOpen\(true\);/
  );
  assert.match(app, /billingDialogStatus\.sheetCount/);
  assert.match(app, /billingDialogStatus\.sheetLimit/);
  assert.match(app, /settings-sheet-usage-divider/);
  assert.match(
    app,
    /settings-sheet-usage-boundary">\s*0\s*<\/span>[\s\S]*settings-sheet-usage-meter[\s\S]*settings-sheet-usage-limit">\s*\{billingDialogStatus\.sheetLimit\}/
  );
  assert.doesNotMatch(app, /settings-sheet-usage-bulb/);
  assert.match(app, /sheetUsageIsAtLimit \? "is-at-limit" : ""/);
  assert.doesNotMatch(app, />used<\/span>|>total<\/span>/);
  assert.match(
    app,
    /!billingStatusAllowsSheetCreation\(effectiveBillingStatus\)/
  );
  assert.match(app, /if \(!effectiveBillingStatus\)/);
  assert.match(app, /getBillingStatus\(\)/);
  assert.match(app, /setIsBillingDialogOpen\(true\)/);
  assert.doesNotMatch(app, /settings-label">Account Type<\/span>/);
  assert.doesNotMatch(app, /settings-account-type-card/);
  assert.doesNotMatch(app, /Open Local Sheets Folder|Change account type/);
});

test("mirrors the settings meter and keeps a single overlay control", async () => {
  const [dialog, styles] = await Promise.all([
    readFile(dialogUrl, "utf8"),
    readFile(dialogStylesUrl, "utf8")
  ]);

  assert.match(dialog, /billing-quota-visualization/);
  assert.match(dialog, /billing-quota-progress-track/);
  assert.doesNotMatch(dialog, /billing-quota-progress-bulb/);
  assert.match(
    dialog,
    /billing-quota-boundary">\s*0\s*<\/span>[\s\S]*billing-quota-progress-meter[\s\S]*billing-quota-limit">\s*\{status\.sheetLimit\}/
  );
  assert.match(dialog, /billing-purchase-card/);
  assert.match(
    dialog,
    /className="billing-dialog-close icon-button titlebar-icon-button"/
  );
  assert.doesNotMatch(dialog, /billing-dialog-refresh|RefreshCw|onRefresh/);
  assert.match(
    styles,
    /\.billing-dialog\s*\{[^}]*width:\s*min\(600px,\s*calc\(100vw - 64px\)\)/s
  );
  assert.match(
    styles,
    /\.billing-dialog-content\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*stretch;[^}]*justify-content:\s*center;/s
  );
  assert.match(
    styles,
    /\.billing-dialog-header\s*\{[^}]*margin:\s*0 auto 16px;/s
  );
  assert.match(
    styles,
    /\.billing-purchase-options\s*\{[^}]*gap:\s*12px;[^}]*margin-top:\s*12px;/s
  );
  assert.match(
    styles,
    /\.billing-dialog-close\.titlebar-icon-button\s*\{[^}]*position:\s*fixed;[^}]*top:\s*var\(--titlebar-control-inset,\s*9px\);[^}]*border:\s*0;[^}]*color:\s*var\(--library-sign-in-text\);[^}]*background:\s*var\(--library-sign-in-bg\);[^}]*box-shadow:\s*var\(--library-sign-in-shadow\);/s
  );
  assert.match(
    styles,
    /\.billing-dialog-close\.titlebar-icon-button:hover\s*\{[^}]*background:\s*var\(--library-sign-in-bg-hover\);/s
  );
  assert.match(
    styles,
    /\.billing-dialog-close\.titlebar-icon-button:active\s*\{[^}]*background:\s*var\(--library-sign-in-bg-pressed\);/s
  );
  assert.doesNotMatch(styles, /billing-dialog-refresh/);
  assert.doesNotMatch(styles, /\.billing-quota-progress-bulb\s*\{/);
  assert.match(
    styles,
    /\.billing-quota-progress\s*\{[^}]*width:\s*calc\(100% \+ 40px\);[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\) 52px;[^}]*gap:\s*0;[^}]*margin:\s*0 -20px;/s
  );
  assert.match(
    styles,
    /\.billing-quota-boundary\s*\{[^}]*text-align:\s*center;/s
  );
  assert.match(
    styles,
    /\.billing-quota-progress-meter\s*\{[^}]*padding:\s*0;/s
  );
  assert.match(
    styles,
    /\.billing-quota-progress-track\s*\{[^}]*height:\s*8px;/s
  );
  assert.match(
    styles,
    /\.billing-quota-visualization\.is-at-limit \.billing-quota-limit\s*\{[^}]*color:\s*var\(--destructive-text\);[^}]*font-weight:\s*700;/s
  );
  assert.match(
    styles,
    /\.billing-dialog\s*\{[^}]*--billing-quota-panel-background:\s*#242426;[^}]*--billing-quota-panel-outline:\s*rgba\(255,\s*255,\s*255,\s*0\.14\);/s
  );
  assert.match(
    styles,
    /:root\[data-theme="light"\] \.billing-dialog\s*\{[^}]*--billing-quota-panel-background:\s*#ffffff;[^}]*--billing-quota-panel-outline:\s*rgba\(0,\s*0,\s*0,\s*0\.08\);/s
  );
  assert.match(
    styles,
    /\.billing-quota-visualization\s*\{[^}]*min-height:\s*72px;[^}]*border:\s*0;[^}]*border-radius:\s*13px;[^}]*background:\s*var\(--billing-quota-panel-background\);[^}]*box-shadow:\s*0 0 0 1px var\(--billing-quota-panel-outline\),\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.04\),\s*0 10px 28px rgba\(0,\s*0,\s*0,\s*0\.07\);/s
  );
  assert.match(
    styles,
    /\.billing-purchase-title\s*\{[^}]*font-weight:\s*450;/s
  );
  assert.match(
    styles,
    /\.billing-purchase-action\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*gap:\s*18px;/s
  );
  assert.match(
    styles,
    /\.billing-purchase-card\s*\{[^}]*border:\s*0;[^}]*background:\s*var\(--billing-purchase-card-background\);[^}]*box-shadow:\s*none;/s
  );
  assert.match(
    styles,
    /\.billing-dialog\s*\{[^}]*--billing-purchase-card-background:\s*#242426;[^}]*--billing-purchase-card-text:\s*rgba\(255,\s*255,\s*255,\s*0\.92\);[^}]*--billing-purchase-card-secondary-text:\s*rgba\(255,\s*255,\s*255,\s*0\.58\);/s
  );
  assert.match(
    styles,
    /:root\[data-theme="light"\] \.billing-dialog\s*\{[^}]*--billing-purchase-card-background:\s*rgba\(0,\s*0,\s*0,\s*0\.03\);[^}]*--billing-purchase-card-text:\s*#111114;[^}]*--billing-purchase-card-secondary-text:\s*rgba\(0,\s*0,\s*0,\s*0\.56\);/s
  );
  assert.match(
    styles,
    /\.billing-apple-pay-button\s*\{[^}]*-webkit-appearance:\s*-apple-pay-button;[^}]*-apple-pay-button-style:\s*white;[^}]*color:\s*var\(--billing-apple-pay-text\);[^}]*background:\s*var\(--billing-apple-pay-background\);/s
  );
  assert.match(
    styles,
    /:root\[data-theme="light"\] \.billing-apple-pay-button\s*\{[^}]*-apple-pay-button-style:\s*black;/s
  );
  const overlayFontSizes = [
    ...styles.matchAll(/^\s*font-size:\s*([^;]+);/gm)
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(overlayFontSizes)].sort(),
    [
      "var(--billing-body-type-size)",
      "var(--billing-title-type-size)"
    ]
  );
  assert.match(styles, /--billing-body-type-size:\s*17px;/);
  assert.match(styles, /--billing-title-type-size:\s*30px;/);
  assert.doesNotMatch(
    dialog,
    /disabled=\{[\s\S]*Boolean\(operation\)[\s\S]*preview[\s\S]*!status\.billingConfigured/
  );
  assert.match(
    styles,
    /@keyframes billing-dialog-present\s*\{[^}]*filter:\s*blur\(10px\);[^}]*transform:\s*scale\(1\.08\);/s
  );
});

test("uses the shared compact error-pill treatment for billing failures", async () => {
  const [dialog, styles] = await Promise.all([
    readFile(dialogUrl, "utf8"),
    readFile(dialogStylesUrl, "utf8")
  ]);

  assert.match(dialog, />\s*Could not open checkout\s*</);
  assert.doesNotMatch(dialog, /Could not refresh sheets/);
  assert.match(dialog, /className="billing-dialog-error"/);
  assert.match(dialog, />\s*Retry\s*</);
  assert.match(
    styles,
    /\.billing-dialog-error\s*\{[^}]*position:\s*fixed;[^}]*bottom:[^;]+;[^}]*width:\s*max-content;[^}]*border:\s*0;[^}]*border-radius:\s*999px;[^}]*background:\s*var\(--billing-error-background\);/s
  );
});

test("shows the compact blue storage meter and its full-limit warning", async () => {
  const styles = await readFile(appStylesUrl, "utf8");
  assert.match(
    styles,
    /\.library-settings-menu\s*\{[^}]*width:\s*312px;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-card\s*\{[^}]*--sheet-usage-card-background:\s*var\(--header-control-bg\);[^}]*--sheet-usage-card-hover-background:\s*var\(--header-control-bg-hover\);[^}]*--sheet-usage-meter-color:\s*var\(--menu-highlight\);[^}]*width:\s*100%;[^}]*background:\s*var\(--sheet-usage-card-background\);/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-card:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--sheet-usage-card-hover-background\);/s
  );
  assert.doesNotMatch(
    styles,
    /\.settings-sheet-usage-card:hover:not\(:disabled\)[^{]*\{[^}]*text-decoration:\s*underline;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-action\s*\{[^}]*padding:\s*0;[^}]*color:\s*var\(--menu-text\);[^}]*font-weight:\s*400;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-divider\s*\{[^}]*height:\s*1px;[^}]*background:\s*var\(--menu-divider\);/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-scale\s*\{[^}]*width:\s*calc\(100% \+ 20px\);[^}]*grid-template-columns:\s*26px minmax\(0, 1fr\) 26px;[^}]*gap:\s*0;[^}]*margin:\s*0 -10px;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-boundary\s*\{[^}]*font-size:\s*10px;[^}]*text-align:\s*center;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-meter\s*\{[^}]*padding:\s*0;/s
  );
  assert.doesNotMatch(styles, /\.settings-sheet-usage-bulb\s*\{/);
  assert.match(
    styles,
    /\.settings-sheet-usage-track\s*\{[^}]*height:\s*6px;/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-card\.is-at-limit\s*\{[^}]*var\(--destructive-text\) 10%[^}]*--sheet-usage-card-hover-background:\s*color-mix\([^}]*var\(--destructive-text\) 16%[^}]*--sheet-usage-meter-color:\s*var\(--destructive-text\);/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-card\.is-at-limit \.settings-sheet-usage-title\s*\{[^}]*color:\s*var\(--destructive-text\);/s
  );
  assert.match(
    styles,
    /\.settings-sheet-usage-card\.is-at-limit \.settings-sheet-usage-limit\s*\{[^}]*color:\s*var\(--destructive-text\);[^}]*font-weight:\s*700;/s
  );
  assert.doesNotMatch(styles, /\.settings-account-type-card/);
});

test("keeps sign-in optional for the primary Looper experience", async () => {
  const [app, accountDialog] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(accountDialogUrl, "utf8")
  ]);
  assert.match(
    app,
    /const openAccountDialogOnLaunch\s*=\s*configuration\?\.openAccountDialogOnLaunch === true/
  );
  assert.match(
    app,
    /openAccountDialogOnLaunch &&\s*accountState\.status === "anonymous"/
  );
  assert.doesNotMatch(app, /const accountDialogIsRequired/);
  assert.doesNotMatch(app, /dismissible=\{/);
  assert.match(accountDialog, /dismissible = true/);
});

test("removes quota and upgrade previews from the desktop Debug menu", async () => {
  const main = await readFile(mainUrl, "utf8");
  assert.match(main, /label: "Debug"/);
  assert.doesNotMatch(main, /label: "Billing State"/);
  assert.doesNotMatch(main, /1 of 5 Sheets Unused/);
  assert.doesNotMatch(main, /No Sheets Unused/);
  assert.doesNotMatch(main, /2 of 55 Sheets Unused/);
  assert.doesNotMatch(main, /label: "Show Upgrade Screen"/);
});
