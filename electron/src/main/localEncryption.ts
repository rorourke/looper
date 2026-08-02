import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  mkdir,
  open
} from "node:fs/promises";
import { dirname } from "node:path";
import type { EncryptionProvider } from "./cloudAccount.ts";

const localEncryptionKeyBytes = 32;
const localEncryptionIvBytes = 12;
const localEncryptionTagBytes = 16;
const localEncryptionHeader = Buffer.from(
  "looper-local-aes-256-gcm-v1\0",
  "utf8"
);
const platformEncryptionProbeText = "looper-platform-encryption-probe-v1";

type LocalEncryptionFallbackOptions = {
  keyPath: string;
  platformEncryption: EncryptionProvider;
};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isLocalCiphertext(encrypted: Buffer): boolean {
  return (
    encrypted.byteLength >=
      localEncryptionHeader.byteLength +
        localEncryptionIvBytes +
        localEncryptionTagBytes &&
    encrypted.subarray(0, localEncryptionHeader.byteLength).equals(
      localEncryptionHeader
    )
  );
}

class LocalEncryptionKey {
  private keyPromise: Promise<Buffer> | undefined;

  constructor(private readonly keyPath: string) {}

  get = (): Promise<Buffer> => {
    this.keyPromise ??= this.readOrCreate();
    return this.keyPromise;
  };

  private async readOrCreate(): Promise<Buffer> {
    try {
      return await this.read();
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }

    await mkdir(dirname(this.keyPath), { mode: 0o700, recursive: true });
    const key = randomBytes(localEncryptionKeyBytes);
    let handle;
    try {
      handle = await open(
        this.keyPath,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600
      );
      await handle.writeFile(key);
      await handle.sync();
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      return this.read();
    } finally {
      await handle?.close();
    }
    await chmod(this.keyPath, 0o600);
    return key;
  }

  private async read(): Promise<Buffer> {
    const handle = await open(
      this.keyPath,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    try {
      const metadata = await handle.stat();
      const currentUid = process.getuid?.();
      if (
        !metadata.isFile() ||
        metadata.size !== localEncryptionKeyBytes ||
        (currentUid !== undefined && metadata.uid !== currentUid) ||
        (metadata.mode & 0o077) !== 0
      ) {
        throw new Error("Local encryption key permissions are invalid.");
      }
      const key = await handle.readFile();
      if (key.byteLength !== localEncryptionKeyBytes) {
        throw new Error("Local encryption key is invalid.");
      }
      return key;
    } finally {
      await handle.close();
    }
  }
}

export function createEncryptionProviderWithLocalKeyFallback(
  options: LocalEncryptionFallbackOptions
): EncryptionProvider {
  const localKey = new LocalEncryptionKey(options.keyPath);
  let platformWriteFailed = false;
  let platformReadinessPromise: Promise<boolean> | undefined;

  const platformEncryptionWorks = (): Promise<boolean> => {
    platformReadinessPromise ??= (async () => {
      if (platformWriteFailed) return false;
      try {
        if (
          !(await options.platformEncryption.isAsyncEncryptionAvailable())
        ) {
          platformWriteFailed = true;
          return false;
        }
        const encrypted = await options.platformEncryption.encryptStringAsync(
          platformEncryptionProbeText
        );
        const decrypted =
          await options.platformEncryption.decryptStringAsync(encrypted);
        if (decrypted.result !== platformEncryptionProbeText) {
          throw new Error("Platform encryption round trip failed.");
        }
        return true;
      } catch {
        platformWriteFailed = true;
        return false;
      }
    })();
    return platformReadinessPromise;
  };

  const encryptLocally = async (plainText: string): Promise<Buffer> => {
    const key = await localKey.get();
    const iv = randomBytes(localEncryptionIvBytes);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(localEncryptionHeader);
    const ciphertext = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final()
    ]);
    return Buffer.concat([
      localEncryptionHeader,
      iv,
      cipher.getAuthTag(),
      ciphertext
    ]);
  };

  const decryptLocally = async (encrypted: Buffer): Promise<string> => {
    if (!isLocalCiphertext(encrypted)) {
      throw new Error("Local encrypted data is invalid.");
    }
    const key = await localKey.get();
    const ivOffset = localEncryptionHeader.byteLength;
    const tagOffset = ivOffset + localEncryptionIvBytes;
    const ciphertextOffset = tagOffset + localEncryptionTagBytes;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      encrypted.subarray(ivOffset, tagOffset)
    );
    decipher.setAAD(localEncryptionHeader);
    decipher.setAuthTag(encrypted.subarray(tagOffset, ciphertextOffset));
    return Buffer.concat([
      decipher.update(encrypted.subarray(ciphertextOffset)),
      decipher.final()
    ]).toString("utf8");
  };

  return {
    decryptStringAsync: async (encrypted) => {
      if (isLocalCiphertext(encrypted)) {
        return {
          result: await decryptLocally(encrypted),
          shouldReEncrypt: false
        };
      }
      return options.platformEncryption.decryptStringAsync(encrypted);
    },
    encryptStringAsync: async (plainText) => {
      if (await platformEncryptionWorks()) {
        try {
          return await options.platformEncryption.encryptStringAsync(plainText);
        } catch {
          platformWriteFailed = true;
        }
      }
      return encryptLocally(plainText);
    },
    isAsyncEncryptionAvailable: async () => {
      if (await platformEncryptionWorks()) return true;
      await localKey.get();
      return true;
    }
  };
}
