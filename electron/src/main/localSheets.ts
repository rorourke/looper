import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  CLOUD_DOCUMENT_MAX_BYTES,
  CLOUD_SHEET_SCHEMA_VERSION,
  type JsonObject
} from "../shared/cloudAccount.ts";
import {
  isSheetStorageProvider,
  type CreateLocalSheetInput,
  type DeleteLocalSheetInput,
  type LocalSheet,
  type SheetStorageProvider,
  type SheetStorageSettings,
  type UpdateLocalSheetInput
} from "../shared/sheetStorage.ts";
import {
  CloudAccountError,
  normalizeDocument,
  normalizeRevision,
  normalizeTitle,
  normalizeUuid
} from "./cloudAccount.ts";

const localSheetFormatVersion = 1 as const;
const settingsFormatVersion = 1 as const;
const maximumLocalSheetCount = 10_000;
const maximumLocalSheetFileBytes = CLOUD_DOCUMENT_MAX_BYTES + 64 * 1024;
const localSheetExtension = ".loop";

type LocalSheetMetadata = {
  formatVersion: typeof localSheetFormatVersion;
  id: string;
  schemaVersion: typeof CLOUD_SHEET_SCHEMA_VERSION;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type StoredSettings = {
  version: typeof settingsFormatVersion;
  provider: SheetStorageProvider;
  localDirectoryPath?: string;
};

type LocalSheetStoreOptions = {
  directoryPath: string;
  now?: () => Date;
};

type SheetStorageSettingsStoreOptions = {
  filePath: string;
};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new CloudAccountError("A local sheet contains an invalid timestamp.");
  }
  return value;
}

function normalizeDirectoryPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    value.includes("\0") ||
    !isAbsolute(value)
  ) {
    throw new CloudAccountError("The local sheet folder is invalid.");
  }
  if (dirname(value) === value) {
    throw new CloudAccountError("Choose a folder inside the local filesystem.");
  }
  return value;
}

function normalizeMetadata(value: unknown): LocalSheetMetadata {
  if (!isRecord(value) || value.formatVersion !== localSheetFormatVersion) {
    throw new CloudAccountError("A local sheet contains invalid Looper metadata.");
  }
  if (value.schemaVersion !== CLOUD_SHEET_SCHEMA_VERSION) {
    throw new CloudAccountError("A local sheet uses an unsupported schema version.");
  }
  return {
    formatVersion: localSheetFormatVersion,
    id: normalizeUuid(value.id),
    schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
    revision: normalizeRevision(value.revision) as number,
    createdAt: normalizeTimestamp(value.createdAt),
    updatedAt: normalizeTimestamp(value.updatedAt)
  };
}

function publicDocument(value: Record<string, unknown>): JsonObject {
  const document = { ...value };
  delete document._looper;
  return normalizeDocument(document);
}

function storedPayload(sheet: Omit<LocalSheet, "path">): JsonObject {
  return {
    ...sheet.document,
    title: sheet.title,
    _looper: {
      formatVersion: localSheetFormatVersion,
      id: sheet.id,
      schemaVersion: sheet.schemaVersion,
      revision: sheet.revision,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt
    }
  };
}

function safeFileName(value: string): string {
  const safe = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\:]/g, "-")
    .replace(/^\.+$/, "")
    .trim()
    .slice(0, 96)
    .trim();
  return safe || "Untitled";
}

function normalizeCreateInput(value: unknown): CreateLocalSheetInput {
  if (!isRecord(value)) {
    throw new CloudAccountError("Local sheet data is invalid.");
  }
  return {
    id: normalizeUuid(value.id),
    title: normalizeTitle(value.title),
    document: normalizeDocument(value.document)
  };
}

function normalizeUpdateInput(value: unknown): UpdateLocalSheetInput {
  if (!isRecord(value)) {
    throw new CloudAccountError("Local sheet update is invalid.");
  }
  return {
    id: normalizeUuid(value.id),
    title: normalizeTitle(value.title),
    document: normalizeDocument(value.document),
    expectedRevision: normalizeRevision(value.expectedRevision) as number
  };
}

