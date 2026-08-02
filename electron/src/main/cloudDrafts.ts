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
  CLOUD_SHEET_SCHEMA_VERSION,
  type AccountSummary,
  type CloudSheetDraft
} from "../shared/cloudAccount.ts";
import {
  CloudAccountError,
  normalizeDocument,
  normalizeRevision,
  normalizeTitle,
  normalizeUuid,
  type EncryptionProvider
} from "./cloudAccount.ts";

const draftFormatVersion = 1 as const;
const maximumDraftCountPerAccount = 10_000;
const maximumEncryptedDraftBytes = CLOUD_DOCUMENT_MAX_BYTES * 2 + 64 * 1024;
const draftFileNamePattern = /^[0-9a-f]{64}\.draft$/;

type StoredCloudSheetDraft = CloudSheetDraft & {
  formatVersion: typeof draftFormatVersion;
  ownerId: string;
};

type CloudDraftStoreOptions = {
  directoryPath: string;
  encryption: EncryptionProvider;
  now?: () => Date;
};

export type CloudDraftStore = {
  deleteCloudDraft: (ownerId: string, input: unknown) => Promise<void>;
  listCloudDrafts: (ownerId: string) => Promise<CloudSheetDraft[]>;
  saveCloudDraft: (ownerId: string, input: unknown) => Promise<CloudSheetDraft>;
};

export type CloudDraftAccountProvider = {
  getAccount: () => Promise<AccountSummary | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeSchemaVersion(value: unknown): typeof CLOUD_SHEET_SCHEMA_VERSION {
  if (value !== CLOUD_SHEET_SCHEMA_VERSION) {
    throw new CloudAccountError("This draft uses an unsupported schema version.");
  }
  return CLOUD_SHEET_SCHEMA_VERSION;
}

function normalizeSavedAt(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new CloudAccountError("Secure draft storage contains an invalid timestamp.");
  }
  return value;
}

function normalizeDraftInput(value: unknown): Omit<CloudSheetDraft, "savedAt"> {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cloud draft data is invalid.");
  }
  return {
    sheetId: normalizeUuid(value.sheetId),
    title: normalizeTitle(value.title),
    document: normalizeDocument(value.document),
    schemaVersion: normalizeSchemaVersion(value.schemaVersion),
    expectedRevision: normalizeRevision(value.expectedRevision) as number
  };
}

function normalizeDraftDeletion(value: unknown): string {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cloud draft deletion request is invalid.");
  }
  return normalizeUuid(value.sheetId);
}

function normalizeStoredDraft(value: unknown): StoredCloudSheetDraft {
  if (!isRecord(value) || value.formatVersion !== draftFormatVersion) {
    throw new CloudAccountError("Secure draft storage is damaged or unreadable.");
  }
  return {
    formatVersion: draftFormatVersion,
    ownerId: normalizeUuid(value.ownerId, "Account"),
    ...normalizeDraftInput(value),
    savedAt: normalizeSavedAt(value.savedAt)
  };
}

