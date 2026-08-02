import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, join } from "node:path";
import {
  CLOUD_DOCUMENT_MAX_BYTES,
  type AccountSummary,
  type CloudSheet
} from "../shared/cloudAccount.ts";
import {
  CloudAccountError,
  normalizeCloudSheet,
  normalizeUuid,
  type EncryptionProvider
} from "./cloudAccount.ts";

const cacheFormatVersion = 1 as const;
const maximumCachedSheetCountPerAccount = 10_000;
const maximumEncryptedCacheBytes = CLOUD_DOCUMENT_MAX_BYTES * 2 + 64 * 1024;
const cacheFileNamePattern = /^[0-9a-f]{64}\.sheet$/;

type StoredCloudSheet = {
  formatVersion: typeof cacheFormatVersion;
  ownerId: string;
  sheet: CloudSheet;
};

type CloudSheetCacheStoreOptions = {
  directoryPath: string;
  encryption: EncryptionProvider;
};

export type CloudSheetCacheStore = {
  cacheCloudSheet: (ownerId: string, value: unknown) => Promise<void>;
  clearCloudSheetCache: (ownerId: string) => Promise<void>;
  deleteCachedCloudSheet: (ownerId: string, input: unknown) => Promise<void>;
  listCachedCloudSheets: (ownerId: string) => Promise<CloudSheet[]>;
  replaceCachedCloudSheets: (ownerId: string, values: unknown) => Promise<void>;
};

export type CloudSheetCacheAccountProvider = {
  getAccount: () => Promise<AccountSummary | null>;
};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeCachedSheetDeletion(value: unknown): string {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cached sheet deletion request is invalid.");
  }
  return normalizeUuid(value.sheetId);
}

function normalizeCachedSheets(value: unknown): CloudSheet[] {
  if (!Array.isArray(value) || value.length > maximumCachedSheetCountPerAccount) {
    throw new CloudAccountError("Cloud sheet cache contains too many sheets.");
  }
  const sheets = value.map(normalizeCloudSheet);
  if (new Set(sheets.map((sheet) => sheet.id)).size !== sheets.length) {
    throw new CloudAccountError("Cloud sheet cache contains duplicate sheets.");
  }
  return sheets;
}

function normalizeStoredSheet(value: unknown): StoredCloudSheet {
  if (!isRecord(value) || value.formatVersion !== cacheFormatVersion) {
    throw new CloudAccountError("Cloud sheet cache is damaged or unreadable.");
  }
  return {
    formatVersion: cacheFormatVersion,
    ownerId: normalizeUuid(value.ownerId, "Account"),
    sheet: normalizeCloudSheet(value.sheet)
  };
}

