import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  cloudIpcChannels,
  type AccountSummary,
  type CloudConfiguration,
  type CloudSheetDraft,
  type CloudSheet,
  type CopyShareableUrlInput,
  type CreateCloudSheetInput,
  type DeleteCloudSheetDraftInput,
  type DeleteCloudSheetInput,
  type SaveCloudSheetDraftInput,
  type UpdateCloudSheetInput,
  type UpdateSharedCloudSheetInput
} from "../shared/cloudAccount";
import {
  contentZoomChannel,
  isContentZoomCommand,
  type ContentZoomCommand
} from "../shared/contentZoom";
import { debugSettingsIpcChannels } from "../shared/debugSettings";
import {
  billingIpcChannels,
  type BillingStatus,
  type SheetPackProduct
} from "../shared/billing";
import type { BillingPreviewMode } from "../shared/debugSettings";
import {
  applicationSettingsIpcChannels,
  isApplicationSettingsCommand,
  type ApplicationSettingsCommand,
  type ApplicationSettingsMenuState
} from "../shared/applicationSettings";
import {
  appUpdateIpcChannels,
  isAppUpdateState,
  type AppUpdateState
} from "../shared/appUpdates";
import {
  sheetStorageIpcChannels,
  type CreateLocalSheetInput,
  type DeleteLocalSheetInput,
  type LocalSheet,
  type SheetStorageProvider,
  type SheetStorageSettings,
  type UpdateLocalSheetInput
} from "../shared/sheetStorage";
import { normalizeIpcError } from "../shared/ipcError";
import {
  adminIpcChannels,
  isAdminAccessStatus,
  normalizeAdminMfaPreparation,
  type AdminAccessStatus,
  type AdminMfaPreparation,
  type AdminOverview
} from "../shared/admin";
import { windowStateIpcChannels } from "../shared/windowState";

export type NativeSourceStatus = {
  available: boolean;
  path: string;
  reason: string;
  checkedAt: string;
};

export type LooperDocumentData = {
  title: string;
  text: string;
  fontScale: number;
  decimalPlaces: number;
  loopCount?: number;
  loopPeriod: string;
  loopedLines: number[];
  loopSidebarDividerLines?: number[];
  isLoopVariablePublished: boolean;
  isLoopEnabled: boolean;
  isResultsHidden: boolean;
  resultSortMode: "manual" | "ascending" | "descending";
  stockSymbols?: string[];
};

export type OpenDocumentResult =
  | { canceled: true }
  | { canceled: false; path: string; data: LooperDocumentData };

export type SaveDocumentResult =
  | { canceled: true }
  | { canceled: false; path: string };

export type ExportSheetRequest = {
  suggestedName: string;
  content: string;
};

export type ExportSheetsResult =
  | { canceled: true }
  | { canceled: false; count: number; path: string };

export type AppTheme = "dark" | "light" | "system";

export type StockQuote = {
  price: number;
};

export type StockQuoteMap = Record<string, StockQuote>;

function invokeMain(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer
    .invoke(channel, ...args)
    .catch((error: unknown) => {
      throw normalizeIpcError(error, channel);
    });
}

