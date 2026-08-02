import type {
  CloudAccountApi,
  CloudConfiguration,
  CloudSheet,
  CopyShareableUrlInput
} from "../../electron/src/shared/cloudAccount";
import type {
  AdminAccessStatus,
  AdminMfaPreparation,
  AdminOverview
} from "../../electron/src/shared/admin";
import type {
  ApplicationSettingsCommand,
  ApplicationSettingsMenuState
} from "../../electron/src/shared/applicationSettings";
import type { AppUpdateState } from "../../electron/src/shared/appUpdates";
import type {
  BillingStatus,
  SheetPackProduct
} from "../../electron/src/shared/billing";
import type { ContentZoomCommand } from "../../electron/src/shared/contentZoom";
import type { BillingPreviewMode } from "../../electron/src/shared/debugSettings";
import type {
  CreateLocalSheetInput,
  DeleteLocalSheetInput,
  LocalSheet,
  SheetStorageProvider,
  SheetStorageSettings,
  UpdateLocalSheetInput
} from "../../electron/src/shared/sheetStorage";
import type {
  LooperDocumentData,
  StockQuoteMap
} from "../../electron/src/renderer/src/looperEngine";

type NativeSourceStatus = Readonly<{
  available: boolean;
  checkedAt: string;
  path: string;
  reason: string;
}>;

type OpenDocumentResult =
  | Readonly<{ canceled: true }>
  | Readonly<{ canceled: false; data: LooperDocumentData; path: string }>;

type SaveDocumentResult =
  | Readonly<{ canceled: true }>
  | Readonly<{ canceled: false; path: string }>;

type ExportSheetRequest = Readonly<{
  content: string;
  suggestedName: string;
}>;

type ExportSheetsResult =
  | Readonly<{ canceled: true }>
  | Readonly<{ canceled: false; count: number; path: string }>;

export type BrowserLooperApi = CloudAccountApi &
  Readonly<{
    platform: "web";
    getWindowFullScreen: () => Promise<boolean>;
    onWindowFullScreenChanged: (
      callback: (fullScreen: boolean) => void
    ) => () => void;
    openAdminPanel: () => Promise<void>;
    getAdminAccess: () => Promise<AdminAccessStatus>;
    prepareAdminMfa: () => Promise<AdminMfaPreparation>;
    verifyAdminMfa: (code: string) => Promise<void>;
    cancelAdminMfa: () => Promise<void>;
    onAdminAccessChanged: (
      callback: (status: AdminAccessStatus) => void
    ) => () => void;
    getAdminOverview: (page?: number) => Promise<AdminOverview>;
    getAdminSheet: (sheetId: string) => Promise<CloudSheet>;
    updateApplicationSettingsMenu: (
      state: ApplicationSettingsMenuState
    ) => Promise<void>;
    onApplicationSettingsCommand: (
      callback: (command: ApplicationSettingsCommand) => void
    ) => () => void;
    getSignedOutPreview: () => Promise<boolean>;
    getDebugSettingsAvailable: () => Promise<boolean>;
    getDemoTime: () => Promise<boolean>;
    setDemoTime: (enabled: boolean) => Promise<boolean>;
    setSignedOutPreview: (enabled: boolean) => Promise<boolean>;
    getBillingPreview: () => Promise<BillingPreviewMode>;
    setBillingPreview: (mode: BillingPreviewMode) => Promise<BillingPreviewMode>;
    getUpdateButtonPreview: () => Promise<boolean>;
    setUpdateButtonPreview: (enabled: boolean) => Promise<boolean>;
    getWindowsClientSpoof: () => Promise<boolean>;
    setWindowsClientSpoof: (enabled: boolean) => Promise<boolean>;
    getAppUpdateState: () => Promise<AppUpdateState>;
    installAppUpdate: () => Promise<boolean>;
    onAppUpdateStateChanged: (
      callback: (state: AppUpdateState) => void
    ) => () => void;
    onBillingPreviewChanged: (
      callback: (mode: BillingPreviewMode) => void
    ) => () => void;
    onShowBillingDialog: (callback: () => void) => () => void;
    onSignedOutPreviewChanged: (
      callback: (enabled: boolean) => void
    ) => () => void;
    onDemoTimeChanged: (callback: (enabled: boolean) => void) => () => void;
    onWindowsClientSpoofChanged: (
      callback: (enabled: boolean) => void
    ) => () => void;
    onContentZoom: (callback: (command: ContentZoomCommand) => void) => () => void;
    getNativeSourceStatus: () => Promise<NativeSourceStatus>;
    openDocument: () => Promise<OpenDocumentResult>;
    openDroppedDocuments: (
      files: readonly File[]
    ) => Promise<OpenDocumentResult[]>;
    saveDocument: (
      path: string | undefined,
      data: LooperDocumentData
    ) => Promise<SaveDocumentResult>;
    saveDocumentAs: (data: LooperDocumentData) => Promise<SaveDocumentResult>;
    exportDocument: (
      suggestedName: string,
      content: string
    ) => Promise<SaveDocumentResult>;
    exportSheets: (sheets: ExportSheetRequest[]) => Promise<ExportSheetsResult>;
    fetchStockQuotes: (symbols: readonly string[]) => Promise<StockQuoteMap>;
    setThemeSource: (theme: "dark" | "light" | "system") => Promise<void>;
    getSheetStorageSettings: () => Promise<SheetStorageSettings>;
    setSheetStorageProvider: (
      provider: SheetStorageProvider,
      promptForDirectory?: boolean
    ) => Promise<SheetStorageSettings>;
    onSheetStorageSettingsChanged: (
      callback: (settings: SheetStorageSettings) => void
    ) => () => void;
    revealLocalSheetDirectory: () => Promise<void>;
    listLocalSheets: () => Promise<LocalSheet[]>;
    createLocalSheet: (input: CreateLocalSheetInput) => Promise<LocalSheet>;
    updateLocalSheet: (input: UpdateLocalSheetInput) => Promise<LocalSheet>;
    deleteLocalSheet: (input: DeleteLocalSheetInput) => Promise<void>;
    getBillingStatus: () => Promise<BillingStatus>;
    startBillingCheckout: (product: SheetPackProduct) => Promise<void>;
    onBillingCheckoutCompleted: (callback: () => void) => () => void;
  }>;