function publicDraft(value: StoredCloudSheetDraft): CloudSheetDraft {
  return {
    sheetId: value.sheetId,
    title: value.title,
    document: value.document,
    schemaVersion: value.schemaVersion,
    expectedRevision: value.expectedRevision,
    savedAt: value.savedAt
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export class EncryptedCloudDraftStore implements CloudDraftStore {
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly options: CloudDraftStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  listCloudDrafts = async (rawOwnerId: string): Promise<CloudSheetDraft[]> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    return this.queueOperation(async () => {
      await this.requireEncryption();
      const accountDirectory = this.accountDirectory(ownerId);
      let entries: Dirent[];
      try {
        entries = await readdir(accountDirectory, { withFileTypes: true });
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw new CloudAccountError("Secure drafts could not be read.");
      }

      const draftEntries = entries.filter(
        (entry) => entry.isFile() && draftFileNamePattern.test(entry.name)
      );
      if (draftEntries.length > maximumDraftCountPerAccount) {
        throw new CloudAccountError("Secure draft storage contains too many drafts.");
      }

      const drafts: CloudSheetDraft[] = [];
      for (const entry of draftEntries) {
        const stored = await this.readStoredDraft(join(accountDirectory, entry.name));
        if (
          stored.ownerId !== ownerId ||
          entry.name !== this.draftFileName(stored.sheetId)
        ) {
          throw new CloudAccountError("Secure draft storage is damaged or unreadable.");
        }
        drafts.push(publicDraft(stored));
      }
      return drafts.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    });
  };

  saveCloudDraft = async (
    rawOwnerId: string,
    rawInput: unknown
  ): Promise<CloudSheetDraft> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    const input = normalizeDraftInput(rawInput);
    return this.queueOperation(async () => {
      await this.requireEncryption();
      const savedAt = this.now().toISOString();
      normalizeSavedAt(savedAt);
      const stored: StoredCloudSheetDraft = {
        formatVersion: draftFormatVersion,
        ownerId,
        ...input,
        savedAt
      };
      const accountDirectory = await this.ensureAccountDirectory(ownerId);
      await this.writeStoredDraft(
        join(accountDirectory, this.draftFileName(input.sheetId)),
        stored
      );
      return publicDraft(stored);
    });
  };

  deleteCloudDraft = async (rawOwnerId: string, rawInput: unknown): Promise<void> => {
    const ownerId = normalizeUuid(rawOwnerId, "Account");
    const sheetId = normalizeDraftDeletion(rawInput);
    await this.queueOperation(async () => {
      await this.requireEncryption();
      try {
        await unlink(join(this.accountDirectory(ownerId), this.draftFileName(sheetId)));
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return;
        throw new CloudAccountError("Secure draft could not be deleted.");
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

  private draftFileName(sheetId: string): string {
    return `${digest(`sheet:${sheetId}`)}.draft`;
  }

  private async ensureAccountDirectory(ownerId: string): Promise<string> {
    const accountDirectory = this.accountDirectory(ownerId);
    try {
      await mkdir(accountDirectory, { mode: 0o700, recursive: true });
      await chmod(this.options.directoryPath, 0o700);
      await chmod(accountDirectory, 0o700);
      return accountDirectory;
    } catch {
      throw new CloudAccountError("Secure draft storage could not be prepared.");
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
      throw new CloudAccountError(
        "Secure draft storage is unavailable on this device."
      );
    }
  }

  private async readStoredDraft(filePath: string): Promise<StoredCloudSheetDraft> {
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile() || metadata.size > maximumEncryptedDraftBytes) {
        throw new Error("invalid draft file");
      }
      const encrypted = await readFile(filePath);
      const decrypted = await this.options.encryption.decryptStringAsync(encrypted);
      if (Buffer.byteLength(decrypted.result, "utf8") > maximumEncryptedDraftBytes) {
        throw new Error("invalid decrypted draft");
      }
      const stored = normalizeStoredDraft(JSON.parse(decrypted.result) as unknown);
      if (decrypted.shouldReEncrypt) {
        await this.writeStoredDraft(filePath, stored);
      }
      return stored;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError("Secure draft storage is damaged or unreadable.");
    }
  }

  private async writeStoredDraft(
    filePath: string,
    value: StoredCloudSheetDraft
  ): Promise<void> {
    const accountDirectory = dirname(filePath);
    const temporaryPath = join(
      accountDirectory,
      `.${process.pid}.${randomUUID()}.tmp`
    );
    let temporaryCreated = false;
    try {
      const plaintext = JSON.stringify(value);
      const encrypted = await this.options.encryption.encryptStringAsync(plaintext);
      if (encrypted.byteLength > maximumEncryptedDraftBytes) {
        throw new Error("encrypted draft is too large");
      }
      await writeFile(temporaryPath, encrypted, { flag: "wx", mode: 0o600 });
      temporaryCreated = true;
      await rename(temporaryPath, filePath);
      temporaryCreated = false;
    } catch {
      if (temporaryCreated) {
        await unlink(temporaryPath).catch(() => undefined);
      }
      throw new CloudAccountError("Secure draft could not be saved.");
    }
  }
}

export class CloudDraftBoundary {
  private readonly pendingWrites = new Set<Promise<unknown>>();

  constructor(
    private readonly accountProvider: CloudDraftAccountProvider,
    private readonly store: CloudDraftStore
  ) {}

  async listCloudDrafts(): Promise<CloudSheetDraft[]> {
    const ownerId = await this.currentOwnerId();
    return this.store.listCloudDrafts(ownerId);
  }

  saveCloudDraft(rawInput: unknown): Promise<CloudSheetDraft> {
    return this.trackWrite(async () => {
      const ownerId = await this.currentOwnerId();
      return this.store.saveCloudDraft(ownerId, rawInput);
    });
  }

  deleteCloudDraft(rawInput: unknown): Promise<void> {
    return this.trackWrite(async () => {
      const ownerId = await this.currentOwnerId();
      await this.store.deleteCloudDraft(ownerId, rawInput);
    });
  }

  hasPendingWrites(): boolean {
    return this.pendingWrites.size > 0;
  }

  async waitForPendingWrites(): Promise<void> {
    while (this.pendingWrites.size > 0) {
      await Promise.allSettled([...this.pendingWrites]);
    }
  }

  private async currentOwnerId(): Promise<string> {
    const account = await this.accountProvider.getAccount();
    if (!account) {
      throw new CloudAccountError("Sign in to access your saved cloud drafts.");
    }
    return normalizeUuid(account.id, "Account");
  }

  private trackWrite<T>(operation: () => Promise<T>): Promise<T> {
    const current = Promise.resolve().then(operation);
    this.pendingWrites.add(current);
    void current.then(
      () => this.pendingWrites.delete(current),
      () => this.pendingWrites.delete(current)
    );
    return current;
  }
}

type BeforeQuitEvent = {
  preventDefault: () => void;
};

export function createCloudDraftBeforeQuitHandler(
  drafts: Pick<CloudDraftBoundary, "hasPendingWrites" | "waitForPendingWrites">,
  quit: () => void
): (event: BeforeQuitEvent) => void {
  let quitAllowed = false;
  let draining = false;

  return (event) => {
    if (quitAllowed || !drafts.hasPendingWrites()) return;
    event.preventDefault();
    if (draining) return;
    draining = true;
    void drafts.waitForPendingWrites().then(() => {
      quitAllowed = true;
      quit();
    });
  };
}