const looperApi = {
  platform: process.platform as NodeJS.Platform | "web",
  getWindowFullScreen: (): Promise<boolean> =>
    invokeMain(windowStateIpcChannels.getFullScreen),
  onWindowFullScreenChanged: (
    callback: (fullScreen: boolean) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, fullScreen: unknown): void => {
      if (typeof fullScreen === "boolean") callback(fullScreen);
    };
    ipcRenderer.on(windowStateIpcChannels.fullScreenChanged, listener);
    return () =>
      ipcRenderer.removeListener(windowStateIpcChannels.fullScreenChanged, listener);
  },
  openAdminPanel: (): Promise<void> =>
    invokeMain(adminIpcChannels.openPanel),
  getAdminAccess: async (): Promise<AdminAccessStatus> => {
    const status = await invokeMain(adminIpcChannels.getAccess);
    if (!isAdminAccessStatus(status)) {
      throw new Error("The admin-access response was invalid.");
    }
    return status;
  },
  prepareAdminMfa: async (): Promise<AdminMfaPreparation> => {
    const preparation = normalizeAdminMfaPreparation(
      await invokeMain(adminIpcChannels.prepareMfa)
    );
    if (!preparation) {
      throw new Error("The admin authenticator response was invalid.");
    }
    return preparation;
  },
  verifyAdminMfa: (code: string): Promise<void> =>
    invokeMain(adminIpcChannels.verifyMfa, code),
  cancelAdminMfa: (): Promise<void> =>
    invokeMain(adminIpcChannels.cancelMfa),
  onAdminAccessChanged: (
    callback: (status: AdminAccessStatus) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: unknown
    ): void => {
      if (isAdminAccessStatus(status)) callback(status);
    };
    ipcRenderer.on(adminIpcChannels.accessChanged, listener);
    return () => ipcRenderer.removeListener(adminIpcChannels.accessChanged, listener);
  },
  getAdminOverview: (page = 1): Promise<AdminOverview> =>
    invokeMain(adminIpcChannels.getOverview, page),
  getAdminSheet: (sheetId: string): Promise<CloudSheet> =>
    invokeMain(adminIpcChannels.getSheet, sheetId),
  updateApplicationSettingsMenu: (
    state: ApplicationSettingsMenuState
  ): Promise<void> =>
    invokeMain(applicationSettingsIpcChannels.updateMenuState, state),
  onApplicationSettingsCommand: (
    callback: (command: ApplicationSettingsCommand) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: unknown): void => {
      if (isApplicationSettingsCommand(command)) callback(command);
    };
    ipcRenderer.on(applicationSettingsIpcChannels.command, listener);
    return () =>
      ipcRenderer.removeListener(applicationSettingsIpcChannels.command, listener);
  },
  getSignedOutPreview: (): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.getSignedOutPreview),
  getDebugSettingsAvailable: (): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.getAvailability),
  getDemoTime: (): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.getDemoTime),
  setDemoTime: (enabled: boolean): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.setDemoTime, enabled),
  setSignedOutPreview: (enabled: boolean): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.setSignedOutPreview, enabled),
  getBillingPreview: (): Promise<BillingPreviewMode> =>
    invokeMain(debugSettingsIpcChannels.getBillingPreview),
  setBillingPreview: (mode: BillingPreviewMode): Promise<BillingPreviewMode> =>
    invokeMain(debugSettingsIpcChannels.setBillingPreview, mode),
  getUpdateButtonPreview: (): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.getUpdateButtonPreview),
  setUpdateButtonPreview: (enabled: boolean): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.setUpdateButtonPreview, enabled),
  getWindowsClientSpoof: (): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.getWindowsClientSpoof),
  setWindowsClientSpoof: (enabled: boolean): Promise<boolean> =>
    invokeMain(debugSettingsIpcChannels.setWindowsClientSpoof, enabled),
  getAppUpdateState: (): Promise<AppUpdateState> =>
    invokeMain(appUpdateIpcChannels.getState),
  installAppUpdate: (): Promise<boolean> =>
    invokeMain(appUpdateIpcChannels.install),
  onAppUpdateStateChanged: (
    callback: (state: AppUpdateState) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown): void => {
      if (isAppUpdateState(state)) callback(state);
    };
    ipcRenderer.on(appUpdateIpcChannels.stateChanged, listener);
    return () =>
      ipcRenderer.removeListener(appUpdateIpcChannels.stateChanged, listener);
  },
  onBillingPreviewChanged: (
    callback: (mode: BillingPreviewMode) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: BillingPreviewMode): void =>
      callback(mode);
    ipcRenderer.on(debugSettingsIpcChannels.billingPreviewChanged, listener);
    return () =>
      ipcRenderer.removeListener(debugSettingsIpcChannels.billingPreviewChanged, listener);
  },
  onShowBillingDialog: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on(debugSettingsIpcChannels.showBillingDialog, listener);
    return () => ipcRenderer.removeListener(debugSettingsIpcChannels.showBillingDialog, listener);
  },
  onSignedOutPreviewChanged: (
    callback: (enabled: boolean) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: unknown): void => {
      if (typeof enabled === "boolean") callback(enabled);
    };
    ipcRenderer.on(debugSettingsIpcChannels.signedOutPreviewChanged, listener);
    return () =>
      ipcRenderer.removeListener(debugSettingsIpcChannels.signedOutPreviewChanged, listener);
  },
  onDemoTimeChanged: (
    callback: (enabled: boolean) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: unknown): void => {
      if (typeof enabled === "boolean") callback(enabled);
    };
    ipcRenderer.on(debugSettingsIpcChannels.demoTimeChanged, listener);
    return () =>
      ipcRenderer.removeListener(debugSettingsIpcChannels.demoTimeChanged, listener);
  },
  onWindowsClientSpoofChanged: (
    callback: (enabled: boolean) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: unknown): void => {
      if (typeof enabled === "boolean") callback(enabled);
    };
    ipcRenderer.on(debugSettingsIpcChannels.windowsClientSpoofChanged, listener);
    return () =>
      ipcRenderer.removeListener(
        debugSettingsIpcChannels.windowsClientSpoofChanged,
        listener
      );
  },
  onContentZoom: (callback: (command: ContentZoomCommand) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: unknown): void => {
      if (isContentZoomCommand(command)) callback(command);
    };
    ipcRenderer.on(contentZoomChannel, listener);
    return () => ipcRenderer.removeListener(contentZoomChannel, listener);
  },
  getNativeSourceStatus: (): Promise<NativeSourceStatus> =>
    invokeMain("native-source:status"),
  openDocument: (): Promise<OpenDocumentResult> =>
    invokeMain("document:open"),
  openDroppedDocuments: (files: readonly File[]): Promise<OpenDocumentResult[]> => {
    const paths = Array.from(files).slice(0, 20).flatMap((file) => {
      try {
        const path = webUtils.getPathForFile(file);
        return path ? [path] : [];
      } catch {
        return [];
      }
    });
    return invokeMain("document:open-dropped", paths);
  },
  saveDocument: (
    path: string | undefined,
    data: LooperDocumentData
  ): Promise<SaveDocumentResult> =>
    invokeMain("document:save", { path, data }),
  saveDocumentAs: (data: LooperDocumentData): Promise<SaveDocumentResult> =>
    invokeMain("document:save-as", data),
  exportDocument: (suggestedName: string, content: string): Promise<SaveDocumentResult> =>
    invokeMain("document:export", { suggestedName, content }),
  exportSheets: (sheets: ExportSheetRequest[]): Promise<ExportSheetsResult> =>
    invokeMain("document:export-all", sheets),
  fetchStockQuotes: (symbols: readonly string[]): Promise<StockQuoteMap> =>
    invokeMain("stock-quotes:fetch", [...symbols]),
  setThemeSource: (theme: AppTheme): Promise<void> =>
    invokeMain("theme:set-source", theme),
  getSheetStorageSettings: (): Promise<SheetStorageSettings> =>
    invokeMain(sheetStorageIpcChannels.getSettings),
  setSheetStorageProvider: (
    provider: SheetStorageProvider,
    promptForDirectory = false
  ): Promise<SheetStorageSettings> =>
    invokeMain(
      sheetStorageIpcChannels.setProvider,
      provider,
      promptForDirectory
    ),
  onSheetStorageSettingsChanged: (
    callback: (settings: SheetStorageSettings) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: SheetStorageSettings
    ): void => callback(settings);
    ipcRenderer.on(sheetStorageIpcChannels.settingsChanged, listener);
    return () =>
      ipcRenderer.removeListener(sheetStorageIpcChannels.settingsChanged, listener);
  },
  revealLocalSheetDirectory: (): Promise<void> =>
    invokeMain(sheetStorageIpcChannels.revealLocalDirectory),
  listLocalSheets: (): Promise<LocalSheet[]> =>
    invokeMain(sheetStorageIpcChannels.listLocalSheets),
  createLocalSheet: (input: CreateLocalSheetInput): Promise<LocalSheet> =>
    invokeMain(sheetStorageIpcChannels.createLocalSheet, input),
  updateLocalSheet: (input: UpdateLocalSheetInput): Promise<LocalSheet> =>
    invokeMain(sheetStorageIpcChannels.updateLocalSheet, input),
  deleteLocalSheet: (input: DeleteLocalSheetInput): Promise<void> =>
    invokeMain(sheetStorageIpcChannels.deleteLocalSheet, input),
  cancelGoogleSignIn: (): Promise<void> =>
    invokeMain(cloudIpcChannels.cancelGoogleSignIn),
  getCloudConfiguration: (): Promise<CloudConfiguration> =>
    invokeMain(cloudIpcChannels.getConfiguration),
  getAccount: (): Promise<AccountSummary | null> =>
    invokeMain(cloudIpcChannels.getAccount),
  getBillingStatus: (): Promise<BillingStatus> =>
    invokeMain(billingIpcChannels.getStatus),
  startBillingCheckout: (product: SheetPackProduct): Promise<void> =>
    invokeMain(billingIpcChannels.startCheckout, product),
  onBillingCheckoutCompleted: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on(billingIpcChannels.checkoutCompleted, listener);
    return () => ipcRenderer.removeListener(billingIpcChannels.checkoutCompleted, listener);
  },
  requestEmailCode: (email: string): Promise<void> =>
    invokeMain(cloudIpcChannels.requestEmailCode, email),
  signInWithGoogle: (): Promise<AccountSummary> =>
    invokeMain(cloudIpcChannels.signInWithGoogle),
  verifyEmailCode: (email: string, code: string): Promise<AccountSummary> =>
    invokeMain(cloudIpcChannels.verifyEmailCode, email, code),
  deleteAccount: (): Promise<void> => invokeMain(cloudIpcChannels.deleteAccount),
  signOut: (): Promise<void> => invokeMain(cloudIpcChannels.signOut),
  listCloudSheets: (): Promise<CloudSheet[]> =>
    invokeMain(cloudIpcChannels.listSheets),
  listCachedCloudSheets: (): Promise<CloudSheet[]> =>
    invokeMain(cloudIpcChannels.listCachedSheets),
  replaceCachedCloudSheets: (sheets: CloudSheet[]): Promise<void> =>
    invokeMain(cloudIpcChannels.replaceCachedSheets, sheets),
  cacheCloudSheet: (sheet: CloudSheet): Promise<void> =>
    invokeMain(cloudIpcChannels.cacheSheet, sheet),
  deleteCachedCloudSheet: (input: DeleteCloudSheetDraftInput): Promise<void> =>
    invokeMain(cloudIpcChannels.deleteCachedSheet, input),
  getCloudSheet: (id: string): Promise<CloudSheet | undefined> =>
    invokeMain(cloudIpcChannels.getSheet, id),
  getSharedCloudSheet: (shareToken: string): Promise<CloudSheet | null> =>
    invokeMain(cloudIpcChannels.getSharedSheet, shareToken),
  listCloudDrafts: (): Promise<CloudSheetDraft[]> =>
    invokeMain(cloudIpcChannels.listDrafts),
  saveCloudDraft: (input: SaveCloudSheetDraftInput): Promise<CloudSheetDraft> =>
    invokeMain(cloudIpcChannels.saveDraft, input),
  deleteCloudDraft: (input: DeleteCloudSheetDraftInput): Promise<void> =>
    invokeMain(cloudIpcChannels.deleteDraft, input),
  createCloudSheet: (input: CreateCloudSheetInput): Promise<CloudSheet> =>
    invokeMain(cloudIpcChannels.createSheet, input),
  updateCloudSheet: (input: UpdateCloudSheetInput): Promise<CloudSheet> =>
    invokeMain(cloudIpcChannels.updateSheet, input),
  updateSharedCloudSheet: (input: UpdateSharedCloudSheetInput): Promise<CloudSheet> =>
    invokeMain(cloudIpcChannels.updateSharedSheet, input),
  copyShareableUrl: (input: CopyShareableUrlInput): Promise<string> =>
    invokeMain(cloudIpcChannels.copyShareableUrl, input),
  deleteCloudSheet: (input: DeleteCloudSheetInput): Promise<void> =>
    invokeMain(cloudIpcChannels.deleteSheet, input)
};

contextBridge.exposeInMainWorld("looper", looperApi);

export type LooperApi = typeof looperApi;
