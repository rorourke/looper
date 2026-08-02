import type { JsonObject } from "./cloudAccount.ts";

export const sheetStorageProviders = ["looper-cloud", "local"] as const;

export type SheetStorageProvider = (typeof sheetStorageProviders)[number];

export type SheetStorageSettings = Readonly<{
  provider: SheetStorageProvider;
  localDirectoryPath?: string;
}>;

export type LocalSheet = Readonly<{
  id: string;
  title: string;
  document: JsonObject;
  schemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  path: string;
}>;

export type CreateLocalSheetInput = Readonly<{
  id: string;
  title: string;
  document: JsonObject;
}>;

export type UpdateLocalSheetInput = Readonly<{
  id: string;
  title: string;
  document: JsonObject;
  expectedRevision: number;
}>;

export type DeleteLocalSheetInput = Readonly<{
  id: string;
  expectedRevision?: number;
}>;

export const sheetStorageIpcChannels = {
  createLocalSheet: "sheet-storage:create-local-sheet",
  deleteLocalSheet: "sheet-storage:delete-local-sheet",
  getSettings: "sheet-storage:get-settings",
  listLocalSheets: "sheet-storage:list-local-sheets",
  revealLocalDirectory: "sheet-storage:reveal-local-directory",
  setProvider: "sheet-storage:set-provider",
  settingsChanged: "sheet-storage:settings-changed",
  updateLocalSheet: "sheet-storage:update-local-sheet"
} as const;

export function isSheetStorageProvider(
  value: unknown
): value is SheetStorageProvider {
  return value === "looper-cloud" || value === "local";
}
