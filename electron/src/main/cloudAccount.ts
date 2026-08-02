import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  CLOUD_DOCUMENT_MAX_BYTES,
  CLOUD_SHEET_SCHEMA_VERSION,
  type AccountSummary,
  type CloudConfiguration,
  type CloudSheet,
  type CloudSheetMetadata,
  type JsonObject,
  type JsonValue
} from "../shared/cloudAccount.ts";
import {
  isSheetPackProduct,
  type BillingStatus,
  type SheetPackProduct
} from "../shared/billing.ts";
import {
  type AdminAccessStatus,
  type AdminMfaPreparation,
  adminOverviewMaximumResponseBytes,
  normalizeAdminMfaCode,
  normalizeAdminMfaPreparation,
  normalizeAdminPage,
  normalizeAdminOverview,
  type AdminOverview
} from "../shared/admin.ts";
import { accountDeletionConfirmation } from "../shared/product.ts";

const authStorageMaximumValueBytes = 2 * 1024 * 1024;
const offlineAccountStorageKey = "looper-offline-account-v1";
const apiResponseMaximumBytes = 4 * 1024 * 1024;
const apiRequestTimeoutMs = 15_000;
const cloudSheetBatchSize = 3;
const cloudSheetDetailConcurrency = 6;
const cloudSheetPageSize = 100;
const maximumCloudSheetCount = 10_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shareTokenPattern = /^[0-9a-f]{64}$/;

export class CloudAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudAccountError";
  }
}

class StoredAuthSessionError extends CloudAccountError {
  constructor(message: string) {
    super(message);
    this.name = "StoredAuthSessionError";
  }
}

class CloudApiResponseError extends CloudAccountError {
  constructor(
    readonly status: number,
    message: string,
    readonly apiCode?: string
  ) {
    super(message);
    this.name = "CloudApiResponseError";
  }
}

export type AsyncAuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  isAvailable?: () => boolean | Promise<boolean>;
};

export type EncryptionProvider = {
  decryptStringAsync: (encrypted: Buffer) => Promise<{
    result: string;
    shouldReEncrypt: boolean;
  }>;
  encryptStringAsync: (plainText: string) => Promise<Buffer>;
  isAsyncEncryptionAvailable: () => Promise<boolean>;
};

type SynchronousEncryptionProvider = {
  decryptString: (encrypted: Buffer) => string;
  encryptString: (plainText: string) => Buffer;
  isEncryptionAvailable: () => boolean;
};

type EncryptedAuthStorageOptions = {
  encryption: EncryptionProvider;
  filePath: string;
};

type EncryptedStorageFile = {
  version: 1;
  entries: Record<string, string>;
};

function storageKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    value.includes("\0")
  ) {
    throw new CloudAccountError("Secure account storage received an invalid key.");
  }
  return value;
}

function storageValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > authStorageMaximumValueBytes
  ) {
    throw new CloudAccountError("Secure account storage received an invalid value.");
  }
  return value;
}

