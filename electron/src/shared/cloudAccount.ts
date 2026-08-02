export const CLOUD_DOCUMENT_MAX_BYTES = 1024 * 1024;
export const CLOUD_SHEET_SCHEMA_VERSION = 1 as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type CloudConfiguration = {
  apiConfigured: boolean;
  authConfigured: boolean;
  configured: boolean;
  secureStorageAvailable: boolean;
};

export type AccountSummary = {
  id: string;
  email: string;
};

export type CloudSheet = {
  id: string;
  clientCreatedId: string;
  title: string;
  document: JsonObject;
  shareEnabled: boolean;
  /** Absent when an older sheet API does not yet support shareable URLs. */
  shareToken?: string;
  schemaVersion: typeof CLOUD_SHEET_SCHEMA_VERSION;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type CloudSheetMetadata = Omit<CloudSheet, "document">;

export type CreateCloudSheetInput = {
  clientCreatedId: string;
  title: string;
  document: JsonObject;
};

export type UpdateCloudSheetInput = {
  id: string;
  title?: string;
  document?: JsonObject;
  expectedRevision: number;
  shareEnabled?: boolean;
};

export type UpdateSharedCloudSheetInput = {
  shareToken: string;
  document: JsonObject;
  expectedRevision: number;
};

export type CopyShareableUrlInput = {
  shareToken: string;
};

export type DeleteCloudSheetInput = {
  id: string;
  expectedRevision?: number;
};

export type CloudSheetDraft = {
  sheetId: string;
  title: string;
  document: JsonObject;
  schemaVersion: typeof CLOUD_SHEET_SCHEMA_VERSION;
  expectedRevision: number;
  savedAt: string;
};

export type SaveCloudSheetDraftInput = Omit<CloudSheetDraft, "savedAt">;

export type DeleteCloudSheetDraftInput = {
  sheetId: string;
};

export const cloudIpcChannels = {
  cacheSheet: "cloud-account:cache-sheet",
  cancelGoogleSignIn: "cloud-account:cancel-google-sign-in",
  copyShareableUrl: "cloud-account:copy-shareable-url",
  createSheet: "cloud-account:create-sheet",
  deleteCachedSheet: "cloud-account:delete-cached-sheet",
  deleteDraft: "cloud-account:delete-draft",
  deleteAccount: "cloud-account:delete-account",
  deleteSheet: "cloud-account:delete-sheet",
  getAccount: "cloud-account:get-account",
  getConfiguration: "cloud-account:get-configuration",
  getSheet: "cloud-account:get-sheet",
  getSharedSheet: "cloud-account:get-shared-sheet",
  listCachedSheets: "cloud-account:list-cached-sheets",
  listSheets: "cloud-account:list-sheets",
  listDrafts: "cloud-account:list-drafts",
  replaceCachedSheets: "cloud-account:replace-cached-sheets",
  requestEmailCode: "cloud-account:request-email-code",
  signInWithGoogle: "cloud-account:sign-in-with-google",
  signOut: "cloud-account:sign-out",
  saveDraft: "cloud-account:save-draft",
  updateSheet: "cloud-account:update-sheet",
  updateSharedSheet: "cloud-account:update-shared-sheet",
  verifyEmailCode: "cloud-account:verify-email-code"
} as const;

export type CloudAccountApi = {
  cancelGoogleSignIn: () => Promise<void>;
  getCloudConfiguration: () => Promise<CloudConfiguration>;
  getAccount: () => Promise<AccountSummary | null>;
  requestEmailCode: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<AccountSummary>;
  verifyEmailCode: (email: string, code: string) => Promise<AccountSummary>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  listCloudSheets: () => Promise<CloudSheet[]>;
  listCachedCloudSheets: () => Promise<CloudSheet[]>;
  replaceCachedCloudSheets: (sheets: CloudSheet[]) => Promise<void>;
  cacheCloudSheet: (sheet: CloudSheet) => Promise<void>;
  deleteCachedCloudSheet: (input: DeleteCloudSheetDraftInput) => Promise<void>;
  getCloudSheet: (id: string) => Promise<CloudSheet | undefined>;
  getSharedCloudSheet: (shareToken: string) => Promise<CloudSheet | null>;
  createCloudSheet: (input: CreateCloudSheetInput) => Promise<CloudSheet>;
  updateCloudSheet: (input: UpdateCloudSheetInput) => Promise<CloudSheet>;
  updateSharedCloudSheet: (input: UpdateSharedCloudSheetInput) => Promise<CloudSheet>;
  copyShareableUrl: (input: CopyShareableUrlInput) => Promise<string>;
  deleteCloudSheet: (input: DeleteCloudSheetInput) => Promise<void>;
  listCloudDrafts: () => Promise<CloudSheetDraft[]>;
  saveCloudDraft: (input: SaveCloudSheetDraftInput) => Promise<CloudSheetDraft>;
  deleteCloudDraft: (input: DeleteCloudSheetDraftInput) => Promise<void>;
};
