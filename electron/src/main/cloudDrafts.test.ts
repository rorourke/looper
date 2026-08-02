import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CloudSheetDraft } from "../shared/cloudAccount.ts";
import type { EncryptionProvider } from "./cloudAccount.ts";
import {
  CloudDraftBoundary,
  EncryptedCloudDraftStore,
  createCloudDraftBeforeQuitHandler,
  type CloudDraftStore
} from "./cloudDrafts.ts";

const firstAccountId = "11111111-1111-4111-8111-111111111111";
const secondAccountId = "22222222-2222-4222-8222-222222222222";
const firstSheetId = "33333333-3333-4333-8333-333333333333";
const secondSheetId = "44444444-4444-4444-8444-444444444444";
const savedAt = new Date("2026-07-18T19:00:00.000Z");

function testEncryption(available = true): EncryptionProvider {
  return {
    decryptStringAsync: async (encrypted) => {
      const encoded = encrypted.toString("utf8");
      if (!encoded.startsWith("ciphertext:")) throw new Error("invalid ciphertext");
      return {
        result: Buffer.from(encoded.slice("ciphertext:".length), "base64").toString(
          "utf8"
        ),
        shouldReEncrypt: false
      };
    },
    encryptStringAsync: async (plaintext) =>
      Buffer.from(`ciphertext:${Buffer.from(plaintext).toString("base64")}`, "utf8"),
    isAsyncEncryptionAvailable: async () => available
  };
}

function draftInput(sheetId: string, title = "Budget") {
  return {
    sheetId,
    title,
    document: { text: "rent = 2000", loopCount: 3 },
    schemaVersion: 1 as const,
    expectedRevision: 4
  };
}

describe("encrypted owner-scoped cloud drafts", () => {
  test("atomically persists encrypted drafts in isolated account namespaces", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-drafts-"));
    const store = new EncryptedCloudDraftStore({
      directoryPath: join(directory, "drafts"),
      encryption: testEncryption(),
      now: () => savedAt
    });

    try {
      await store.saveCloudDraft(firstAccountId, draftInput(firstSheetId));
      await store.saveCloudDraft(
        secondAccountId,
        draftInput(secondSheetId, "Private forecast")
      );

      assert.deepEqual(await store.listCloudDrafts(firstAccountId), [
        {
          ...draftInput(firstSheetId),
          savedAt: savedAt.toISOString()
        }
      ]);
      assert.deepEqual(await store.listCloudDrafts(secondAccountId), [
        {
          ...draftInput(secondSheetId, "Private forecast"),
          savedAt: savedAt.toISOString()
        }
      ]);

      const accountDirectories = await readdir(join(directory, "drafts"));
      assert.equal(accountDirectories.length, 2);
      const allRawFiles: string[] = [];
      for (const accountDirectory of accountDirectories) {
        assert.doesNotMatch(accountDirectory, /11111111|22222222/);
        const draftFiles = await readdir(join(directory, "drafts", accountDirectory));
        assert.equal(draftFiles.length, 1);
        assert.match(draftFiles[0], /^[0-9a-f]{64}\.draft$/);
        allRawFiles.push(
          await readFile(join(directory, "drafts", accountDirectory, draftFiles[0]), "utf8")
        );
      }
      const rawStorage = allRawFiles.join("\n");
      assert.equal(rawStorage.includes("rent = 2000"), false);
      assert.equal(rawStorage.includes("Private forecast"), false);
      assert.equal(rawStorage.includes(firstAccountId), false);
      assert.equal(rawStorage.includes(firstSheetId), false);

      await store.deleteCloudDraft(firstAccountId, { sheetId: firstSheetId });
      assert.deepEqual(await store.listCloudDrafts(firstAccountId), []);
      assert.equal((await store.listCloudDrafts(secondAccountId)).length, 1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("serializes concurrent saves so readers never observe a partial draft", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-drafts-"));
    const store = new EncryptedCloudDraftStore({
      directoryPath: join(directory, "drafts"),
      encryption: testEncryption(),
      now: () => savedAt
    });

    try {
      const firstSave = store.saveCloudDraft(
        firstAccountId,
        draftInput(firstSheetId, "First version")
      );
      const secondSave = store.saveCloudDraft(
        firstAccountId,
        draftInput(firstSheetId, "Latest version")
      );
      await Promise.all([firstSave, secondSave]);

      const drafts = await store.listCloudDrafts(firstAccountId);
      assert.equal(drafts.length, 1);
      assert.equal(drafts[0].title, "Latest version");
      const accountDirectory = (await readdir(join(directory, "drafts")))[0];
      assert.deepEqual(
        (await readdir(join(directory, "drafts", accountDirectory))).filter((name) =>
          name.endsWith(".tmp")
        ),
        []
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("applies the cloud UUID, title, JSON, schema, size, and revision limits", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-drafts-"));
    const store = new EncryptedCloudDraftStore({
      directoryPath: join(directory, "drafts"),
      encryption: testEncryption()
    });

    try {
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, draftInput("not-a-uuid")),
        /ID is invalid/
      );
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, {
          ...draftInput(firstSheetId),
          title: "x".repeat(201)
        }),
        /between 1 and 200/
      );
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, {
          ...draftInput(firstSheetId),
          document: []
        }),
        /JSON object/
      );
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, {
          ...draftInput(firstSheetId),
          document: { text: "x".repeat(1024 * 1024) }
        }),
        /larger than 1 MiB/
      );
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, {
          ...draftInput(firstSheetId),
          schemaVersion: 2
        }),
        /unsupported schema/
      );
      await assert.rejects(
        store.saveCloudDraft(firstAccountId, {
          ...draftInput(firstSheetId),
          expectedRevision: 0
        }),
        /revision is invalid/
      );
      assert.deepEqual(await store.listCloudDrafts(firstAccountId), []);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("fails closed when async platform encryption is unavailable", async () => {
    const store = new EncryptedCloudDraftStore({
      directoryPath: join(tmpdir(), "looper-cloud-drafts-unavailable"),
      encryption: testEncryption(false)
    });
    await assert.rejects(
      store.saveCloudDraft(firstAccountId, draftInput(firstSheetId)),
      /unavailable/
    );
    await assert.rejects(store.listCloudDrafts(firstAccountId), /unavailable/);
  });
});