export class EncryptedCloudSheetCacheStore implements CloudSheetCacheStore {
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: CloudSheetCacheStoreOptions) {}

  listCachedCloudSheets = async (rawOwnerId: string): Promise<CloudSheet[]> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    return this.queueOperation(async () => {
      await this.requireEncryption();
      const entries = await this.cacheEntries(ownerId);
      const sheets: CloudSheet[] = [];
      for (const entry of entries) {
        const stored = await this.readStoredSheet(
          join(this.accountDirectory(ownerId), entry.name)
        );
        if (
          stored.ownerId !== ownerId ||
          entry.name !== this.cacheFileName(stored.sheet.id)
        ) {
          throw new CloudAccountError("Cloud sheet cache is damaged or unreadable.");
        }
        sheets.push(stored.sheet);
      }
      return sheets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  };

  cacheCloudSheet = async (
    rawOwnerId: string,
    rawValue: unknown
  ): Promise<void> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    const sheet = normalizeCloudSheet(rawValue);
    await this.queueOperation(async () => {
      await this.requireEncryption();
      const accountDirectory = await this.ensureAccountDirectory(ownerId);
      const existing = await this.cacheEntries(ownerId);
      if (
        !existing.some((entry) => entry.name === this.cacheFileName(sheet.id)) &&
        existing.length >= maximumCachedSheetCountPerAccount
      ) {
        throw new CloudAccountError("Cloud sheet cache has reached its limit.");
      }
      await this.writeStoredSheet(
        join(accountDirectory, this.cacheFileName(sheet.id)),
        { formatVersion: cacheFormatVersion, ownerId, sheet }
      );
    });
  };

  replaceCachedCloudSheets = async (
    rawOwnerId: string,
    rawValues: unknown
  ): Promise<void> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    const sheets = normalizeCachedSheets(rawValues);
    await this.queueOperation(async () => {
      await this.requireEncryption();
      const accountDirectory = await this.ensureAccountDirectory(ownerId);
      const retainedNames = new Set<string>();
      for (const sheet of sheets) {
        const fileName = this.cacheFileName(sheet.id);
        retainedNames.add(fileName);
        await this.writeStoredSheet(join(accountDirectory, fileName), {
          formatVersion: cacheFormatVersion,
          ownerId,
          sheet
        });
      }
      for (const entry of await this.cacheEntries(ownerId)) {
        if (!retainedNames.has(entry.name)) {
          await unlink(join(accountDirectory, entry.name));
        }
      }
    });
  };

  deleteCachedCloudSheet = async (
    rawOwnerId: string,
    rawInput: unknown
  ): Promise<void> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    const sheetId = normalizeCachedSheetDeletion(rawInput);
    await this.queueOperation(async () => {
      await this.requireEncryption();
      try {
        await unlink(join(this.accountDirectory(ownerId), this.cacheFileName(sheetId)));
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return;
        throw new CloudAccountError("Cached cloud sheet could not be deleted.");
      }
    });
  };

  clearCloudSheetCache = async (rawOwnerId: string): Promise<void> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    await this.queueOperation(async () => {
      await this.requireEncryption();
      const accountDirectory = this.accountDirectory(ownerId);
      for (const entry of await this.cacheEntries(ownerId)) {
        await unlink(join(accountDirectory, entry.name));
      }
    });
  };

  private queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.operationQueue.then(operation);
    this.operationQueue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  }

  private accountDirectory(ownerId: string): string {
    return join(this.options.directoryPath, digest(`account:${ownerId}`));
  }

  private cacheFileName(sheetId: string): string {
    return `${digest(`sheet:${sheetId}`)}.sheet`;
  }

  private async cacheEntries(ownerId: string): Promise<Dirent[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.accountDirectory(ownerId), {
        withFileTypes: true
      });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      throw new CloudAccountError("Cloud sheet cache could not be read.");
    }
    const cacheEntries = entries.filter(
      (entry) => entry.isFile() && cacheFileNamePattern.test(entry.name)
    );
    if (cacheEntries.length > maximumCachedSheetCountPerAccount) {
      throw new CloudAccountError("Cloud sheet cache contains too many sheets.");
    }
    return cacheEntries;
  }

  private async ensureAccountDirectory(ownerId: string): Promise<string> {
    const accountDirectory = this.accountDirectory(ownerId);
    try {
      await mkdir(accountDirectory, { mode: 0o700, recursive: true });
      await chmod(this.options.directoryPath, 0o700);
      await chmod(accountDirectory, 0o700);
      return accountDirectory;
    } catch {
      throw new CloudAccountError("Cloud sheet cache could not be prepared.");
    }
  }

  private async requireEncryption(): Promise<void> {
    let available = false;
    try {
      available = await this.options.encryption.isAsyncEncryptionAvailable();
    } catch {
      available = false;
    }
    if (!available) {
      throw new CloudAccountError("Secure cloud sheet cache is unavailable.");
    }
  }

  private async readStoredSheet(filePath: string): Promise<StoredCloudSheet> {
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile() || metadata.size > maximumEncryptedCacheBytes) {
        throw new Error("invalid cached sheet file");
      }
      const encrypted = await readFile(filePath);
      const decrypted = await this.options.encryption.decryptStringAsync(encrypted);
      if (Buffer.byteLength(decrypted.result, "utf8") > maximumEncryptedCacheBytes) {
        throw new Error("invalid decrypted cached sheet");
      }
      const stored = normalizeStoredSheet(JSON.parse(decrypted.result) as unknown);
      if (decrypted.shouldReEncrypt) {
        await this.writeStoredSheet(filePath, stored);
      }
      return stored;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError("Cloud sheet cache is damaged or unreadable.");
    }
  }

  private async writeStoredSheet(
    filePath: string,
    value: StoredCloudSheet
  ): Promise<void> {
    const accountDirectory = dirname(filePath);
    const temporaryPath = join(
      accountDirectory,
      `.${process.pid}.${randomUUID()}.tmp`
    );
    let temporaryCreated = false;
    try {
      const encrypted = await this.options.encryption.encryptStringAsync(
        JSON.stringify(value)
      );
      if (encrypted.byteLength > maximumEncryptedCacheBytes) {
        throw new Error("encrypted cached sheet is too large");
      }
      await writeFile(temporaryPath, encrypted, { flag: "wx", mode: 0o600 });
      temporaryCreated = true;
      await rename(temporaryPath, filePath);
      temporaryCreated = false;
    } catch {
      if (temporaryCreated) {
        await unlink(temporaryPath).catch(() => undefined);
      }
      throw new CloudAccountError("Cloud sheet cache could not be saved.");
    }
  }
}

export class CloudSheetCacheBoundary {
  constructor(
    private readonly accountProvider: CloudSheetCacheAccountProvider,
    private readonly store: CloudSheetCacheStore
  ) {}

  async listCachedCloudSheets(): Promise<CloudSheet[]> {
    return this.store.listCachedCloudSheets(await this.currentOwnerId());
  }

  async cacheCloudSheet(rawValue: unknown): Promise<void> {
    await this.store.cacheCloudSheet(await this.currentOwnerId(), rawValue);
  }

  async replaceCachedCloudSheets(rawValues: unknown): Promise<void> {
    await this.store.replaceCachedCloudSheets(
      await this.currentOwnerId(),
      rawValues
    );
  }

  async deleteCachedCloudSheet(rawInput: unknown): Promise<void> {
    await this.store.deleteCachedCloudSheet(
      await this.currentOwnerId(),
      rawInput
    );
  }

  async clearForOwner(ownerId: string): Promise<void> {
    await this.store.clearCloudSheetCache(ownerId);
  }

  private async currentOwnerId(): Promise<string> {
    const account = await this.accountProvider.getAccount();
    if (!account) {
      throw new CloudAccountError("Sign in to access cached cloud sheets.");
    }
    return normalizeUuid(account.id, "Account");
  }
}
