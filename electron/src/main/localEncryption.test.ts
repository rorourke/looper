import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { EncryptionProvider } from "./cloudAccount.ts";
import { createEncryptionProviderWithLocalKeyFallback } from "./localEncryption.ts";

function unavailablePlatformEncryption(): EncryptionProvider {
  return {
    decryptStringAsync: async () => {
      throw new Error("Keychain authorization failed");
    },
    encryptStringAsync: async () => {
      throw new Error("Keychain authorization failed");
    },
    isAsyncEncryptionAvailable: async () => true
  };
}

describe("local development encryption fallback", () => {
  test("persists owner-private AES-GCM data across app instances", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-local-encryption-"));
    const keyPath = join(directory, ".key");
    try {
      const first = createEncryptionProviderWithLocalKeyFallback({
        keyPath,
        platformEncryption: unavailablePlatformEncryption()
      });
      const encrypted = await first.encryptStringAsync("refresh-token-secret");
      assert.equal(
        encrypted.toString("utf8").includes("refresh-token-secret"),
        false
      );

      const second = createEncryptionProviderWithLocalKeyFallback({
        keyPath,
        platformEncryption: unavailablePlatformEncryption()
      });
      assert.deepEqual(await second.decryptStringAsync(encrypted), {
        result: "refresh-token-secret",
        shouldReEncrypt: false
      });

      const key = await readFile(keyPath);
      const metadata = await stat(keyPath);
      assert.equal(key.byteLength, 32);
      assert.equal(metadata.mode & 0o077, 0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("keeps using platform encryption when Keychain works", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-local-encryption-"));
    const keyPath = join(directory, ".key");
    const platformEncryption: EncryptionProvider = {
      decryptStringAsync: async (encrypted) => ({
        result: encrypted.toString("utf8").slice("platform:".length),
        shouldReEncrypt: false
      }),
      encryptStringAsync: async (plainText) =>
        Buffer.from(`platform:${plainText}`, "utf8"),
      isAsyncEncryptionAvailable: async () => true
    };
    try {
      const encryption = createEncryptionProviderWithLocalKeyFallback({
        keyPath,
        platformEncryption
      });
      const encrypted = await encryption.encryptStringAsync("secret");
      assert.equal(encrypted.toString("utf8"), "platform:secret");
      assert.equal(
        (await encryption.decryptStringAsync(encrypted)).result,
        "secret"
      );
      await assert.rejects(readFile(keyPath), { code: "ENOENT" });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("rejects a fallback key that is accessible to other users", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-local-encryption-"));
    const keyPath = join(directory, ".key");
    try {
      await writeFile(keyPath, Buffer.alloc(32), { mode: 0o644 });
      const encryption = createEncryptionProviderWithLocalKeyFallback({
        keyPath,
        platformEncryption: unavailablePlatformEncryption()
      });
      await assert.rejects(
        encryption.encryptStringAsync("secret"),
        /permissions are invalid/
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