function normalizeDeleteInput(value: unknown): DeleteLocalSheetInput {
  if (!isRecord(value)) {
    throw new CloudAccountError("Local sheet deletion is invalid.");
  }
  return {
    id: normalizeUuid(value.id),
    expectedRevision: normalizeRevision(value.expectedRevision, false)
  };
}

export class SheetStorageSettingsStore {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: SheetStorageSettingsStoreOptions) {}

  getSettings = async (): Promise<SheetStorageSettings> => {
    await this.mutationQueue;
    let raw: string;
    try {
      raw = await readFile(this.options.filePath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { provider: "local" };
      }
      throw new CloudAccountError("Sheet storage settings could not be read.");
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        !isRecord(parsed) ||
        parsed.version !== settingsFormatVersion ||
        !isSheetStorageProvider(parsed.provider)
      ) {
        throw new Error();
      }
      return {
        provider: parsed.provider,
        ...(parsed.localDirectoryPath === undefined
          ? {}
          : { localDirectoryPath: normalizeDirectoryPath(parsed.localDirectoryPath) })
      };
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError("Sheet storage settings are damaged or unreadable.");
    }
  };

  setSettings = async (
    provider: SheetStorageProvider,
    localDirectoryPath?: string
  ): Promise<SheetStorageSettings> => {
    if (!isSheetStorageProvider(provider)) {
      throw new CloudAccountError("The selected sheet storage provider is invalid.");
    }
    const settings: SheetStorageSettings = {
      provider,
      ...(localDirectoryPath === undefined
        ? {}
        : { localDirectoryPath: normalizeDirectoryPath(localDirectoryPath) })
    };
    if (provider === "local" && !settings.localDirectoryPath) {
      throw new CloudAccountError("Choose a folder for local sheets.");
    }

    const current = this.mutationQueue.then(async () => {
      const stored: StoredSettings = {
        version: settingsFormatVersion,
        ...settings
      };
      const temporaryPath = `${this.options.filePath}.${process.pid}.tmp`;
      try {
        await mkdir(dirname(this.options.filePath), { mode: 0o700, recursive: true });
        await writeFile(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, {
          encoding: "utf8",
          mode: 0o600
        });
        await rename(temporaryPath, this.options.filePath);
      } catch {
        throw new CloudAccountError("Sheet storage settings could not be saved.");
      }
    });
    this.mutationQueue = current.catch(() => undefined);
    await current;
    return settings;
  };
}

export class LocalSheetStore {
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly options: LocalSheetStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  listSheets = async (): Promise<LocalSheet[]> =>
    this.queueOperation(async () => {
      const entries = await this.sheetEntries();
      const sheets: LocalSheet[] = [];
      const ids = new Set<string>();
      for (const entry of entries) {
        const sheet = await this.readSheet(join(this.options.directoryPath, entry.name));
        if (!sheet) continue;
        if (ids.has(sheet.id)) {
          throw new CloudAccountError(
            `The local sheet folder contains duplicate copies of ${sheet.id}.`
          );
        }
        ids.add(sheet.id);
        sheets.push(sheet);
      }
      return sheets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });

