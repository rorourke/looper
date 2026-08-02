import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const dialogSourceUrl = new URL("./AccountDialog.tsx", import.meta.url);

test("requires destructive confirmation and a fresh email code before account deletion", async () => {
  const [app, dialog] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(dialogSourceUrl, "utf8")
  ]);

  assert.match(app, /window\.confirm\([\s\S]*?Permanently delete/);
  assert.match(
    app,
    /await window\.looper\.verifyEmailCode\(email, code\);\s*await window\.looper\.deleteAccount\(\);/
  );
  assert.match(app, /lockEmail=\{accountDialogPurpose === "delete-account"\}/);
  assert.match(app, />Delete Account…</);
  assert.match(dialog, /readOnly=\{lockEmail\}/);
});
