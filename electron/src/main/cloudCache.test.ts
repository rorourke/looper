import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CloudSheet } from "../shared/cloudAccount.ts";
import type { EncryptionProvider } from "./cloudAccount.ts";
import {
  CloudSheetCacheBoundary,
  EncryptedCloudSheetCacheStore
} from "./cloudCache.ts";

const accountId = "11111111-1111-4111-8111-111111111111";
const otherAccountId = "22222222-2222-4222-8222-222222222222";
const firstSheetId = "33333333-3333-4333-8333-333333333333";
const secondSheetId = "44444444-4444-4444-8444-444444444444";

function testEncryption(): EncryptionProvider {
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
    isAsyncEncryptionAvailable: async () => true
  };
}

function sheet(id: string, revision = 1): CloudSheet {
  return {
    id,
    clientCreatedId: id,
    title: revision === 1 ? "Budget" : "Updated budget",
    document: { text: `rent = ${revision * 2_000}` },
    shareEnabled: false,
    schemaVersion: 1,
    revision,
    createdAt: "2026-07-23T10:00:00.000Z",
    updatedAt: `2026-07-23T10:0${revision}:00.000Z`
  };
}

describe("encrypted offline cloud sheet cache", () => {
  test("keeps account-scoped snapshots and replaces stale sheets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-cache-"));
    const store = new EncryptedCloudSheetCacheStore({
      directoryPath: join(directory, "cache"),
      encryption: testEncryption()
    });

    try {
      await store.replaceCachedCloudSheets(accountId, [
        sheet(firstSheetId),
        sheet(secondSheetId)
      ]);
      await store.replaceCachedCloudSheets(otherAccountId, [sheet(secondSheetId)]);
      await store.cacheCloudSheet(accountId, sheet(firstSheetId, 2));

      assert.deepEqual(await store.listCachedCloudSheets(accountId), [
        sheet(firstSheetId, 2),
        sheet(secondSheetId)
      ]);
      assert.deepEqual(await store.listCachedCloudSheets(otherAccountId), [
        sheet(secondSheetId)
      ]);

      await store.replaceCachedCloudSheets(accountId, [sheet(firstSheetId, 2)]);
      assert.deepEqual(await store.listCachedCloudSheets(accountId), [
        sheet(firstSheetId, 2)
      ]);

      const accountDirectories = await readdir(join(directory, "cache"));
      assert.equal(accountDirectories.length, 2);
      const encryptedPayloads: string[] = [];
      for (const accountDirectory of accountDirectories) {
        for (const fileName of await readdir(
          join(directory, "cache", accountDirectory)
        )) {
          assert.match(fileName, /^[0-9a-f]{64}\.sheet$/);
          encryptedPayloads.push(
            await readFile(
              join(directory, "cache", accountDirectory, fileName),
              "utf8"
            )
          );
        }
      }
      const rawStorage = encryptedPayloads.join("\n");
      assert.equal(rawStorage.includes("rent ="), false);
      assert.equal(rawStorage.includes(accountId), false);
      assert.equal(rawStorage.includes(firstSheetId), false);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("requires an account at the renderer boundary", async () => {
    const boundary = new CloudSheetCacheBoundary(
      { getAccount: async () => null },
      {
        cacheCloudSheet: async () => {},
        clearCloudSheetCache: async () => {},
        deleteCachedCloudSheet: async () => {},
        listCachedCloudSheets: async () => [],
        replaceCachedCloudSheets: async () => {}
      }
    );

    await assert.rejects(
      boundary.listCachedCloudSheets(),
      /Sign in to access cached cloud sheets/
    );
  });
});
