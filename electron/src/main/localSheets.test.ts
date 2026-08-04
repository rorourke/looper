import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  defaultLocalSheetDirectoryPath,
  LocalSheetStore,
  SheetStorageSettingsStore
} from "./localSheets.ts";

const sheetId = "11111111-1111-4111-8111-111111111111";

test("new local sheets default inside Looper's unprotected app data", () => {
  const userDataPath = join(tmpdir(), "Looper");
  assert.equal(
    defaultLocalSheetDirectoryPath(userDataPath),
    join(userDataPath, "sheets")
  );
});

test("local sheets use standalone .loop files and optimistic revisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "looper-local-sheets-"));
  let now = new Date("2026-07-23T00:00:00.000Z");
  const store = new LocalSheetStore({
    directoryPath: join(root, "sheets"),
    now: () => now
  });

  try {
    const created = await store.createSheet({
      id: sheetId,
      title: "Local Budget",
      document: {
        title: "Local Budget",
        text: "revenue = 10"
      }
    });
    assert.equal(created.revision, 1);
    assert.match(created.path, /Local Budget--11111111-1111-4111-8111-111111111111\.loop$/);

    const onDisk = JSON.parse(await readFile(created.path, "utf8")) as {
      _looper: { id: string };
      text: string;
    };
    assert.equal(onDisk.text, "revenue = 10");
    assert.equal(onDisk._looper.id, sheetId);

    now = new Date("2026-07-23T00:01:00.000Z");
    const updated = await store.updateSheet({
      id: sheetId,
      title: "Local Budget",
      document: {
        title: "Local Budget",
        text: "revenue = 20"
      },
      expectedRevision: 1
    });
    assert.equal(updated.revision, 2);
    assert.equal((await store.listSheets())[0].document.text, "revenue = 20");

    await assert.rejects(
      store.updateSheet({
        id: sheetId,
        title: "Stale",
        document: { title: "Stale", text: "" },
        expectedRevision: 1
      }),
      /changed on disk/
    );

    await store.deleteSheet({ id: sheetId, expectedRevision: 2 });
    assert.deepEqual(await store.listSheets(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sheet storage defaults to local files and remembers a selected folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "looper-storage-settings-"));
  const store = new SheetStorageSettingsStore({
    filePath: join(root, "settings.json")
  });

  try {
    assert.deepEqual(await store.getSettings(), { provider: "local" });
    assert.deepEqual(await store.setSettings("local", join(root, "sheets")), {
      provider: "local",
      localDirectoryPath: join(root, "sheets")
    });
    assert.deepEqual(await store.setSettings("looper-cloud", join(root, "sheets")), {
      provider: "looper-cloud",
      localDirectoryPath: join(root, "sheets")
    });
    assert.deepEqual(await store.getSettings(), {
      provider: "looper-cloud",
      localDirectoryPath: join(root, "sheets")
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