class EncryptedAuthStorage implements AsyncAuthStorage {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: EncryptedAuthStorageOptions) {}

  isAvailable = (): Promise<boolean> =>
    this.options.encryption.isAsyncEncryptionAvailable();

  getItem = async (rawKey: string): Promise<string | null> => {
    const key = storageKey(rawKey);
    await this.requireEncryption();
    await this.mutationQueue;
    const entries = await this.readEntries();
    const encrypted = Object.prototype.hasOwnProperty.call(entries, key)
      ? entries[key]
      : undefined;
    if (encrypted === undefined) return null;

    try {
      const decrypted = await this.options.encryption.decryptStringAsync(
        Buffer.from(encrypted, "base64")
      );
      const value = storageValue(decrypted.result);
      if (decrypted.shouldReEncrypt) await this.setItem(key, value);
      return value;
    } catch {
      // An ad-hoc/re-signed Mac build can lose access to the key that encrypted
      // an older Supabase session. Treat that one entry as signed out so the
      // stale token cannot prevent a fresh email-code request.
      await this.queueMutation(async () => {
        const entries = await this.readEntries();
        if (entries[key] !== encrypted) return;
        delete entries[key];
        await this.writeEntries(entries);
      }).catch(() => undefined);
      return null;
    }
  };

  setItem = async (rawKey: string, rawValue: string): Promise<void> => {
    const key = storageKey(rawKey);
    const value = storageValue(rawValue);
    await this.requireEncryption();
    await this.queueMutation(async () => {
      const entries = await this.readEntries();
      entries[key] = (
        await this.options.encryption.encryptStringAsync(value)
      ).toString("base64");
      await this.writeEntries(entries);
    });
  };

  removeItem = async (rawKey: string): Promise<void> => {
    const key = storageKey(rawKey);
    await this.requireEncryption();
    await this.queueMutation(async () => {
      const entries = await this.readEntries();
      if (!Object.prototype.hasOwnProperty.call(entries, key)) return;
      delete entries[key];
      await this.writeEntries(entries);
    });
  };

  private async requireEncryption(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new CloudAccountError(
        "Secure account storage is unavailable on this device."
      );
    }
  }

  private async queueMutation(operation: () => Promise<void>): Promise<void> {
    const current = this.mutationQueue.then(operation);
    this.mutationQueue = current.catch(() => undefined);
    await current;
  }

  private async readEntries(): Promise<Record<string, string>> {
    let raw: string;
    try {
      raw = await readFile(this.options.filePath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return Object.create(null);
      throw new CloudAccountError("Secure account storage could not be read.");
    }

    try {
      const parsed = JSON.parse(raw) as Partial<EncryptedStorageFile>;
      if (parsed.version !== 1 || !isRecord(parsed.entries)) throw new Error();
      const entries: Record<string, string> = Object.create(null);
      for (const [key, value] of Object.entries(parsed.entries)) {
        storageKey(key);
        if (typeof value !== "string" || value.length > authStorageMaximumValueBytes * 2) {
          throw new Error();
        }
        entries[key] = value;
      }
      return entries;
    } catch {
      throw new CloudAccountError("Secure account storage is damaged or unreadable.");
    }
  }

  private async writeEntries(entries: Record<string, string>): Promise<void> {
    const payload: EncryptedStorageFile = { entries, version: 1 };
    const temporaryPath = `${this.options.filePath}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(this.options.filePath), { mode: 0o700, recursive: true });
      await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(temporaryPath, this.options.filePath);
    } catch {
      throw new CloudAccountError("Secure account storage could not be saved.");
    }
  }
}

export function createEncryptedAuthStorage(
  options: EncryptedAuthStorageOptions
): AsyncAuthStorage {
  return new EncryptedAuthStorage(options);
}

export function createEncryptionProviderWithSynchronousFallback(
  encryption: EncryptionProvider & SynchronousEncryptionProvider
): EncryptionProvider {
  const isAsyncAvailable = async (): Promise<boolean> => {
    try {
      return await encryption.isAsyncEncryptionAvailable();
    } catch {
      return false;
    }
  };
  const isSynchronousAvailable = (): boolean => {
    try {
      return encryption.isEncryptionAvailable();
    } catch {
      return false;
    }
  };

  return {
    decryptStringAsync: async (encrypted) => {
      let asyncError: unknown;
      if (await isAsyncAvailable()) {
        try {
          return await encryption.decryptStringAsync(encrypted);
        } catch (error) {
          asyncError = error;
        }
      }
      if (isSynchronousAvailable()) {
        try {
          return {
            result: encryption.decryptString(encrypted),
            shouldReEncrypt: false
          };
        } catch (error) {
          if (asyncError === undefined) asyncError = error;
        }
      }
      throw asyncError ?? new Error("Platform encryption is unavailable.");
    },
    encryptStringAsync: async (plainText) => {
      let asyncError: unknown;
      if (await isAsyncAvailable()) {
        try {
          return await encryption.encryptStringAsync(plainText);
        } catch (error) {
          asyncError = error;
        }
      }
      if (isSynchronousAvailable()) {
        try {
          return encryption.encryptString(plainText);
        } catch (error) {
          if (asyncError === undefined) asyncError = error;
        }
      }
      throw asyncError ?? new Error("Platform encryption is unavailable.");
    },
    isAsyncEncryptionAvailable: async () =>
      (await isAsyncAvailable()) || isSynchronousAvailable()
  };
}

export function createAuthStorageWithEphemeralFallback(
  options: EncryptedAuthStorageOptions
): AsyncAuthStorage {
  const encryptedStorage = createEncryptedAuthStorage(options);
  const ephemeralEntries = new Map<string, string>();
  let useEphemeralStorage = false;

  return {
    getItem: async (rawKey) => {
      const key = storageKey(rawKey);
      if (useEphemeralStorage) return ephemeralEntries.get(key) ?? null;
      try {
        return await encryptedStorage.getItem(key);
      } catch {
        useEphemeralStorage = true;
        return ephemeralEntries.get(key) ?? null;
      }
    },
    isAvailable: () => true,
    removeItem: async (rawKey) => {
      const key = storageKey(rawKey);
      ephemeralEntries.delete(key);
      if (useEphemeralStorage) {
        await encryptedStorage.removeItem(key).catch(() => undefined);
        return;
      }
      try {
        await encryptedStorage.removeItem(key);
      } catch {
        useEphemeralStorage = true;
      }
    },
    setItem: async (rawKey, rawValue) => {
      const key = storageKey(rawKey);
      const value = storageValue(rawValue);
      if (useEphemeralStorage) {
        ephemeralEntries.set(key, value);
        return;
      }
      try {
        await encryptedStorage.setItem(key, value);
        ephemeralEntries.delete(key);
      } catch {
        // Unsigned/ad-hoc Mac builds may be denied access to the Keychain even
        // when safeStorage initially reports itself available. Keep the
        // session in process memory so PKCE/OTP can complete without ever
        // writing plaintext credentials to disk.
        useEphemeralStorage = true;
        ephemeralEntries.set(key, value);
      }
    }
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTerminalAuthError(error: unknown): boolean {
  if (!isRecord(error) || typeof error.name !== "string") return false;
  return error.name.startsWith("Auth") && error.name !== "AuthRetryableFetchError";
}

function emailCodeRequestError(error: unknown): CloudAccountError {
  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : "";
    const status = Number(error.status);
    if (status === 429 || code === "over_email_send_rate_limit") {
      return new CloudAccountError(
        "Too many sign-in codes were requested. Wait a minute and try again."
      );
    }
    if (error.name === "AuthRetryableFetchError") {
      return new CloudAccountError(
        "Could not reach the account service. Check your connection and try again."
      );
    }
  }
  return new CloudAccountError("Could not send a sign-in code. Please try again.");
}

function normalizeBillingStatus(value: unknown): BillingStatus {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cloud returned an invalid billing status.");
  }
  const sheetCount = Number(value.sheetCount);
  const sheetLimit = Number(value.sheetLimit);
  const unusedSheetCount = Number(value.unusedSheetCount);
  if (
    typeof value.billingConfigured !== "boolean" ||
    typeof value.canCreateSheet !== "boolean" ||
    typeof value.canPurchaseSheets !== "boolean" ||
    !Number.isSafeInteger(sheetCount) ||
    sheetCount < 0 ||
    !Number.isSafeInteger(sheetLimit) ||
    sheetLimit < sheetCount ||
    !Number.isSafeInteger(unusedSheetCount) ||
    unusedSheetCount !== sheetLimit - sheetCount
  ) {
    throw new CloudAccountError("Cloud returned an invalid billing status.");
  }
  return {
    billingConfigured: value.billingConfigured,
    canCreateSheet: value.canCreateSheet,
    canPurchaseSheets: value.canPurchaseSheets,
    sheetCount,
    sheetLimit,
    unusedSheetCount
  };
}

function normalizeStripeUrl(value: unknown, expectedHost: string): string {
  if (typeof value !== "string" || value.length > 4_096) {
    throw new CloudAccountError("Billing returned an invalid secure URL.");
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== expectedHost ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new CloudAccountError("Billing returned an invalid secure URL.");
  }
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new CloudAccountError("Enter a valid email address.");
  }
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\s\u0000-\u001f\u007f]/.test(email)) {
    throw new CloudAccountError("Enter a valid email address.");
  }

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== email.indexOf("@")) {
    throw new CloudAccountError("Enter a valid email address.");
  }
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart) ||
    domain.length === 0 ||
    domain.length > 253
  ) {
    throw new CloudAccountError("Enter a valid email address.");
  }

  const domainLabels = domain.split(".");
  if (
    domainLabels.length < 2 ||
    domainLabels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[a-z0-9-]+$/.test(label)
    )
  ) {
    throw new CloudAccountError("Enter a valid email address.");
  }
  return email;
}

function normalizeOtp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) {
    throw new CloudAccountError("Enter the six-digit code from your email.");
  }
  return value.trim();
}

export function normalizeUuid(value: unknown, label = "Sheet"): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new CloudAccountError(`${label} ID is invalid.`);
  }
  return value.toLowerCase();
}

export function normalizeShareToken(value: unknown): string {
  if (typeof value !== "string" || !shareTokenPattern.test(value)) {
    throw new CloudAccountError("Shareable sheet URL is invalid.");
  }
  return value;
}

function normalizeShareEnabled(value: unknown, label = "Cloud sharing setting"): boolean {
  if (typeof value !== "boolean") {
    throw new CloudAccountError(`${label} is invalid.`);
  }
  return value;
}

function normalizeCloudSharing(value: Record<string, unknown>): {
  shareEnabled: boolean;
  shareToken?: string;
} {
  const hasShareEnabled = Object.hasOwn(value, "shareEnabled");
  const hasShareToken = Object.hasOwn(value, "shareToken");
  if (!hasShareEnabled && !hasShareToken) {
    // Desktop releases can temporarily run ahead of the hosted API during a
    // rolling deployment. Legacy rows remain usable, but sharing remains
    // unavailable until the server returns a real capability token.
    return { shareEnabled: false };
  }
  if (
    hasShareEnabled &&
    !hasShareToken &&
    value.shareEnabled === false
  ) {
    // This is the normalized representation of a legacy response. Accepting it
    // keeps local cache validation idempotent without enabling a capability.
    return { shareEnabled: false };
  }
  if (!hasShareEnabled || !hasShareToken) {
    throw new CloudAccountError("Cloud sharing setting is invalid.");
  }
  return {
    shareEnabled: normalizeShareEnabled(value.shareEnabled),
    shareToken: normalizeShareToken(value.shareToken)
  };
}

export function normalizeTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new CloudAccountError("Sheet title is required.");
  }
  const title = value.trim();
  const characterCount = Array.from(title).length;
  if (
    characterCount === 0 ||
    characterCount > 200 ||
    /[\u0000-\u001f\u007f]/.test(title)
  ) {
    throw new CloudAccountError("Sheet title must be between 1 and 200 characters.");
  }
  return title;
}

export function normalizeRevision(value: unknown, required = true): number | undefined {
  if (value === undefined && !required) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new CloudAccountError("Sheet revision is invalid.");
  }
  return value;
}

function assertJsonValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): asserts value is JsonValue {
  if (depth > 100) throw new CloudAccountError("Sheet document is nested too deeply.");
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new CloudAccountError("Sheet document contains an invalid number.");
  }
  if (typeof value !== "object") {
    throw new CloudAccountError("Sheet document must contain only JSON values.");
  }
  if (seen.has(value)) {
    throw new CloudAccountError("Sheet document cannot contain circular references.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new CloudAccountError("Sheet document cannot contain sparse arrays.");
      }
      assertJsonValue(value[index], seen, depth + 1);
    }
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CloudAccountError("Sheet document must contain only JSON objects.");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new CloudAccountError("Sheet document must contain only string keys.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new CloudAccountError("Sheet document contains an unsupported property.");
    }
    assertJsonValue(descriptor.value, seen, depth + 1);
  }
  seen.delete(value);
}

export function normalizeDocument(value: unknown): JsonObject {
  if (!isRecord(value)) {
    throw new CloudAccountError("Sheet document must be a JSON object.");
  }
  assertJsonValue(value, new WeakSet<object>(), 0);

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new CloudAccountError("Sheet document could not be encoded.");
  }
  if (Buffer.byteLength(serialized, "utf8") > CLOUD_DOCUMENT_MAX_BYTES) {
    throw new CloudAccountError("Sheet document cannot be larger than 1 MiB.");
  }
  return JSON.parse(serialized) as JsonObject;
}

function normalizeDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new CloudAccountError("Cloud returned an invalid sheet timestamp.");
  }
  return value;
}

export function normalizeCloudSheet(value: unknown): CloudSheet {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cloud returned an invalid sheet.");
  }
  if (value.schemaVersion !== CLOUD_SHEET_SCHEMA_VERSION) {
    throw new CloudAccountError("This sheet uses an unsupported schema version.");
  }
  return {
    id: normalizeUuid(value.id),
    clientCreatedId: normalizeUuid(value.clientCreatedId, "Client-created sheet"),
    title: normalizeTitle(value.title),
    document: normalizeDocument(value.document),
    ...normalizeCloudSharing(value),
    schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
    revision: normalizeRevision(value.revision) as number,
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt)
  };
}

function normalizeCloudSheetMetadata(value: unknown): CloudSheetMetadata {
  if (!isRecord(value) || Object.hasOwn(value, "document")) {
    throw new CloudAccountError("Cloud returned invalid sheet metadata.");
  }
  if (value.schemaVersion !== CLOUD_SHEET_SCHEMA_VERSION) {
    throw new CloudAccountError("This sheet uses an unsupported schema version.");
  }
  return {
    id: normalizeUuid(value.id),
    clientCreatedId: normalizeUuid(value.clientCreatedId, "Client-created sheet"),
    title: normalizeTitle(value.title),
    ...normalizeCloudSharing(value),
    schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
    revision: normalizeRevision(value.revision) as number,
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt)
  };
}

async function mapWithConcurrency<T, TResult>(
  values: readonly T[],
  concurrency: number,
  transform: (value: T) => Promise<TResult>
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let didFail = false;
  let firstFailure: unknown;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (!didFail && nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await transform(values[index]);
      } catch (error) {
        if (!didFail) {
          didFail = true;
          firstFailure = error;
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (didFail) throw firstFailure;
  return results;
}

function normalizeAccount(value: unknown): AccountSummary {
  if (!isRecord(value)) {
    throw new CloudAccountError("The signed-in account is invalid.");
  }
  return {
    id: normalizeUuid(value.id, "Account"),
    email: normalizeEmail(value.email)
  };
}

function normalizeAccountFromSession(
  session: SupabaseSessionLike | null
): AccountSummary {
  if (!session?.user) {
    throw new CloudAccountError("Sign in before verifying admin access.");
  }
  return normalizeAccount(session.user);
}

type NormalizedMfaFactor = {
  factorType: string;
  friendlyName?: string;
  id: string;
  status: "unverified" | "verified";
};

function normalizeMfaFriendlyName(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > 80) {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  return normalized;
}

function normalizeMfaFactor(value: unknown): NormalizedMfaFactor {
  if (!isRecord(value)) {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  if (
    typeof value.factor_type !== "string" ||
    !/^[a-z][a-z0-9_]{0,31}$/.test(value.factor_type) ||
    (value.status !== "unverified" && value.status !== "verified")
  ) {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  return {
    factorType: value.factor_type,
    friendlyName: normalizeMfaFriendlyName(value.friendly_name),
    id: normalizeUuid(value.id, "MFA factor"),
    status: value.status
  };
}

function normalizeMfaFactors(value: unknown): {
  all: NormalizedMfaFactor[];
  totp: NormalizedMfaFactor[];
} {
  if (!isRecord(value) || !Array.isArray(value.all) || !Array.isArray(value.totp)) {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  if (value.all.length > 32 || value.totp.length > 32) {
    throw new CloudAccountError("Cloud returned too many MFA factors.");
  }
  const all = value.all.map(normalizeMfaFactor);
  const totp = value.totp.map(normalizeMfaFactor);
  const allById = new Map(all.map((factor) => [factor.id, factor]));
  const verifiedTotpIds = new Set(
    all
      .filter(
        (factor) =>
          factor.factorType === "totp" && factor.status === "verified"
      )
      .map((factor) => factor.id)
  );
  if (
    allById.size !== all.length ||
    new Set(totp.map((factor) => factor.id)).size !== totp.length ||
    totp.length !== verifiedTotpIds.size ||
    totp.some((factor) => {
      const listed = allById.get(factor.id);
      return (
        !verifiedTotpIds.has(factor.id) ||
        factor.factorType !== "totp" ||
        factor.status !== "verified" ||
        listed?.factorType !== "totp" ||
        listed.status !== "verified" ||
        listed.friendlyName !== factor.friendlyName
      );
    })
  ) {
    throw new CloudAccountError("Cloud returned invalid MFA factor data.");
  }
  return { all, totp };
}

function normalizeMfaEnrollment(value: unknown):
  | { factorId: string; preparation: AdminMfaPreparation }
  | undefined {
  if (!isRecord(value) || value.type !== "totp" || !isRecord(value.totp)) {
    return undefined;
  }
  let factorId: string;
  try {
    factorId = normalizeUuid(value.id, "MFA factor");
  } catch {
    return undefined;
  }
  try {
    const preparation = normalizeAdminMfaPreparation({
      factorLabel:
        normalizeMfaFriendlyName(value.friendly_name) ?? "Looper admin",
      manualSecret: value.totp.secret,
      mode: "enrollment",
      qrCode: value.totp.qr_code
    });
    return preparation ? { factorId, preparation } : undefined;
  } catch {
    return undefined;
  }
}

function normalizeCreatedMfaFactorId(value: unknown): string | undefined {
  if (!isRecord(value) || value.type !== "totp") return undefined;
  try {
    return normalizeUuid(value.id, "MFA factor");
  } catch {
    return undefined;
  }
}

type SupabaseSessionLike = {
  access_token?: unknown;
  user?: unknown;
};

type SupabaseMfaFactorLike = {
  factor_type?: unknown;
  friendly_name?: unknown;
  id?: unknown;
  status?: unknown;
};

type SupabaseResult<T> = {
  data: T;
  error: unknown;
};

type SupabaseClientLike = {
  auth: {
    exchangeCodeForSession?: (code: string) => Promise<
      SupabaseResult<{ session: SupabaseSessionLike | null; user: unknown }>
    >;
    getSession: () => Promise<
      SupabaseResult<{ session: SupabaseSessionLike | null }>
    >;
    getUser: (accessToken?: string) => Promise<SupabaseResult<{ user: unknown }>>;
    mfa?: {
      challengeAndVerify: (input: {
        code: string;
        factorId: string;
      }) => Promise<SupabaseResult<unknown>>;
      enroll: (input: {
        factorType: "totp";
        friendlyName: string;
      }) => Promise<SupabaseResult<unknown>>;
      listFactors: () => Promise<SupabaseResult<unknown>>;
      unenroll: (input: {
        factorId: string;
      }) => Promise<SupabaseResult<unknown>>;
    };
    signInWithOtp: (input: {
      email: string;
      options: { shouldCreateUser: true };
    }) => Promise<SupabaseResult<unknown>>;
    signInWithOAuth?: (input: {
      options: { redirectTo: string; skipBrowserRedirect: true };
      provider: "google";
    }) => Promise<SupabaseResult<{ provider?: string; url?: string | null }>>;
    verifyOtp: (input: {
      email: string;
      token: string;
      type: "email";
    }) => Promise<
      SupabaseResult<{ session: SupabaseSessionLike | null; user: unknown }>
    >;
    signOut: (options: { scope: "global" | "local" }) => Promise<SupabaseResult<unknown>>;
  };
};

type SupabaseClientFactory = (
  url: string,
  publishableKey: string,
  options: {
    auth: {
      autoRefreshToken: true;
      detectSessionInUrl: false;
      flowType: "pkce";
      persistSession: true;
      storage: AsyncAuthStorage;
    };
  }
) => SupabaseClientLike | Promise<SupabaseClientLike>;

type CloudEnvironment = {
  apiUrl?: string;
  supabasePublishableKey?: string;
  supabaseUrl?: string;
};

export type CloudAccountServiceOptions = {
  authStorage: AsyncAuthStorage;
  createSupabaseClient?: SupabaseClientFactory;
  environment?: CloudEnvironment;
  fetch?: typeof fetch;
};

function defaultEnvironment(): CloudEnvironment {
  return {
    apiUrl:
      import.meta.env?.MAIN_VITE_LOOPER_API_URL ??
      process.env.MAIN_VITE_LOOPER_API_URL
  };
}

function normalizeServiceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]");
    if (url.protocol !== "https:" && !isLocalHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizePublishableKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (key.length < 10 || key.length > 4096 || /\s/.test(key)) return null;
  return key;
}

async function defaultSupabaseClientFactory(
  url: string,
  publishableKey: string,
  options: Parameters<SupabaseClientFactory>[2]
): Promise<SupabaseClientLike> {
  const moduleName: string = "@supabase/supabase-js";
  const loaded = (await import(/* @vite-ignore */ moduleName)) as {
    createClient?: unknown;
  };
  if (typeof loaded.createClient !== "function") {
    throw new CloudAccountError("Cloud sign-in could not be initialized.");
  }
  return (loaded.createClient as SupabaseClientFactory)(
    url,
    publishableKey,
    options
  );
}

export class CloudAccountService {
  private readonly apiUrl: string | null;
  private readonly authStorage: AsyncAuthStorage;
  private readonly createSupabaseClient: SupabaseClientFactory;
  private readonly fetchImplementation: typeof fetch;
  private readonly supabasePublishableKey: string | null;
  private readonly supabaseUrl: string | null;
  private clientPromise: Promise<SupabaseClientLike> | undefined;
  private pendingAdminMfa:
    | { accountId: string; factorId: string; removeOnCancel: boolean }
    | undefined;
  private adminMfaOperationInFlight = false;

  constructor(options: CloudAccountServiceOptions) {
    const environment = options.environment ?? defaultEnvironment();
    this.apiUrl = normalizeServiceUrl(environment.apiUrl);
    this.authStorage = options.authStorage;
    this.createSupabaseClient =
      options.createSupabaseClient ?? defaultSupabaseClientFactory;
    this.fetchImplementation = options.fetch ?? fetch;
    this.supabasePublishableKey = normalizePublishableKey(
      environment.supabasePublishableKey
    );
    this.supabaseUrl = normalizeServiceUrl(environment.supabaseUrl);
  }

  async getCloudConfiguration(): Promise<CloudConfiguration> {
    const apiConfigured = this.apiUrl !== null;
    const authConfigured =
      this.supabaseUrl !== null && this.supabasePublishableKey !== null;
    let secureStorageAvailable = true;
    try {
      secureStorageAvailable = (await this.authStorage.isAvailable?.()) !== false;
    } catch {
      secureStorageAvailable = false;
    }
    return {
      apiConfigured,
      authConfigured,
      configured: apiConfigured && authConfigured && secureStorageAvailable,
      secureStorageAvailable
    };
  }

  async getAccount(): Promise<AccountSummary | null> {
    const configuration = await this.getCloudConfiguration();
    if (!configuration.authConfigured || !configuration.secureStorageAvailable) {
      return null;
    }
    let session: SupabaseSessionLike | null;
    try {
      session = await this.currentSession();
    } catch (error) {
      if (error instanceof StoredAuthSessionError) return null;
      const offlineAccount = await this.readOfflineAccount();
      if (offlineAccount) return offlineAccount;
      throw error;
    }
    const accessToken = session?.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      await this.clearOfflineAccount();
      return null;
    }
    const client = await this.client();
    try {
      const result = await client.auth.getUser(accessToken);
      if (result.error) {
        if (isTerminalAuthError(result.error)) {
          await this.clearOfflineAccount();
          return null;
        }
        const account = normalizeAccount(session?.user);
        await this.rememberOfflineAccount(account);
        return account;
      }
      if (!result.data.user) {
        await this.clearOfflineAccount();
        return null;
      }
      const account = normalizeAccount(result.data.user);
      await this.rememberOfflineAccount(account);
      return account;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      try {
        const account = normalizeAccount(session?.user);
        await this.rememberOfflineAccount(account);
        return account;
      } catch {
        const offlineAccount = await this.readOfflineAccount();
        if (offlineAccount) return offlineAccount;
      }
      throw new CloudAccountError(
        "Could not verify your account session. Check your connection and try again."
      );
    }
  }

  async requestEmailCode(rawEmail: unknown): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const client = await this.client();
    try {
      const result = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
      });
      if (result.error) throw emailCodeRequestError(result.error);
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw emailCodeRequestError(error);
    }
  }

  async createGoogleSignInUrl(redirectTo: string): Promise<string> {
    if (redirectTo !== "looper://auth/callback") {
      throw new CloudAccountError("Google sign-in received an invalid callback address.");
    }

    const client = await this.client();
    if (!client.auth.signInWithOAuth) {
      throw new CloudAccountError("Google sign-in is unavailable in this build.");
    }

    try {
      const result = await client.auth.signInWithOAuth({
        options: { redirectTo, skipBrowserRedirect: true },
        provider: "google"
      });
      if (result.error || typeof result.data.url !== "string") throw new Error();

      const authorizationUrl = new URL(result.data.url);
      const supabaseUrl = new URL(this.supabaseUrl as string);
      if (
        authorizationUrl.origin !== supabaseUrl.origin ||
        authorizationUrl.protocol !== supabaseUrl.protocol ||
        authorizationUrl.username ||
        authorizationUrl.password ||
        authorizationUrl.hash
      ) {
        throw new Error();
      }
      return authorizationUrl.toString();
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError(
        "Could not start Google sign-in. Check your connection and try again."
      );
    }
  }

  async completeGoogleSignIn(rawCallbackUrl: unknown): Promise<AccountSummary> {
    if (typeof rawCallbackUrl !== "string" || rawCallbackUrl.length > 8_192) {
      throw new CloudAccountError("Google sign-in returned an invalid response.");
    }

    let callbackUrl: URL;
    try {
      callbackUrl = new URL(rawCallbackUrl);
    } catch {
      throw new CloudAccountError("Google sign-in returned an invalid response.");
    }
    if (
      callbackUrl.protocol !== "looper:" ||
      callbackUrl.hostname !== "auth" ||
      callbackUrl.pathname !== "/callback" ||
      callbackUrl.username ||
      callbackUrl.password ||
      callbackUrl.hash
    ) {
      throw new CloudAccountError("Google sign-in returned an invalid response.");
    }
    if (callbackUrl.searchParams.has("error")) {
      throw new CloudAccountError("Google sign-in was canceled or could not be completed.");
    }

    const code = callbackUrl.searchParams.get("code");
    if (
      !code ||
      code.length > 4_096 ||
      /[\s\u0000-\u001f\u007f]/.test(code)
    ) {
      throw new CloudAccountError("Google sign-in returned an invalid response.");
    }

    const client = await this.client();
    if (!client.auth.exchangeCodeForSession) {
      throw new CloudAccountError("Google sign-in is unavailable in this build.");
    }

    try {
      const result = await client.auth.exchangeCodeForSession(code);
      if (result.error) throw new Error();
      const user = result.data.user ?? result.data.session?.user;
      if (!user) throw new Error();
      const account = normalizeAccount(user);
      await this.rememberOfflineAccount(account);
      return account;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError(
        "Google sign-in could not be completed. Please try again."
      );
    }
  }

  async verifyEmailCode(rawEmail: unknown, rawCode: unknown): Promise<AccountSummary> {
    const email = normalizeEmail(rawEmail);
    const code = normalizeOtp(rawCode);
    const client = await this.client();
    try {
      const result = await client.auth.verifyOtp({ email, token: code, type: "email" });
      if (result.error) throw new Error();
      const user = result.data.user ?? result.data.session?.user;
      if (!user) throw new Error();
      const account = normalizeAccount(user);
      await this.rememberOfflineAccount(account);
      return account;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError("That sign-in code is invalid or expired.");
    }
  }

  async signOut(scope: "global" | "local" = "local"): Promise<void> {
    const configuration = await this.getCloudConfiguration();
    if (!configuration.authConfigured) return;
    const client = await this.client();
    this.pendingAdminMfa = undefined;
    try {
      const result = await client.auth.signOut({ scope });
      if (result.error) throw new Error();
      await this.clearOfflineAccount().catch(() => undefined);
    } catch {
      throw new CloudAccountError("Could not sign out securely. Please try again.");
    }
  }

  async deleteAccount(): Promise<void> {
    this.pendingAdminMfa = undefined;
    await this.apiRequest("DELETE", "/api/v1/account", {
      confirmation: accountDeletionConfirmation
    });

    const client = await this.client();
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    await this.clearOfflineAccount().catch(() => undefined);
  }

  async listCloudSheets(): Promise<CloudSheet[]> {
    const metadata = await this.listCloudSheetMetadata();
    const batches: CloudSheetMetadata[][] = [];
    for (let index = 0; index < metadata.length; index += cloudSheetBatchSize) {
      batches.push(metadata.slice(index, index + cloudSheetBatchSize));
    }
    const hydratedBatches = await mapWithConcurrency(
      batches,
      cloudSheetDetailConcurrency,
      async (batch) => {
        const requestedIds = batch.map((sheet) => sheet.id);
        const query = new URLSearchParams({ ids: requestedIds.join(",") });
        const payload = await this.apiRequest(
          "GET",
          "/api/v1/sheets/batch",
          undefined,
          query
        );
        if (
          !isRecord(payload) ||
          !Array.isArray(payload.sheets) ||
          !Array.isArray(payload.missingIds) ||
          payload.sheets.length > requestedIds.length ||
          payload.missingIds.length > requestedIds.length
        ) {
          throw new CloudAccountError("Cloud returned an invalid sheet batch.");
        }

        const requestedIdSet = new Set(requestedIds);
        const accountedIds = new Set<string>();
        const sheets = payload.sheets.map((value) => {
          const sheet = normalizeCloudSheet(value);
          if (!requestedIdSet.has(sheet.id) || accountedIds.has(sheet.id)) {
            throw new CloudAccountError("Cloud returned an invalid sheet batch.");
          }
          accountedIds.add(sheet.id);
          return sheet;
        });
        for (const value of payload.missingIds) {
          const missingId = normalizeUuid(value);
          if (!requestedIdSet.has(missingId) || accountedIds.has(missingId)) {
            throw new CloudAccountError("Cloud returned an invalid sheet batch.");
          }
          accountedIds.add(missingId);
        }
        if (accountedIds.size !== requestedIds.length) {
          throw new CloudAccountError("Cloud returned an incomplete sheet batch.");
        }
        return sheets;
      }
    );
    return hydratedBatches
      .flat()
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
          right.id.localeCompare(left.id)
      );
  }

  async getCloudSheet(rawId: unknown): Promise<CloudSheet | undefined> {
    const id = normalizeUuid(rawId);
    try {
      const payload = await this.apiRequest(
        "GET",
        `/api/v1/sheets/${encodeURIComponent(id)}`
      );
      if (!isRecord(payload) || !("sheet" in payload)) {
        throw new CloudAccountError("Cloud returned an invalid sheet.");
      }
      const sheet = normalizeCloudSheet(payload.sheet);
      if (sheet.id !== id) {
        throw new CloudAccountError("Cloud returned the wrong sheet.");
      }
      return sheet;
    } catch (error) {
      if (
        error instanceof CloudApiResponseError &&
        error.status === 404 &&
        error.apiCode === "sheet_not_found"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async createCloudSheet(rawInput: unknown): Promise<CloudSheet> {
    if (!isRecord(rawInput)) {
      throw new CloudAccountError("New sheet data is invalid.");
    }
    const body = {
      clientCreatedId: normalizeUuid(rawInput.clientCreatedId, "Client-created sheet"),
      title: normalizeTitle(rawInput.title),
      document: normalizeDocument(rawInput.document),
      schemaVersion: CLOUD_SHEET_SCHEMA_VERSION
    };
    const payload = await this.apiRequest("POST", "/api/v1/sheets", body);
    if (!isRecord(payload) || !("sheet" in payload)) {
      throw new CloudAccountError("Cloud returned an invalid sheet.");
    }
    return normalizeCloudSheet(payload.sheet);
  }

  async getBillingStatus(): Promise<BillingStatus> {
    const payload = await this.apiRequest("GET", "/api/v1/billing/status");
    if (!isRecord(payload) || !("billing" in payload)) {
      throw new CloudAccountError("Cloud returned an invalid billing status.");
    }
    return normalizeBillingStatus(payload.billing);
  }

  async getAdminOverview(rawPage: unknown = 1): Promise<AdminOverview> {
    const page = normalizeAdminPage(rawPage);
    if (page === undefined) {
      throw new CloudAccountError("The requested admin page is invalid.");
    }
    const payload = await this.apiRequest(
      "GET",
      "/api/v1/admin/accounts",
      undefined,
      new URLSearchParams({ page: String(page) }),
      true,
      adminOverviewMaximumResponseBytes
    );
    const overview = isRecord(payload)
      ? normalizeAdminOverview(payload.overview)
      : undefined;
    if (!overview) {
      throw new CloudAccountError("Cloud returned invalid admin data.");
    }
    return overview;
  }

  async getAdminAccess(): Promise<AdminAccessStatus> {
    try {
      const payload = await this.apiRequest("GET", "/api/v1/admin/access");
      if (
        !isRecord(payload) ||
        payload.admin !== true ||
        Object.keys(payload).length !== 1
      ) {
        throw new CloudAccountError("Cloud returned an invalid admin-access response.");
      }
      return "granted";
    } catch (error) {
      if (error instanceof CloudApiResponseError && error.status === 403) {
        if (error.apiCode === "admin_access_denied") return "denied";
        if (error.apiCode === "admin_mfa_activation_required") {
          return "mfa_activation_required";
        }
        if (error.apiCode === "admin_mfa_required") return "mfa_required";
      }
      throw error;
    }
  }

  async prepareAdminMfa(): Promise<AdminMfaPreparation> {
    if (this.adminMfaOperationInFlight) {
      throw new CloudAccountError("Admin verification is already in progress.");
    }
    this.adminMfaOperationInFlight = true;
    try {
      return await this.prepareAdminMfaOperation();
    } finally {
      this.adminMfaOperationInFlight = false;
    }
  }

  private async prepareAdminMfaOperation(): Promise<AdminMfaPreparation> {
    await this.cancelAdminMfaOperation();
    const client = await this.client();
    const mfa = client.auth.mfa;
    if (!mfa) {
      throw new CloudAccountError("Admin authenticator verification is unavailable.");
    }
    const account = normalizeAccountFromSession(await this.currentSession());

    let factors: { all: NormalizedMfaFactor[]; totp: NormalizedMfaFactor[] };
    try {
      const result = await mfa.listFactors();
      if (result.error) throw new Error();
      factors = normalizeMfaFactors(result.data);
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError(
        "Authenticator verification could not be prepared. Please try again."
      );
    }

    const verifiedTotp = factors.totp
      .filter((factor) => factor.status === "verified")
      .sort((left, right) => left.id.localeCompare(right.id));
    if (verifiedTotp.length > 0) {
      const factor = verifiedTotp[0];
      this.pendingAdminMfa = {
        accountId: account.id,
        factorId: factor.id,
        removeOnCancel: false
      };
      return {
        factorLabel: factor.friendlyName ?? "Authenticator app",
        mode: "challenge"
      };
    }

    if (
      factors.all.some(
        (factor) => factor.status === "verified" && factor.factorType !== "totp"
      )
    ) {
      throw new CloudAccountError(
        "This admin account uses an unsupported second factor. Configure a TOTP authenticator before continuing."
      );
    }

    for (const factor of factors.all) {
      if (factor.factorType !== "totp" || factor.status === "verified") continue;
      const removal = await mfa.unenroll({ factorId: factor.id });
      if (removal.error) {
        throw new CloudAccountError(
          "An unfinished authenticator setup could not be cleared. Please try again."
        );
      }
    }

    let enrollmentResult: SupabaseResult<unknown>;
    try {
      enrollmentResult = await mfa.enroll({
        factorType: "totp",
        friendlyName: "Looper admin"
      });
    } catch {
      throw new CloudAccountError(
        "A new authenticator could not be enrolled. Please try again."
      );
    }
    if (enrollmentResult.error) {
      throw new CloudAccountError(
        "A new authenticator could not be enrolled. Please try again."
      );
    }
    const createdFactorId = normalizeCreatedMfaFactorId(enrollmentResult.data);
    if (createdFactorId) {
      // Preserve the server-created factor ID before parsing QR/display fields.
      // If those fields are malformed, cancelAdminMfa can still remove the
      // otherwise latent unverified factor.
      this.pendingAdminMfa = {
        accountId: account.id,
        factorId: createdFactorId,
        removeOnCancel: true
      };
    }
    const enrollment = normalizeMfaEnrollment(enrollmentResult.data);
    if (!enrollment) {
      throw new CloudAccountError("Cloud returned an invalid MFA enrollment.");
    }
    this.pendingAdminMfa = {
      accountId: account.id,
      factorId: enrollment.factorId,
      removeOnCancel: true
    };
    return enrollment.preparation;
  }

  async verifyAdminMfa(rawCode: unknown): Promise<void> {
    const code = normalizeAdminMfaCode(rawCode);
    if (!code) {
      throw new CloudAccountError("Enter a six-digit authenticator code.");
    }
    const pending = this.pendingAdminMfa;
    if (!pending) {
      throw new CloudAccountError("Start admin verification before entering a code.");
    }
    if (this.adminMfaOperationInFlight) {
      throw new CloudAccountError("Admin verification is already in progress.");
    }
    this.adminMfaOperationInFlight = true;
    try {
      await this.verifyAdminMfaOperation(code, pending);
    } finally {
      this.adminMfaOperationInFlight = false;
    }
  }

  private async verifyAdminMfaOperation(
    code: string,
    pending: { accountId: string; factorId: string; removeOnCancel: boolean }
  ): Promise<void> {
    const client = await this.client();
    const mfa = client.auth.mfa;
    if (!mfa) {
      throw new CloudAccountError("Admin authenticator verification is unavailable.");
    }
    const account = normalizeAccountFromSession(await this.currentSession());
    if (account.id !== pending.accountId) {
      this.pendingAdminMfa = undefined;
      throw new CloudAccountError("The signed-in account changed. Start again.");
    }

    try {
      const result = await mfa.challengeAndVerify({
        code,
        factorId: pending.factorId
      });
      if (result.error) throw new Error();
      const verifiedAccount = normalizeAccountFromSession(await this.currentSession());
      if (verifiedAccount.id !== pending.accountId) throw new Error();
      this.pendingAdminMfa = undefined;
    } catch {
      throw new CloudAccountError(
        "That authenticator code is invalid or expired. Please try again."
      );
    }
  }

  async cancelAdminMfa(): Promise<void> {
    if (this.adminMfaOperationInFlight) {
      throw new CloudAccountError("Admin verification is already in progress.");
    }
    this.adminMfaOperationInFlight = true;
    try {
      await this.cancelAdminMfaOperation();
    } finally {
      this.adminMfaOperationInFlight = false;
    }
  }

  private async cancelAdminMfaOperation(): Promise<void> {
    const pending = this.pendingAdminMfa;
    if (!pending) return;
    if (!pending.removeOnCancel) {
      this.pendingAdminMfa = undefined;
      return;
    }
    const client = await this.client();
    const mfa = client.auth.mfa;
    if (!mfa) {
      throw new CloudAccountError(
        "The unfinished authenticator setup could not be cleared."
      );
    }
    try {
      const account = normalizeAccountFromSession(await this.currentSession());
      if (account.id !== pending.accountId) {
        this.pendingAdminMfa = undefined;
        return;
      }
      const result = await mfa.unenroll({ factorId: pending.factorId });
      if (result.error) throw new Error();
      this.pendingAdminMfa = undefined;
    } catch {
      throw new CloudAccountError(
        "The unfinished authenticator setup could not be cleared."
      );
    }
  }

  async getAdminSheet(rawSheetId: unknown): Promise<CloudSheet> {
    const sheetId = normalizeUuid(rawSheetId);
    const payload = await this.apiRequest(
      "GET",
      `/api/v1/admin/sheets/${encodeURIComponent(sheetId)}`
    );
    if (!isRecord(payload) || !("sheet" in payload)) {
      throw new CloudAccountError("Cloud returned an invalid admin sheet.");
    }
    return normalizeCloudSheet(payload.sheet);
  }

  async createBillingCheckout(rawProduct: unknown): Promise<string> {
    if (!isSheetPackProduct(rawProduct)) {
      throw new CloudAccountError("That sheet pack is not available.");
    }
    const product: SheetPackProduct = rawProduct;
    const payload = await this.apiRequest(
      "POST",
      "/api/v1/billing/checkout",
      { product }
    );
    return normalizeStripeUrl(
      isRecord(payload) ? payload.url : undefined,
      "checkout.stripe.com"
    );
  }

  async updateCloudSheet(rawInput: unknown): Promise<CloudSheet> {
    if (!isRecord(rawInput)) {
      throw new CloudAccountError("Updated sheet data is invalid.");
    }
    const id = normalizeUuid(rawInput.id);
    const hasTitle = rawInput.title !== undefined;
    const hasDocument = rawInput.document !== undefined;
    const hasShareEnabled = rawInput.shareEnabled !== undefined;
    if (!hasTitle && !hasDocument && !hasShareEnabled) {
      throw new CloudAccountError("Updated sheet data must include a field to change.");
    }
    const body = {
      expectedRevision: normalizeRevision(rawInput.expectedRevision) as number,
      ...(hasTitle ? { title: normalizeTitle(rawInput.title) } : {}),
      ...(hasDocument
        ? {
            document: normalizeDocument(rawInput.document),
            schemaVersion: CLOUD_SHEET_SCHEMA_VERSION
          }
        : {}),
      ...(!hasShareEnabled
        ? {}
        : { shareEnabled: normalizeShareEnabled(rawInput.shareEnabled, "Sharing setting") })
    };
    const payload = await this.apiRequest(
      "PATCH",
      `/api/v1/sheets/${encodeURIComponent(id)}`,
      body
    );
    if (!isRecord(payload) || !("sheet" in payload)) {
      throw new CloudAccountError("Cloud returned an invalid sheet.");
    }
    return normalizeCloudSheet(payload.sheet);
  }

  async getSharedCloudSheet(rawShareToken: unknown): Promise<CloudSheet | null> {
    const shareToken = normalizeShareToken(rawShareToken);
    try {
      const payload = await this.apiRequest(
        "GET",
        `/api/v1/shared-sheets/${shareToken}`,
        undefined,
        undefined,
        false
      );
      if (!isRecord(payload) || !("sheet" in payload)) {
        throw new CloudAccountError("Cloud returned an invalid shared sheet.");
      }
      return normalizeCloudSheet(payload.sheet);
    } catch (error) {
      if (
        error instanceof CloudApiResponseError &&
        error.status === 404 &&
        error.apiCode === "shared_sheet_not_found"
      ) {
        return null;
      }
      throw error;
    }
  }

  async updateSharedCloudSheet(rawInput: unknown): Promise<CloudSheet> {
    if (!isRecord(rawInput)) {
      throw new CloudAccountError("Shared sheet data is invalid.");
    }
    const shareToken = normalizeShareToken(rawInput.shareToken);
    const payload = await this.apiRequest(
      "PATCH",
      `/api/v1/shared-sheets/${shareToken}`,
      {
        document: normalizeDocument(rawInput.document),
        schemaVersion: CLOUD_SHEET_SCHEMA_VERSION,
        expectedRevision: normalizeRevision(rawInput.expectedRevision) as number
      },
      undefined,
      false
    );
    if (!isRecord(payload) || !("sheet" in payload)) {
      throw new CloudAccountError("Cloud returned an invalid shared sheet.");
    }
    return normalizeCloudSheet(payload.sheet);
  }

  shareableUrl(rawInput: unknown): string {
    if (!isRecord(rawInput)) {
      throw new CloudAccountError("Shareable sheet URL is invalid.");
    }
    if (!this.apiUrl) {
      throw new CloudAccountError("Cloud sheet storage is not configured in this build.");
    }
    const url = new URL(this.apiUrl);
    url.pathname = `/s/${normalizeShareToken(rawInput.shareToken)}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  async deleteCloudSheet(rawInput: unknown): Promise<void> {
    if (!isRecord(rawInput)) {
      throw new CloudAccountError("Sheet deletion request is invalid.");
    }
    const id = normalizeUuid(rawInput.id);
    const expectedRevision = normalizeRevision(rawInput.expectedRevision, false);
    await this.apiRequest(
      "DELETE",
      `/api/v1/sheets/${encodeURIComponent(id)}`,
      expectedRevision === undefined ? undefined : { expectedRevision }
    );
  }

  private async listCloudSheetMetadata(): Promise<CloudSheetMetadata[]> {
    const metadata: CloudSheetMetadata[] = [];
    const seenSheetIds = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let previousSheetId: string | undefined;

    while (true) {
      const query = new URLSearchParams({ limit: String(cloudSheetPageSize) });
      if (cursor !== undefined) query.set("cursor", cursor);
      const payload = await this.apiRequest(
        "GET",
        "/api/v1/sheets",
        undefined,
        query
      );
      if (
        !isRecord(payload) ||
        !Array.isArray(payload.sheets) ||
        payload.sheets.length > cloudSheetPageSize ||
        (payload.nextCursor !== null && typeof payload.nextCursor !== "string")
      ) {
        throw new CloudAccountError("Cloud returned an invalid sheet list.");
      }

      const page = payload.sheets.map(normalizeCloudSheetMetadata);
      for (const sheet of page) {
        if (
          seenSheetIds.has(sheet.id) ||
          (previousSheetId !== undefined && sheet.id <= previousSheetId)
        ) {
          throw new CloudAccountError("Cloud returned invalid sheet pagination.");
        }
        seenSheetIds.add(sheet.id);
        previousSheetId = sheet.id;
        metadata.push(sheet);
      }

      if (metadata.length > maximumCloudSheetCount) {
        throw new CloudAccountError("Cloud returned too many sheets.");
      }
      if (payload.nextCursor === null) return metadata;

      if (metadata.length >= maximumCloudSheetCount) {
        throw new CloudAccountError("Cloud returned too many sheets.");
      }

      const nextCursor = normalizeUuid(payload.nextCursor, "Sheet cursor");
      if (
        page.length === 0 ||
        nextCursor !== page.at(-1)?.id ||
        seenCursors.has(nextCursor)
      ) {
        throw new CloudAccountError("Cloud returned invalid sheet pagination.");
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
  }

  private async client(): Promise<SupabaseClientLike> {
    const configuration = await this.getCloudConfiguration();
    if (!configuration.authConfigured) {
      throw new CloudAccountError("Cloud sign-in is not configured in this build.");
    }
    if (!configuration.secureStorageAvailable) {
      throw new CloudAccountError(
        "Secure account storage is unavailable on this device."
      );
    }
    if (!this.clientPromise) {
      const creation = Promise.resolve(
        this.createSupabaseClient(
          this.supabaseUrl as string,
          this.supabasePublishableKey as string,
          {
            auth: {
              autoRefreshToken: true,
              detectSessionInUrl: false,
              flowType: "pkce",
              persistSession: true,
              storage: this.authStorage
            }
          }
        )
      ).catch(() => {
        this.clientPromise = undefined;
        throw new CloudAccountError("Cloud sign-in could not be initialized.");
      });
      this.clientPromise = creation;
    }
    return this.clientPromise;
  }

  private async currentSession(): Promise<SupabaseSessionLike | null> {
    const client = await this.client();
    try {
      const result = await client.auth.getSession();
      if (result.error) {
        if (isTerminalAuthError(result.error)) return null;
        if (result.data.session?.user) return result.data.session;
        throw new Error();
      }
      return result.data.session;
    } catch (error) {
      if (error instanceof CloudAccountError) throw error;
      throw new CloudAccountError(
        "Could not restore your account session. Check your connection and try again."
      );
    }
  }

  private async readOfflineAccount(): Promise<AccountSummary | null> {
    try {
      const raw = await this.authStorage.getItem(offlineAccountStorageKey);
      return raw ? normalizeAccount(JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  private async rememberOfflineAccount(account: AccountSummary): Promise<void> {
    await this.authStorage.setItem(
      offlineAccountStorageKey,
      JSON.stringify(normalizeAccount(account))
    );
  }

  private async clearOfflineAccount(): Promise<void> {
    await this.authStorage.removeItem(offlineAccountStorageKey);
  }

  private async accessToken(): Promise<string> {
    const session = await this.currentSession();
    const token = session?.access_token;
    if (typeof token !== "string" || token.length === 0 || token.length > 32_768) {
      throw new CloudAccountError("Sign in to access your cloud sheets.");
    }
    return token;
  }

  private async apiRequest(
    method: "DELETE" | "GET" | "PATCH" | "POST",
    path: string,
    body?: Record<string, unknown>,
    query?: URLSearchParams,
    authenticated = true,
    maximumResponseBytes = apiResponseMaximumBytes
  ): Promise<unknown> {
    if (!this.apiUrl) {
      throw new CloudAccountError("Cloud sheet storage is not configured in this build.");
    }
    const token = authenticated ? await this.accessToken() : undefined;
    const url = new URL(this.apiUrl);
    url.pathname = path;
    url.search = query?.toString() ?? "";
    url.hash = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), apiRequestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        method,
        redirect: "error",
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new CloudAccountError("Cloud request timed out. Please try again.");
      }
      throw new CloudAccountError(
        "Could not reach cloud storage. Check your connection and try again."
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 204) return null;
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maximumResponseBytes) {
      throw new CloudAccountError("Cloud returned a response that was too large.");
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maximumResponseBytes) {
      throw new CloudAccountError("Cloud returned a response that was too large.");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (!response.ok) {
        throw apiResponseError(response.status);
      }
      throw new CloudAccountError("Cloud returned an invalid response.");
    }
    if (!response.ok) {
      throw apiResponseError(
        response.status,
        normalizeApiErrorCode(response.headers.get("content-type"), payload)
      );
    }
    return payload;
  }
}

function normalizeApiErrorCode(
  contentType: string | null,
  payload: unknown
): string | undefined {
  if (contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return undefined;
  }
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  const { code, message } = payload.error;
  if (
    typeof code !== "string" ||
    !/^[a-z][a-z0-9_]{0,63}$/.test(code) ||
    typeof message !== "string" ||
    message.length === 0 ||
    message.length > 1_000
  ) {
    return undefined;
  }
  return code;
}

function apiResponseError(status: number, apiCode?: string): CloudAccountError {
  switch (status) {
    case 400:
      return new CloudApiResponseError(status, "Cloud rejected the sheet data.", apiCode);
    case 401:
      return new CloudApiResponseError(status, "Your session expired. Sign in again.", apiCode);
    case 402:
      return new CloudApiResponseError(
        status,
        "You have no unused sheets. Buy 50 more to create another.",
        apiCode
      );
    case 403:
      return new CloudApiResponseError(
        status,
        "You do not have access to that sheet.",
        apiCode
      );
    case 404:
      return new CloudApiResponseError(status, "That cloud sheet no longer exists.", apiCode);
    case 409:
      return new CloudApiResponseError(
        status,
        "That sheet changed on another device. Retry to save this Mac’s version as the latest.",
        apiCode
      );
    case 413:
      return new CloudApiResponseError(status, "That sheet is too large to save.", apiCode);
    case 415:
    case 422:
      return new CloudApiResponseError(status, "Cloud rejected the sheet data.", apiCode);
    case 429:
      return new CloudApiResponseError(
        status,
        "Too many cloud requests. Please wait and try again.",
        apiCode
      );
    case 503:
      return new CloudApiResponseError(
        status,
        "Cloud storage is temporarily unavailable.",
        apiCode
      );
    default:
      return new CloudApiResponseError(
        status,
        "Cloud storage could not complete the request.",
        apiCode
      );
  }
}
