import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  conciseCloudIssueMessage,
  isSheetLimitIssue
} from "./cloudIssueCopy.ts";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const appStylesUrl = new URL("./styles.css", import.meta.url);

test("shortens cloud issue details for the shared error pill", () => {
  assert.equal(
    conciseCloudIssueMessage(
      "Your sheets synced, but the offline copy could not be refreshed."
    ),
    "Could not refresh offline copy"
  );
  assert.equal(
    conciseCloudIssueMessage(
      "Cloud is unavailable. Your sheets and edits are saved on this device.",
      true
    ),
    "Using offline"
  );
  assert.equal(
    conciseCloudIssueMessage(
      "Cloud is unavailable, and this device does not have an offline copy yet.",
      true
    ),
    "Using offline"
  );
  assert.equal(
    conciseCloudIssueMessage("Could not update sharing settings."),
    "Could not update sharing"
  );
  assert.equal(
    conciseCloudIssueMessage("Could not copy the shareable URL."),
    "Could not copy link"
  );
  assert.equal(
    conciseCloudIssueMessage("Unexpected remote failure"),
    "Cloud sync failed"
  );
  assert.equal(
    conciseCloudIssueMessage("The sheet allowance has been reached."),
    "No unused sheets"
  );
  assert.equal(isSheetLimitIssue("sheet_limit_reached"), true);
});

test("presents errors strongly and offline mode as a quiet bottom pill", async () => {
  const [appSource, appStyles] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(appStylesUrl, "utf8")
  ]);

  assert.match(
    appSource,
    /className=\{`cloud-sync-banner \$\{isUsingOffline \? "offline" : ""\}`\}/
  );
  assert.match(appSource, /conciseCloudIssueMessage\(/);
  assert.match(appSource, />\s*Retry\s*</);
  assert.match(
    appSource,
    /presentedAccountState\.status === "authenticated" && !isUsingOffline/
  );
  assert.match(
    appStyles,
    /\.cloud-sync-banner\s*\{[^}]*position:\s*fixed;[^}]*bottom:[^;]+;[^}]*width:\s*max-content;[^}]*border:\s*0;[^}]*border-radius:\s*999px;[^}]*background:\s*#b3263a;/s
  );
  assert.match(
    appStyles,
    /\.cloud-sync-banner\.offline\s*\{[^}]*border:\s*1px solid var\(--library-card-border\);[^}]*color:\s*var\(--text-headerbar-title\);[^}]*background:\s*var\(--library-card-bg\);[^}]*box-shadow:\s*var\(--library-card-shadow\);/s
  );
  assert.match(
    appStyles,
    /\.cloud-sync-banner button\s*\{[^}]*font:\s*inherit;[^}]*opacity:\s*0\.65;/s
  );
  assert.match(
    appStyles,
    /\.cloud-sync-banner button:hover:not\(:disabled\)\s*\{[^}]*opacity:\s*1;/s
  );
});

test("recovers a rejected create as a storage-limit action", async () => {
  const appSource = await readFile(appSourceUrl, "utf8");

  assert.match(
    appSource,
    /const reportedSheetLimit = isSheetLimitIssue\(errorMessage\)/
  );
  assert.match(
    appSource,
    /latestBillingStatus = await window\.looper\.getBillingStatus\(\)/
  );
  assert.match(
    appSource,
    /!billingStatusAllowsSheetCreation\(latestBillingStatus\)/
  );
  assert.match(
    appSource,
    /setIsBillingDialogOpen\(true\);\s*setCloudSyncState\("saved"\);\s*setCloudSyncErrorMessage\(""\)/
  );
});