  createSheet = async (rawInput: unknown): Promise<LocalSheet> => {
    const input = normalizeCreateInput(rawInput);
    return this.queueOperation(async () => {
      const existing = await this.findSheet(input.id);
      if (existing) {
        throw new CloudAccountError("A local sheet with this ID already exists.");
      }
      const timestamp = normalizeTimestamp(this.now().toISOString());
      const sheet: Omit<LocalSheet, "path"> = {
        id: input.id,
        title: input.title,
        document: input.document,
        schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const fileName = `${safeFileName(input.title)}--${input.id}${localSheetExtension}`;
      const path = join(this.options.directoryPath, fileName);
      await this.writeSheet(path, sheet);
      return { ...sheet, path };
    });
  };

  updateSheet = async (rawInput: unknown): Promise<LocalSheet> => {
    const input = normalizeUpdateInput(rawInput);
    return this.queueOperation(async () => {
      const existing = await this.findSheet(input.id);
      if (!existing) throw new CloudAccountError("The local sheet was not found.");
      if (existing.revision !== input.expectedRevision) {
        throw new CloudAccountError(
          "The local sheet changed on disk. Reopen Looper before saving again."
        );
      }
      const next: Omit<LocalSheet, "path"> = {
        id: existing.id,
        title: input.title,
        document: input.document,
        schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
        revision: existing.revision + 1,
        createdAt: existing.createdAt,
        updatedAt: normalizeTimestamp(this.now().toISOString())
      };
      await this.writeSheet(existing.path, next);
      return { ...next, path: existing.path };
    });
  };

  deleteSheet = async (rawInput: unknown): Promise<void> => {
    const input = normalizeDeleteInput(rawInput);
    await this.queueOperation(async () => {
      const existing = await this.findSheet(input.id);
      if (!existing) return;
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== existing.revision
      ) {
        throw new CloudAccountError(
          "The local sheet changed on disk. Reopen Looper before deleting it."
        );
      }
      try {
        await unlink(existing.path);
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return;
        throw new CloudAccountError("The local sheet could not be deleted.");
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

  private async ensureDirectory(): Promise<void> {
    try {
      await mkdir(this.options.directoryPath, { mode: 0o700, recursive: true });
    } catch {
      throw new CloudAccountError("The local sheet folder could not be prepared.");
    }
  }

  private async sheetEntries(): Promise<Dirent[]> {
    await this.ensureDirectory();
    let entries: Dirent[];
    try {
      entries = await readdir(this.options.directoryPath, { withFileTypes: true });
    } catch {
      throw new CloudAccountError("The local sheet folder could not be read.");
    }
    const files = entries.filter(
      (entry) =>
        entry.isFile() && entry.name.toLocaleLowerCase().endsWith(localSheetExtension)
    );
    if (files.length > maximumLocalSheetCount) {
      throw new CloudAccountError("The local sheet folder contains too many files.");
    }
    return files;
  }

  private async findSheet(id: string): Promise<LocalSheet | undefined> {
    let match: LocalSheet | undefined;
    for (const entry of await this.sheetEntries()) {
      const sheet = await this.readSheet(join(this.options.directoryPath, entry.name));
      if (!sheet || sheet.id !== id) continue;
      if (match) {
        throw new CloudAccountError(`The local sheet folder contains duplicate copies of ${id}.`);
      }
      match = sheet;
    }
    return match;
  }

  private async readSheet(path: string): Promise<LocalSheet | undefined> {
    try {
      const metadata = await stat(path);
      if (!metadata.isFile() || metadata.size > maximumLocalSheetFileBytes) {
        return undefined;
      }
      const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
      if (!isRecord(parsed) || !Object.hasOwn(parsed, "_looper")) return undefined;
      const localMetadata = normalizeMetadata(parsed._looper);
      const document = publicDocument(parsed);
      const title = normalizeTitle(document.title);
      return {
        id: localMetadata.id,
        title,
        document,
        schemaVersion: localMetadata.schemaVersion,
        revision: localMetadata.revision,
        createdAt: localMetadata.createdAt,
        updatedAt: localMetadata.updatedAt,
        path
      };
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError(
        `${basename(path)} is damaged or is not a readable local Looper sheet.`
      );
    }
  }

  private async writeSheet(
    path: string,
    sheet: Omit<LocalSheet, "path">
  ): Promise<void> {
    await this.ensureDirectory();
    const temporaryPath = `${path}.${process.pid}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(storedPayload(sheet), null, 2)}\n`,
        {
          encoding: "utf8",
          mode: 0o600
        }
      );
      await rename(temporaryPath, path);
    } catch {
      throw new CloudAccountError("The local sheet could not be saved.");
    }
  }
}