describe("verified cloud draft boundary and quit draining", () => {
  test("never exposes another account's namespace", async () => {
    const namespaces = new Map<string, CloudSheetDraft[]>();
    let currentAccountId = firstAccountId;
    const store: CloudDraftStore = {
      deleteCloudDraft: async (ownerId, input) => {
        const sheetId = (input as { sheetId: string }).sheetId;
        namespaces.set(
          ownerId,
          (namespaces.get(ownerId) ?? []).filter((draft) => draft.sheetId !== sheetId)
        );
      },
      listCloudDrafts: async (ownerId) => namespaces.get(ownerId) ?? [],
      saveCloudDraft: async (ownerId, input) => {
        const draft = {
          ...(input as Omit<CloudSheetDraft, "savedAt">),
          savedAt: savedAt.toISOString()
        };
        namespaces.set(ownerId, [draft]);
        return draft;
      }
    };
    const boundary = new CloudDraftBoundary(
      {
        getAccount: async () => ({
          id: currentAccountId,
          email: "verified@example.com"
        })
      },
      store
    );

    await boundary.saveCloudDraft(draftInput(firstSheetId));
    currentAccountId = secondAccountId;
    assert.deepEqual(await boundary.listCloudDrafts(), []);
    await boundary.saveCloudDraft(draftInput(secondSheetId));
    assert.equal((await boundary.listCloudDrafts())[0].sheetId, secondSheetId);
    currentAccountId = firstAccountId;
    assert.equal((await boundary.listCloudDrafts())[0].sheetId, firstSheetId);

    const signedOutBoundary = new CloudDraftBoundary(
      { getAccount: async () => null },
      store
    );
    await assert.rejects(signedOutBoundary.listCloudDrafts(), /Sign in/);
  });

  test("tracks the full verified write and postpones quit until it settles", async () => {
    let resolveAccount: ((value: { id: string; email: string }) => void) | undefined;
    const account = new Promise<{ id: string; email: string }>((resolve) => {
      resolveAccount = resolve;
    });
    const storedDraft: CloudSheetDraft = {
      ...draftInput(firstSheetId),
      savedAt: savedAt.toISOString()
    };
    const store: CloudDraftStore = {
      deleteCloudDraft: async () => undefined,
      listCloudDrafts: async () => [],
      saveCloudDraft: async () => storedDraft
    };
    const boundary = new CloudDraftBoundary(
      { getAccount: async () => account },
      store
    );
    const save = boundary.saveCloudDraft(draftInput(firstSheetId));
    assert.equal(boundary.hasPendingWrites(), true);

    let prevented = 0;
    let quitCalls = 0;
    const beforeQuit = createCloudDraftBeforeQuitHandler(boundary, () => {
      quitCalls += 1;
    });
    beforeQuit({ preventDefault: () => (prevented += 1) });
    beforeQuit({ preventDefault: () => (prevented += 1) });
    assert.equal(prevented, 2);
    assert.equal(quitCalls, 0);

    resolveAccount?.({ id: firstAccountId, email: "verified@example.com" });
    await save;
    await boundary.waitForPendingWrites();
    await Promise.resolve();
    assert.equal(boundary.hasPendingWrites(), false);
    assert.equal(quitCalls, 1);

    beforeQuit({ preventDefault: () => (prevented += 1) });
    assert.equal(prevented, 2);
  });
});
