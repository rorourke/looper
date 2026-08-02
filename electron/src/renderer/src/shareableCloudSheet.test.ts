import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { CloudSheet, UpdateCloudSheetInput } from "../../shared/cloudAccount.ts";
import { enableShareableUrlAfterCreate } from "./shareableCloudSheet.ts";

const appSourceUrl = new URL("./App.tsx", import.meta.url);

const disabledSheet: CloudSheet = {
  clientCreatedId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-07-21T00:00:00.000Z",
  document: {},
  id: "22222222-2222-4222-8222-222222222222",
  revision: 1,
  schemaVersion: 1,
  shareEnabled: false,
  shareToken: "a".repeat(64),
  title: "Budget",
  updatedAt: "2026-07-21T00:00:00.000Z"
};

test("explicitly enables sharing when a newly uploaded sheet defaults to disabled", async () => {
  const calls: UpdateCloudSheetInput[] = [];
  const enabledSheet = { ...disabledSheet, revision: 2, shareEnabled: true };

  const result = await enableShareableUrlAfterCreate(
    disabledSheet,
    true,
    async (input) => {
      calls.push(input);
      return enabledSheet;
    }
  );

  assert.deepEqual(calls, [
    {
      expectedRevision: 1,
      id: disabledSheet.id,
      shareEnabled: true
    }
  ]);
  assert.equal(result, enabledSheet);
});

test("does not issue a redundant sharing update", async () => {
  let updateCalled = false;
  const enabledSheet = { ...disabledSheet, shareEnabled: true };

  const result = await enableShareableUrlAfterCreate(
    enabledSheet,
    true,
    async () => {
      updateCalled = true;
      return enabledSheet;
    }
  );

  assert.equal(updateCalled, false);
  assert.equal(result, enabledSheet);
});

test("keeps legacy cloud responses available for the existing compatibility warning", async () => {
  let updateCalled = false;
  const legacySheet = { ...disabledSheet, shareToken: undefined };

  const result = await enableShareableUrlAfterCreate(
    legacySheet,
    true,
    async () => {
      updateCalled = true;
      return legacySheet;
    }
  );

  assert.equal(updateCalled, false);
  assert.equal(result, legacySheet);
});

test("shows sharing state and only allows copying an enabled shareable URL", async () => {
  const appSource = await readFile(appSourceUrl, "utf8");

  assert.match(
    appSource,
    /activeDocument\.cloud\?\.shareEnabled \? "Enabled" : "Disabled"/
  );
  assert.match(
    appSource,
    /disabled=\{\s*!activeDocument\.cloud\?\.shareEnabled \|\|\s*isUpdatingShareSettings \|\|\s*isCreatingCloudSheet\s*\}[\s\S]*?<span>Copy Shareable URL<\/span>/
  );
});