declare global {
  interface Window {
    looper: BrowserLooperApi;
  }
}

class PublicDemoUnavailableError extends Error {
  constructor() {
    super("This action is unavailable in the public Looper demo.");
    this.name = "PublicDemoUnavailableError";
  }
}

function unavailable(): never {
  throw new PublicDemoUnavailableError();
}

function noSubscription(): () => void {
  return () => {};
}

function safeFileName(value: string, extension: string): string {
  const stem = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9 _.-]+/g, "")
    .trim()
    .slice(0, 100) || "Looper";
  return `${stem}.${extension}`;
}

function downloadText(
  suggestedName: string,
  content: string,
  extension: string,
  type: string
): SaveDocumentResult {
  const fileName = safeFileName(suggestedName, extension);
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return { canceled: false, path: `browser-download://${fileName}` };
}

function normalizeMarketSymbols(symbols: readonly string[]): string[] {
  return [
    ...new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[_A-Z][_A-Z0-9]*$/.test(symbol))
    )
  ].slice(0, 32);
}

async function fetchStockQuotes(symbols: readonly string[]): Promise<StockQuoteMap> {
  const requested = normalizeMarketSymbols(symbols);
  if (requested.length === 0) return {};

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("/api/v1/market-data", {
      body: JSON.stringify({ symbols: requested }),
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    const payload = (await response.json()) as {
      quotes?: Record<string, { price?: unknown }>;
    };
    if (!response.ok || !payload.quotes) {
      throw new Error("Market data is temporarily unavailable.");
    }

    const requestedSet = new Set(requested);
    const quotes: StockQuoteMap = {};
    for (const [symbol, quote] of Object.entries(payload.quotes)) {
      if (!requestedSet.has(symbol) || typeof quote.price !== "number") continue;
      if (!Number.isFinite(quote.price)) continue;
      quotes[symbol] = { price: quote.price, symbol };
    }
    return quotes;
  } catch (error) {
    if (error instanceof Error && error.message === "Market data is temporarily unavailable.") {
      throw error;
    }
    throw new Error("Market data is temporarily unavailable.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function createBrowserLooperApi(): BrowserLooperApi {
  const cloudConfiguration: CloudConfiguration = {
    apiConfigured: false,
    authConfigured: false,
    configured: false,
    secureStorageAvailable: false
  };
  const disabledBillingStatus: BillingStatus = {
    billingConfigured: false,
    canCreateSheet: false,
    canPurchaseSheets: false,
    sheetCount: 0,
    sheetLimit: 0,
    unusedSheetCount: 0
  };

  return {
    platform: "web",
    async getWindowFullScreen() { return false; },
    onWindowFullScreenChanged: noSubscription,
    async openAdminPanel() { unavailable(); },
    async getAdminAccess() { return "denied"; },
    async prepareAdminMfa() { unavailable(); },
    async verifyAdminMfa() { unavailable(); },
    async cancelAdminMfa() {},
    onAdminAccessChanged: noSubscription,
    async getAdminOverview() { unavailable(); },
    async getAdminSheet() { unavailable(); },
    async updateApplicationSettingsMenu() {},
    onApplicationSettingsCommand: noSubscription,
    async getSignedOutPreview() { return false; },
    async getDebugSettingsAvailable() { return false; },
    async getDemoTime() { return false; },
    async setDemoTime() { return false; },
    async setSignedOutPreview() { return false; },
    async getBillingPreview() { return "live"; },
    async setBillingPreview() { return "live"; },
    async getUpdateButtonPreview() { return false; },
    async setUpdateButtonPreview() { return false; },
    async getWindowsClientSpoof() { return false; },
    async setWindowsClientSpoof() { return false; },
    async getAppUpdateState() { return { status: "idle" }; },
    async installAppUpdate() { return false; },
    onAppUpdateStateChanged: noSubscription,
    onBillingPreviewChanged: noSubscription,
    onShowBillingDialog: noSubscription,
    onSignedOutPreviewChanged: noSubscription,
    onDemoTimeChanged: noSubscription,
    onWindowsClientSpoofChanged: noSubscription,
    onContentZoom: noSubscription,
    async getNativeSourceStatus() {
      return {
        available: false,
        checkedAt: new Date().toISOString(),
        path: "",
        reason: "Native source access is unavailable in the public demo."
      };
    },
    async openDocument() { return { canceled: true }; },
    async openDroppedDocuments(files) {
      return files.map(() => ({ canceled: true as const }));
    },
    async saveDocument(_path, data) {
      return downloadText(
        data.title,
        `${JSON.stringify(data, null, 2)}\n`,
        "loop",
        "application/json"
      );
    },
    async saveDocumentAs(data) {
      return downloadText(
        data.title,
        `${JSON.stringify(data, null, 2)}\n`,
        "loop",
        "application/json"
      );
    },
    async exportDocument(suggestedName, content) {
      return downloadText(suggestedName, content, "csv", "text/csv;charset=utf-8");
    },
    async exportSheets(sheets) {
      for (const sheet of sheets) {
        downloadText(sheet.suggestedName, sheet.content, "csv", "text/csv;charset=utf-8");
      }
      return { canceled: false, count: sheets.length, path: "browser-downloads" };
    },
    fetchStockQuotes,
    async setThemeSource() {},
    async getSheetStorageSettings() { return { provider: "local" }; },
    async setSheetStorageProvider() { unavailable(); },
    onSheetStorageSettingsChanged: noSubscription,
    async revealLocalSheetDirectory() { unavailable(); },
    async listLocalSheets() { return []; },
    async createLocalSheet() { unavailable(); },
    async updateLocalSheet() { unavailable(); },
    async deleteLocalSheet() { unavailable(); },
    async cancelGoogleSignIn() {},
    async getCloudConfiguration() { return cloudConfiguration; },
    async getAccount() { return null; },
    async requestEmailCode() { unavailable(); },
    async signInWithGoogle() { unavailable(); },
    async verifyEmailCode() { unavailable(); },
    async deleteAccount() { unavailable(); },
    async signOut() {},
    async listCloudSheets() { return []; },
    async listCachedCloudSheets() { return []; },
    async replaceCachedCloudSheets() {},
    async cacheCloudSheet() {},
    async deleteCachedCloudSheet() {},
    async getCloudSheet() { return undefined; },
    async getSharedCloudSheet() { return null; },
    async createCloudSheet() { unavailable(); },
    async updateCloudSheet() { unavailable(); },
    async updateSharedCloudSheet() { unavailable(); },
    async copyShareableUrl(input: CopyShareableUrlInput) {
      return new URL(`/s/${input.shareToken}`, window.location.origin).toString();
    },
    async deleteCloudSheet() { unavailable(); },
    async listCloudDrafts() { return []; },
    async saveCloudDraft() { unavailable(); },
    async deleteCloudDraft() {},
    async getBillingStatus() { return disabledBillingStatus; },
    async startBillingCheckout() { unavailable(); },
    onBillingCheckoutCompleted: noSubscription
  };
}
