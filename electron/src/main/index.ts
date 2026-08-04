import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  MenuItem,
  nativeTheme,
  net,
  protocol,
  safeStorage,
  shell
} from "electron";
import electronUpdater from "electron-updater";
import { access, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CloudAccountError,
  CloudAccountService,
  createAuthStorageWithEphemeralFallback,
  createEncryptionProviderWithSynchronousFallback,
  type EncryptionProvider
} from "./cloudAccount";
import {
  CloudDraftBoundary,
  EncryptedCloudDraftStore
} from "./cloudDrafts";
import {
  CloudSheetCacheBoundary,
  EncryptedCloudSheetCacheStore
} from "./cloudCache";
import { createEncryptionProviderWithLocalKeyFallback } from "./localEncryption";
import { createMarketDataClient } from "./marketData";
import {
  findDisallowedPackagedChromiumSwitch,
  isTrustedPackagedRendererDocumentUrl,
  packagedRendererEntryUrl,
  packagedRendererScheme,
  resolvePackagedRendererRequestPath,
  resolveDevRendererUrl
} from "./startupSecurity";
import {
  cloudIpcChannels,
  type AccountSummary
} from "../shared/cloudAccount";
import {
  contentZoomChannel,
  contentZoomCommandForKeyInput
} from "../shared/contentZoom";
import { debugSettingsIpcChannels } from "../shared/debugSettings";
import {
  billingPreviewModes,
  isBillingPreviewMode,
  type BillingPreviewMode
} from "../shared/debugSettings";
import { billingIpcChannels } from "../shared/billing";
import {
  applicationSettingsIpcChannels,
  parseApplicationSettingsMenuState,
  type ApplicationSettingsCommand,
  type ApplicationSettingsMenuState,
  type ApplicationTheme
} from "../shared/applicationSettings";
import {
  appUpdateIpcChannels,
  idleAppUpdateState,
  type AppUpdateState
} from "../shared/appUpdates";
import {
  shouldStartMacAppUpdates,
  startMacAppUpdates
} from "./appUpdates";
import {
  LocalSheetStore,
  SheetStorageSettingsStore
} from "./localSheets";
import { safeFileName } from "./fileNames";
import {
  normalizeLocalDocumentImportPaths,
  readLocalDocumentImport
} from "./localDocumentImport";
import {
  isSheetStorageProvider,
  sheetStorageIpcChannels,
  type SheetStorageSettings
} from "../shared/sheetStorage";
import {
  looperCreatorUrl,
  looperLicenseUrl,
  looperSourceUrl
} from "../shared/openSource";
import {
  isLooperPublicPageUrl,
  isLooperSupportEmailUrl,
  looperPrivacyUrl,
  looperSupportEmail,
  looperSupportUrl,
  looperTermsUrl
} from "../shared/product";
import {
  adminIpcChannels,
  type AdminAccessStatus
} from "../shared/admin";
import { windowStateIpcChannels } from "../shared/windowState";

declare const __LOOPER_INTERNAL_DEBUG_BUILD__: boolean;

const mainDir = dirname(fileURLToPath(import.meta.url));
const packagedRendererRoot = join(mainDir, "../renderer");
protocol.registerSchemesAsPrivileged([
  {
    scheme: packagedRendererScheme,
    privileges: {
      secure: true,
      standard: true
    }
  }
]);
const devRendererUrl = resolveDevRendererUrl(
  process.env.ELECTRON_RENDERER_URL,
  app.isPackaged
);
const disallowedPackagedChromiumSwitch =
  findDisallowedPackagedChromiumSwitch(app.commandLine, app.isPackaged);
if (disallowedPackagedChromiumSwitch) {
  console.error(
    `Refusing to start packaged Looper with --${disallowedPackagedChromiumSwitch}.`
  );
  app.exit(1);
}
const isDev = devRendererUrl !== undefined;
const isInternalDebugBuild =
  isDev || __LOOPER_INTERNAL_DEBUG_BUILD__;
const openSourceProduct = true;
const nativeCheckoutPath = resolve(process.cwd(), "..", "nativemac");
const googleSignInRedirectUrl = "looper://auth/callback";
const googleSignInTimeoutMs = 5 * 60 * 1000;
const updateChannel =
  import.meta.env?.MAIN_VITE_UPDATE_CHANNEL ??
  process.env.MAIN_VITE_UPDATE_CHANNEL;
const { autoUpdater } = electronUpdater;
const minimumUpdateProgressPresentationMs = 800;
const updateDownloadFailureMessage =
  "Looper couldn't download the update. Check your internet connection and try again.";
nativeTheme.themeSource = "system";
let mainWindow: BrowserWindow | undefined;
let cloudAccountService: CloudAccountService | undefined;
let cloudDraftBoundary: CloudDraftBoundary | undefined;
let cloudSheetCacheBoundary: CloudSheetCacheBoundary | undefined;
let platformEncryptionProvider: EncryptionProvider | undefined;
let sheetStorageSettingsStore: SheetStorageSettingsStore | undefined;
let verifiedCloudAccount: AccountSummary | null = null;
let verifiedAdminAccess = false;
let verifiedAdminAccessStatus: AdminAccessStatus = "denied";
let adminAccessVerificationRun = 0;
let pendingAdminAccessVerification:
  | Readonly<{
      accountId: string;
      result: Promise<AdminAccessStatus>;
      run: number;
    }>
  | undefined;
let demoTimeEnabled = false;
let signedOutPreviewEnabled = false;
let billingPreviewMode: BillingPreviewMode = "live";
let updateButtonPreviewEnabled = false;
let windowsClientSpoofEnabled = false;
let actualAppUpdateState: AppUpdateState = idleAppUpdateState;
let appUpdateDownloadStartedAt = 0;
let applicationSettingsMenuState: ApplicationSettingsMenuState = {
  alwaysShowDownloadAppButton: false,
  defaultDecimalPlaces: 2,
  isSigningOut: false,
  sheetCount: 0,
  startupView: "last-sheet",
  theme: "system"
};
let pendingGoogleSignIn:
  | {
      reject: (error: Error) => void;
      resolve: (account: AccountSummary) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  | undefined;

type NativeSourceStatus = {
  available: boolean;
  path: string;
  reason: string;
  checkedAt: string;
};

type LooperDocumentData = {
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

type OpenDocumentResult =
  | { canceled: true }
  | { canceled: false; path: string; data: LooperDocumentData };

type SaveDocumentResult =
  | { canceled: true }
  | { canceled: false; path: string };

type SaveDocumentRequest = {
  path?: string;
  data: LooperDocumentData;
};

type ExportDocumentRequest = {
  suggestedName: string;
  content: string;
};

type ExportSheetsResult =
  | { canceled: true }
  | { canceled: false; count: number; path: string };

const marketDataClient = createMarketDataClient();
const authorizedDocumentSavePaths = new Set<string>();

async function removeLegacyMarketDataSettings(): Promise<void> {
  try {
    await unlink(join(app.getPath("userData"), "market-data-settings.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not remove obsolete market-data credentials.");
    }
  }
}

function normalizeResultSortMode(value: unknown): LooperDocumentData["resultSortMode"] {
  return value === "ascending" || value === "descending" ? value : "manual";
}

function normalizeDecimalPlaces(value: unknown): number {
  const places = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(places)) return 2;
  return Math.max(0, Math.min(3, Math.trunc(places)));
}

async function getNativeSourceStatus(): Promise<NativeSourceStatus> {
  const gitPath = join(nativeCheckoutPath, ".git");

  try {
    const gitStat = await stat(gitPath);
    await access(gitPath, constants.R_OK);

    return {
      available: gitStat.isDirectory(),
      path: nativeCheckoutPath,
      reason: gitStat.isDirectory()
        ? "Native checkout detected."
        : "The native source path exists, but .git is not a directory.",
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      available: false,
      path: nativeCheckoutPath,
      reason: "Native checkout is not available yet.",
      checkedAt: new Date().toISOString()
    };
  }
}

function normalizeDocumentPayload(raw: string): LooperDocumentData {
  try {
    const parsed = JSON.parse(raw) as Partial<LooperDocumentData>;
    if (typeof parsed.text === "string") {
      const loopCount = Number.isFinite(parsed.loopCount) ? Number(parsed.loopCount) : undefined;
      return {
        title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().replace(/\.loop$/i, "") : "Untitled",
        text: parsed.text,
        fontScale: Number(parsed.fontScale ?? 0),
        decimalPlaces: normalizeDecimalPlaces(parsed.decimalPlaces),
        loopCount,
        loopPeriod: parsed.loopPeriod ?? (loopCount === 0 ? "None" : "Year"),
        loopedLines: Array.isArray(parsed.loopedLines) ? parsed.loopedLines : [0],
        loopSidebarDividerLines: Array.isArray(parsed.loopSidebarDividerLines)
          ? parsed.loopSidebarDividerLines
          : [],
        isLoopVariablePublished: parsed.isLoopVariablePublished !== false,
        // Legacy field retained for saved-document compatibility.
        isLoopEnabled: true,
        isResultsHidden: Boolean(parsed.isResultsHidden),
        resultSortMode: normalizeResultSortMode(parsed.resultSortMode),
        stockSymbols: Array.isArray(parsed.stockSymbols) ? parsed.stockSymbols : []
      };
    }
  } catch {
    return {
      title: "Untitled",
      text: raw,
      fontScale: 0,
      decimalPlaces: 2,
      loopCount: undefined,
      loopPeriod: "Year",
      loopedLines: [0],
      loopSidebarDividerLines: [],
      isLoopVariablePublished: true,
      isLoopEnabled: true,
      isResultsHidden: false,
      resultSortMode: "manual",
      stockSymbols: []
    };
  }

  return {
    title: "Untitled",
    text: raw,
    fontScale: 0,
    decimalPlaces: 2,
    loopCount: undefined,
    loopPeriod: "Year",
    loopedLines: [0],
    loopSidebarDividerLines: [],
    isLoopVariablePublished: true,
    isLoopEnabled: true,
    isResultsHidden: false,
    resultSortMode: "manual",
    stockSymbols: []
  };
}

async function openDocument(): Promise<OpenDocumentResult> {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    title: "Open Looper File",
    properties: ["openFile"],
    filters: [
      { name: "Looper Files", extensions: ["loop"] }
    ]
  } satisfies Electron.OpenDialogOptions;
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const [opened] = await openDocumentPaths(result.filePaths);
  return opened;
}

async function openDocumentPaths(rawPaths: unknown): Promise<OpenDocumentResult[]> {
  const paths = normalizeLocalDocumentImportPaths(rawPaths);
  const opened: OpenDocumentResult[] = [];
  for (const path of paths) {
    const data = normalizeDocumentPayload(await readLocalDocumentImport(path));
    authorizedDocumentSavePaths.add(resolve(path));
    opened.push({
      canceled: false,
      path,
      data
    });
  }
  return opened;
}

async function saveDocument(_event: Electron.IpcMainInvokeEvent, request: SaveDocumentRequest): Promise<SaveDocumentResult> {
  let savePath = typeof request.path === "string" ? resolve(request.path) : undefined;

  if (savePath) {
    const extension = extname(savePath).toLowerCase();
    if (
      !authorizedDocumentSavePaths.has(savePath) ||
      (extension !== ".loop" && extension !== ".json")
    ) {
      throw new Error("The document path was not approved by Looper.");
    }
  } else {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = {
      title: "Save Looper Document",
      defaultPath: `${safeFileName(request.data.title, "Untitled")}.loop`,
      filters: [
        { name: "Looper Documents", extensions: ["loop"] },
        { name: "JSON", extensions: ["json"] }
      ]
    } satisfies Electron.SaveDialogOptions;
    const result = focusedWindow
      ? await dialog.showSaveDialog(focusedWindow, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    savePath = resolve(result.filePath);
    authorizedDocumentSavePaths.add(savePath);
  }

  await writeFile(savePath, `${JSON.stringify(request.data, null, 2)}\n`, "utf8");
  return { canceled: false, path: savePath };
}

async function exportDocument(
  _event: Electron.IpcMainInvokeEvent,
  request: ExportDocumentRequest
): Promise<SaveDocumentResult> {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    title: "Export Looper CSV",
    defaultPath: `${safeFileName(request.suggestedName, "Untitled")}.csv`,
    filters: [
      { name: "CSV Spreadsheet", extensions: ["csv"] },
      { name: "All Files", extensions: ["*"] }
    ]
  } satisfies Electron.SaveDialogOptions;
  const result = focusedWindow
    ? await dialog.showSaveDialog(focusedWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await writeFile(result.filePath, request.content, "utf8");
  return { canceled: false, path: result.filePath };
}

function parseExportDocumentRequests(
  value: unknown
): ExportDocumentRequest[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10_000) {
    return undefined;
  }
  const requests: ExportDocumentRequest[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return undefined;
    const request = candidate as Record<string, unknown>;
    if (
      typeof request.suggestedName !== "string" ||
      typeof request.content !== "string"
    ) {
      return undefined;
    }
    requests.push({
      suggestedName: request.suggestedName,
      content: request.content
    });
  }
  return requests;
}

async function csvExportPath(
  directoryPath: string,
  suggestedName: string,
  reservedNames: Set<string>
): Promise<string> {
  const baseName = safeFileName(suggestedName, "Untitled");
  let suffix = 1;
  while (true) {
    const fileName = `${baseName}${suffix === 1 ? "" : ` ${suffix}`}.csv`;
    const normalizedName = fileName.toLocaleLowerCase();
    const candidatePath = join(directoryPath, fileName);
    if (!reservedNames.has(normalizedName)) {
      try {
        await access(candidatePath, constants.F_OK);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reservedNames.add(normalizedName);
          return candidatePath;
        }
        throw error;
      }
    }
    suffix += 1;
  }
}

async function exportAllDocuments(
  rawRequests: unknown
): Promise<ExportSheetsResult> {
  const requests = parseExportDocumentRequests(rawRequests);
  if (!requests) throw new Error("The sheet export request is invalid.");

  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    title: "Export All Looper Sheets",
    buttonLabel: "Export",
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"]
  } satisfies Electron.OpenDialogOptions;
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const directoryPath = result.filePaths[0];
  const reservedNames = new Set<string>();
  for (const request of requests) {
    const exportPath = await csvExportPath(
      directoryPath,
      request.suggestedName,
      reservedNames
    );
    await writeFile(exportPath, request.content, "utf8");
  }
  return {
    canceled: false,
    count: requests.length,
    path: directoryPath
  };
}

function getCloudAccountService(): CloudAccountService {
  if (!cloudAccountService) {
    cloudAccountService = new CloudAccountService({
      authStorage: createAuthStorageWithEphemeralFallback({
        encryption: getPlatformEncryptionProvider(),
        filePath: join(app.getPath("userData"), "cloud-account-auth.json")
      })
    });
  }
  return cloudAccountService;
}

function getPlatformEncryptionProvider(): EncryptionProvider {
  if (!platformEncryptionProvider) {
    const systemEncryption =
      createEncryptionProviderWithSynchronousFallback(safeStorage);
    platformEncryptionProvider =
      updateChannel === "stable"
        ? systemEncryption
        : createEncryptionProviderWithLocalKeyFallback({
            keyPath: join(
              app.getPath("userData"),
              ".local-development-encryption-key"
            ),
            platformEncryption: systemEncryption
          });
  }
  return platformEncryptionProvider;
}

function getSheetStorageSettingsStore(): SheetStorageSettingsStore {
  if (!sheetStorageSettingsStore) {
    sheetStorageSettingsStore = new SheetStorageSettingsStore({
      filePath: join(app.getPath("userData"), "sheet-storage-settings.json")
    });
  }
  return sheetStorageSettingsStore;
}

async function getLocalSheetStorageSettings(): Promise<SheetStorageSettings> {
  const settingsStore = getSheetStorageSettingsStore();
  const current = await settingsStore.getSettings();
  const localDirectoryPath =
    current.localDirectoryPath ?? join(app.getPath("documents"), "Looper");
  await new LocalSheetStore({ directoryPath: localDirectoryPath }).listSheets();
  if (
    current.provider === "local" &&
    current.localDirectoryPath === localDirectoryPath
  ) {
    return current;
  }
  const settings = await settingsStore.setSettings("local", localDirectoryPath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(sheetStorageIpcChannels.settingsChanged, settings);
  }
  return settings;
}

async function getLocalSheetStore(): Promise<LocalSheetStore> {
  const settings = await getLocalSheetStorageSettings();
  return new LocalSheetStore({ directoryPath: settings.localDirectoryPath! });
}

async function selectSheetStorageProvider(
  rawProvider: unknown,
  rawPromptForDirectory: unknown
): Promise<SheetStorageSettings> {
  if (!isSheetStorageProvider(rawProvider)) {
    throw new CloudAccountError("The selected sheet storage provider is invalid.");
  }
  if (
    rawPromptForDirectory !== undefined &&
    typeof rawPromptForDirectory !== "boolean"
  ) {
    throw new CloudAccountError("The local folder selection request is invalid.");
  }
  const settingsStore = getSheetStorageSettingsStore();
  const current = await getLocalSheetStorageSettings();
  if (rawProvider !== "local") {
    throw new CloudAccountError(
      "Looper stores sheets locally in the open-source desktop app."
    );
  }

  let localDirectoryPath = current.localDirectoryPath;
  if (!localDirectoryPath || rawPromptForDirectory === true) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = {
      title: "Choose a Folder for Local Looper Sheets",
      buttonLabel: "Use This Folder",
      defaultPath: localDirectoryPath ?? app.getPath("documents"),
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return current;
    localDirectoryPath = result.filePaths[0];
  }

  // Validate the selected folder before making it the active destination.
  await new LocalSheetStore({ directoryPath: localDirectoryPath }).listSheets();
  const settings = await settingsStore.setSettings("local", localDirectoryPath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(sheetStorageIpcChannels.settingsChanged, settings);
  }
  return settings;
}

async function revealLocalSheetDirectory(): Promise<void> {
  const settings = await getLocalSheetStorageSettings();
  const errorMessage = await shell.openPath(settings.localDirectoryPath!);
  if (errorMessage) {
    throw new CloudAccountError("The source folder could not be opened.");
  }
}

function settleGoogleSignIn(
  result: { account: AccountSummary } | { error: Error }
): void {
  const pending = pendingGoogleSignIn;
  if (!pending) return;
  pendingGoogleSignIn = undefined;
  clearTimeout(pending.timeout);
  if ("account" in result) {
    pending.resolve(result.account);
  } else {
    pending.reject(result.error);
  }
}

async function beginGoogleSignIn(): Promise<AccountSummary> {
  if (pendingGoogleSignIn) {
    throw new Error("Google sign-in is already open in your browser.");
  }

  const authorizationUrl = await getCloudAccountService().createGoogleSignInUrl(
    googleSignInRedirectUrl
  );
  const completion = new Promise<AccountSummary>((resolveSignIn, rejectSignIn) => {
    pendingGoogleSignIn = {
      reject: rejectSignIn,
      resolve: resolveSignIn,
      timeout: setTimeout(() => {
        settleGoogleSignIn({
          error: new Error("Google sign-in timed out. Please try again.")
        });
      }, googleSignInTimeoutMs)
    };
  });

  try {
    await shell.openExternal(authorizationUrl);
  } catch {
    settleGoogleSignIn({
      error: new Error("Could not open Google sign-in in your browser.")
    });
  }
  return completion;
}

async function handleGoogleSignInCallback(callbackUrl: string): Promise<void> {
  if (!pendingGoogleSignIn) return;
  try {
    const parsed = new URL(callbackUrl);
    if (
      parsed.protocol !== "looper:" ||
      parsed.hostname !== "auth" ||
      parsed.pathname !== "/callback"
    ) {
      return;
    }
    const account = await getCloudAccountService().completeGoogleSignIn(callbackUrl);
    setVerifiedCloudAccount(account);
    await refreshVerifiedAdminAccess().catch(() => "denied");
    settleGoogleSignIn({ account });
    mainWindow?.show();
    mainWindow?.focus();
  } catch (error) {
    setVerifiedAdminAccess(false);
    settleGoogleSignIn({
      error: error instanceof Error ? error : new Error("Google sign-in failed.")
    });
  }
}

function getCloudDraftBoundary(): CloudDraftBoundary {
  if (!cloudDraftBoundary) {
    cloudDraftBoundary = new CloudDraftBoundary(
      {
        // This cache is populated only by a server-verified session restore or
        // successful OTP exchange. Draft writes stay available offline and do
        // not turn every keystroke into an Auth network request.
        getAccount: async () => verifiedCloudAccount
      },
      new EncryptedCloudDraftStore({
        directoryPath: join(app.getPath("userData"), "cloud-sheet-drafts"),
        encryption: getPlatformEncryptionProvider()
      })
    );
  }
  return cloudDraftBoundary;
}

function getCloudSheetCacheBoundary(): CloudSheetCacheBoundary {
  if (!cloudSheetCacheBoundary) {
    cloudSheetCacheBoundary = new CloudSheetCacheBoundary(
      {
        getAccount: async () => verifiedCloudAccount
      },
      new EncryptedCloudSheetCacheStore({
        directoryPath: join(app.getPath("userData"), "cloud-sheet-cache"),
        encryption: getPlatformEncryptionProvider()
      })
    );
  }
  return cloudSheetCacheBoundary;
}

function isTrustedRendererUrl(value: string): boolean {
  try {
    const candidate = new URL(value);
    if (devRendererUrl) {
      const expected = new URL(devRendererUrl);
      return (
        (candidate.protocol === "http:" || candidate.protocol === "https:") &&
        candidate.origin === expected.origin
      );
    }

    return isTrustedPackagedRendererDocumentUrl(candidate.href);
  } catch {
    return false;
  }
}

function registerPackagedRendererProtocol(): void {
  protocol.handle(packagedRendererScheme, async (request) => {
    if (request.method !== "GET") {
      return new Response(null, { status: 405 });
    }

    const filePath = resolvePackagedRendererRequestPath(
      request.url,
      packagedRendererRoot
    );
    if (!filePath) return new Response(null, { status: 404 });

    try {
      const fileStatus = await stat(filePath);
      if (!fileStatus.isFile()) return new Response(null, { status: 404 });
      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

function assertTrustedIpcSender(event: Electron.IpcMainInvokeEvent): void {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(event.senderFrame.url)
  ) {
    throw new Error("This request did not come from the Looper window.");
  }
}

function registerTrustedIpcHandler<TArguments extends unknown[], TResult>(
  channel: string,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    ...arguments_: TArguments
  ) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, (event, ...arguments_: unknown[]) => {
    assertTrustedIpcSender(event);
    return handler(event, ...(arguments_ as TArguments));
  });
}

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLooperDownload =
      url.hostname === "looper.app" &&
      url.pathname === "/download" &&
      !url.search &&
      !url.hash;
    const isLooperOpenSourcePage =
      url.href === looperSourceUrl || url.href === looperLicenseUrl;
    const isLooperCreatorSite = url.href === looperCreatorUrl;
    const isTwelveDataPricing =
      url.hostname === "twelvedata.com" &&
      (url.pathname === "/pricing" || url.pathname === "/pricing/") &&
      !url.search &&
      !url.hash;
    return (
      (url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        (isLooperDownload ||
          isLooperOpenSourcePage ||
          isLooperCreatorSite ||
          isTwelveDataPricing ||
          isLooperPublicPageUrl(value))) ||
      isLooperSupportEmailUrl(value)
    );
  } catch {
    return false;
  }
}

function registerIpc(): void {
  registerTrustedIpcHandler(windowStateIpcChannels.getFullScreen, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getAvailability,
    () => debugSettingsAreAvailable()
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getDemoTime,
    () => demoTimeEnabled
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getSignedOutPreview,
    () => signedOutPreviewEnabled
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getBillingPreview,
    () => billingPreviewMode
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getUpdateButtonPreview,
    () => updateButtonPreviewEnabled
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.getWindowsClientSpoof,
    () => windowsClientSpoofEnabled
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.setDemoTime,
    (_event, enabled: unknown) => {
      requireDebugSettingsAccess();
      if (typeof enabled !== "boolean") {
        throw new Error("Invalid Demo Time setting.");
      }
      setDemoTimeEnabled(enabled);
      return demoTimeEnabled;
    }
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.setSignedOutPreview,
    (_event, enabled: unknown) => {
      requireDebugSettingsAccess();
      if (typeof enabled !== "boolean") {
        throw new Error("Invalid signed-out preview setting.");
      }
      setSignedOutPreviewEnabled(enabled);
      return signedOutPreviewEnabled;
    }
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.setBillingPreview,
    (_event, mode: unknown) => {
      requireDebugSettingsAccess();
      if (!isBillingPreviewMode(mode)) {
        throw new Error("Invalid billing preview setting.");
      }
      setBillingPreviewMode(mode);
      return billingPreviewMode;
    }
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.setUpdateButtonPreview,
    (_event, enabled: unknown) => {
      requireDebugSettingsAccess();
      if (typeof enabled !== "boolean") {
        throw new Error("Invalid update button preview setting.");
      }
      setUpdateButtonPreviewEnabled(enabled);
      return updateButtonPreviewEnabled;
    }
  );
  registerTrustedIpcHandler(
    debugSettingsIpcChannels.setWindowsClientSpoof,
    (_event, enabled: unknown) => {
      requireDebugSettingsAccess();
      if (typeof enabled !== "boolean") {
        throw new Error("Invalid Windows client spoof setting.");
      }
      setWindowsClientSpoofEnabled(enabled);
      return windowsClientSpoofEnabled;
    }
  );
  registerTrustedIpcHandler(
    appUpdateIpcChannels.getState,
    () => presentedAppUpdateState()
  );
  registerTrustedIpcHandler(
    appUpdateIpcChannels.install,
    () => installDownloadedAppUpdate()
  );
  registerTrustedIpcHandler(
    applicationSettingsIpcChannels.updateMenuState,
    (_event, state: unknown) => {
      const parsedState = parseApplicationSettingsMenuState(state);
      if (!parsedState) throw new Error("Invalid application settings menu state.");
      const themeChanged = parsedState.theme !== applicationSettingsMenuState.theme;
      applicationSettingsMenuState = parsedState;
      if (themeChanged) {
        installApplicationMenu();
      } else {
        updateApplicationSettingsMenu();
      }
    }
  );
  registerTrustedIpcHandler("native-source:status", () => getNativeSourceStatus());
  registerTrustedIpcHandler("document:open", () => openDocument());
  registerTrustedIpcHandler(
    "document:open-dropped",
    (_event, paths: unknown) => openDocumentPaths(paths)
  );
  registerTrustedIpcHandler(
    "document:save",
    (event, request: SaveDocumentRequest) => saveDocument(event, request)
  );
  registerTrustedIpcHandler(
    "document:save-as",
    (event, data: LooperDocumentData) => saveDocument(event, { data })
  );
  registerTrustedIpcHandler(
    "document:export",
    (event, request: ExportDocumentRequest) => exportDocument(event, request)
  );
  registerTrustedIpcHandler(
    "document:export-all",
    (_event, requests: unknown) => exportAllDocuments(requests)
  );
  registerTrustedIpcHandler("theme:set-source", (event, theme: unknown) => {
    const themeSource =
      theme === "light" || theme === "system" ? theme : "dark";
    nativeTheme.themeSource = themeSource;
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    senderWindow?.setBackgroundColor(
      nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff"
    );
  });
  registerTrustedIpcHandler(
    "stock-quotes:fetch",
    (_event, symbols: unknown) => marketDataClient.fetchStockQuotes(symbols)
  );
  registerTrustedIpcHandler(sheetStorageIpcChannels.getSettings, () =>
    getLocalSheetStorageSettings()
  );
  registerTrustedIpcHandler(
    sheetStorageIpcChannels.setProvider,
    (_event, provider: unknown, promptForDirectory: unknown) =>
      selectSheetStorageProvider(provider, promptForDirectory)
  );
  registerTrustedIpcHandler(
    sheetStorageIpcChannels.revealLocalDirectory,
    () => revealLocalSheetDirectory()
  );
  registerTrustedIpcHandler(sheetStorageIpcChannels.listLocalSheets, async () => {
    return (await getLocalSheetStore()).listSheets();
  });
  registerTrustedIpcHandler(
    sheetStorageIpcChannels.createLocalSheet,
    async (_event, input: unknown) =>
      (await getLocalSheetStore()).createSheet(input)
  );
  registerTrustedIpcHandler(
    sheetStorageIpcChannels.updateLocalSheet,
    async (_event, input: unknown) =>
      (await getLocalSheetStore()).updateSheet(input)
  );
  registerTrustedIpcHandler(
    sheetStorageIpcChannels.deleteLocalSheet,
    async (_event, input: unknown) =>
      (await getLocalSheetStore()).deleteSheet(input)
  );
  if (!openSourceProduct) {
  registerTrustedIpcHandler(cloudIpcChannels.cancelGoogleSignIn, () => {
    settleGoogleSignIn({ error: new Error("Google sign-in was canceled.") });
  });
  registerTrustedIpcHandler(cloudIpcChannels.getConfiguration, () =>
    getCloudAccountService().getCloudConfiguration()
  );
  registerTrustedIpcHandler(adminIpcChannels.openPanel, () =>
    openAdminPanel()
  );
  registerTrustedIpcHandler(
    adminIpcChannels.getAccess,
    () => refreshVerifiedAdminAccess()
  );
  registerTrustedIpcHandler(
    adminIpcChannels.prepareMfa,
    () => {
      requireAdminMfaStepUp();
      return getCloudAccountService().prepareAdminMfa();
    }
  );
  registerTrustedIpcHandler(
    adminIpcChannels.verifyMfa,
    async (_event, code: unknown) => {
      requireAdminMfaStepUp();
      await getCloudAccountService().verifyAdminMfa(code);
      const status = await refreshVerifiedAdminAccess();
      if (status !== "granted") {
        throw new CloudAccountError(
          "Authenticator verification did not grant admin access."
        );
      }
    }
  );
  registerTrustedIpcHandler(
    adminIpcChannels.cancelMfa,
    () => getCloudAccountService().cancelAdminMfa()
  );
  registerTrustedIpcHandler(adminIpcChannels.getOverview, async (_event, page: unknown) => {
    requireAdminAccess();
    try {
      return await getCloudAccountService().getAdminOverview(page);
    } catch (error) {
      await refreshAdminAccessAfterPrivilegedFailure();
      throw error;
    }
  });
  registerTrustedIpcHandler(
    adminIpcChannels.getSheet,
    async (_event, sheetId: unknown) => {
      requireAdminAccess();
      try {
        return await getCloudAccountService().getAdminSheet(sheetId);
      } catch (error) {
        await refreshAdminAccessAfterPrivilegedFailure();
        throw error;
      }
    }
  );
  registerTrustedIpcHandler(cloudIpcChannels.getAccount, async () => {
    try {
      const account = await getCloudAccountService().getAccount();
      setVerifiedCloudAccount(account);
      if (account) await refreshVerifiedAdminAccess().catch(() => "denied");
      return account;
    } catch (error) {
      setVerifiedCloudAccount(null);
      throw error;
    }
  });
  registerTrustedIpcHandler(billingIpcChannels.getStatus, () =>
    getCloudAccountService().getBillingStatus()
  );
  registerTrustedIpcHandler(
    billingIpcChannels.startCheckout,
    async (_event, product: unknown) => {
      const url = await getCloudAccountService().createBillingCheckout(product);
      await shell.openExternal(url);
    }
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.requestEmailCode,
    (_event, email: unknown) => getCloudAccountService().requestEmailCode(email)
  );
  registerTrustedIpcHandler(cloudIpcChannels.signInWithGoogle, () =>
    beginGoogleSignIn()
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.verifyEmailCode,
    async (_event, email: unknown, code: unknown) => {
      try {
        const account = await getCloudAccountService().verifyEmailCode(email, code);
        setVerifiedCloudAccount(account);
        await refreshVerifiedAdminAccess().catch(() => "denied");
        return account;
      } catch (error) {
        setVerifiedAdminAccess(false);
        throw error;
      }
    }
  );
  registerTrustedIpcHandler(cloudIpcChannels.deleteAccount, async () => {
    const previousAccount = verifiedCloudAccount;
    setVerifiedAdminAccess(false);
    await cloudDraftBoundary?.waitForPendingWrites();
    await getCloudAccountService().deleteAccount();
    setVerifiedCloudAccount(null);
    if (previousAccount) {
      await getCloudSheetCacheBoundary()
        .clearForOwner(previousAccount.id)
        .catch(() => undefined);
    }
  });
  registerTrustedIpcHandler(cloudIpcChannels.signOut, async () => {
    const previousAccount = verifiedCloudAccount;
    const signOutScope =
      verifiedAdminAccessStatus === "denied" ? "local" : "global";
    setVerifiedAdminAccess(false);
    await cloudDraftBoundary?.waitForPendingWrites();
    await getCloudAccountService().signOut(signOutScope);
    setVerifiedCloudAccount(null);
    if (previousAccount) {
      await getCloudSheetCacheBoundary()
        .clearForOwner(previousAccount.id)
        .catch(() => undefined);
    }
  });
  registerTrustedIpcHandler(cloudIpcChannels.listSheets, () =>
    getCloudAccountService().listCloudSheets()
  );
  registerTrustedIpcHandler(cloudIpcChannels.listCachedSheets, () =>
    getCloudSheetCacheBoundary().listCachedCloudSheets()
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.replaceCachedSheets,
    (_event, sheets: unknown) =>
      getCloudSheetCacheBoundary().replaceCachedCloudSheets(sheets)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.cacheSheet,
    (_event, sheet: unknown) =>
      getCloudSheetCacheBoundary().cacheCloudSheet(sheet)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.deleteCachedSheet,
    (_event, input: unknown) =>
      getCloudSheetCacheBoundary().deleteCachedCloudSheet(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.getSheet,
    (_event, id: unknown) => getCloudAccountService().getCloudSheet(id)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.getSharedSheet,
    (_event, shareToken: unknown) =>
      getCloudAccountService().getSharedCloudSheet(shareToken)
  );
  registerTrustedIpcHandler(cloudIpcChannels.listDrafts, () =>
    getCloudDraftBoundary().listCloudDrafts()
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.saveDraft,
    (_event, input: unknown) => getCloudDraftBoundary().saveCloudDraft(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.deleteDraft,
    (_event, input: unknown) => getCloudDraftBoundary().deleteCloudDraft(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.createSheet,
    (_event, input: unknown) => getCloudAccountService().createCloudSheet(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.updateSheet,
    (_event, input: unknown) => getCloudAccountService().updateCloudSheet(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.updateSharedSheet,
    (_event, input: unknown) => getCloudAccountService().updateSharedCloudSheet(input)
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.copyShareableUrl,
    (_event, input: unknown) => {
      const url = getCloudAccountService().shareableUrl(input);
      clipboard.writeText(url);
      return url;
    }
  );
  registerTrustedIpcHandler(
    cloudIpcChannels.deleteSheet,
    (_event, input: unknown) => getCloudAccountService().deleteCloudSheet(input)
  );
  }
}

function setDemoTimeEnabled(enabled: boolean): void {
  demoTimeEnabled = enabled && debugSettingsAreAvailable();
  if (demoTimeEnabled && signedOutPreviewEnabled) {
    signedOutPreviewEnabled = false;
    const signedOutItem = Menu.getApplicationMenu()?.getMenuItemById(
      "debug-signed-out-preview"
    );
    if (signedOutItem) signedOutItem.checked = false;
    mainWindow?.webContents.send(
      debugSettingsIpcChannels.signedOutPreviewChanged,
      false
    );
  }

  const menuItem = Menu.getApplicationMenu()?.getMenuItemById("debug-demo-time");
  if (menuItem) menuItem.checked = demoTimeEnabled;
  mainWindow?.webContents.send(
    debugSettingsIpcChannels.demoTimeChanged,
    demoTimeEnabled
  );
  updateApplicationSettingsMenu();
}

function setSignedOutPreviewEnabled(enabled: boolean): void {
  signedOutPreviewEnabled = enabled && debugSettingsAreAvailable();
  if (signedOutPreviewEnabled && demoTimeEnabled) {
    demoTimeEnabled = false;
    const demoTimeItem = Menu.getApplicationMenu()?.getMenuItemById(
      "debug-demo-time"
    );
    if (demoTimeItem) demoTimeItem.checked = false;
    mainWindow?.webContents.send(
      debugSettingsIpcChannels.demoTimeChanged,
      false
    );
  }
  const menuItem = Menu.getApplicationMenu()?.getMenuItemById(
    "debug-signed-out-preview"
  );
  if (menuItem) menuItem.checked = signedOutPreviewEnabled;
  mainWindow?.webContents.send(
    debugSettingsIpcChannels.signedOutPreviewChanged,
    signedOutPreviewEnabled
  );
  updateApplicationSettingsMenu();
}

function setBillingPreviewMode(mode: unknown): void {
  if (!isBillingPreviewMode(mode)) return;
  billingPreviewMode = debugSettingsAreAvailable() ? mode : "live";
  for (const candidate of billingPreviewModes) {
    const item = Menu.getApplicationMenu()?.getMenuItemById(
      `debug-billing-${candidate}`
    );
    if (item) item.checked = candidate === billingPreviewMode;
  }
  mainWindow?.webContents.send(
    debugSettingsIpcChannels.billingPreviewChanged,
    billingPreviewMode
  );
}

function presentedAppUpdateState(): AppUpdateState {
  if (updateButtonPreviewEnabled) {
    return {
      preview: true,
      releaseName: "Preview update",
      status: "available"
    };
  }
  return actualAppUpdateState;
}

function broadcastAppUpdateState(): void {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(
      appUpdateIpcChannels.stateChanged,
      presentedAppUpdateState()
    );
  }
}

function setUpdateButtonPreviewEnabled(enabled: boolean): void {
  updateButtonPreviewEnabled = enabled && debugSettingsAreAvailable();
  const menuItem = Menu.getApplicationMenu()?.getMenuItemById(
    "debug-update-button-preview"
  );
  if (menuItem) menuItem.checked = updateButtonPreviewEnabled;
  broadcastAppUpdateState();
}

function setWindowsClientSpoofEnabled(enabled: boolean): void {
  windowsClientSpoofEnabled = enabled && debugSettingsAreAvailable();
  const menuItem = Menu.getApplicationMenu()?.getMenuItemById(
    "debug-spoof-client-as-windows"
  );
  if (menuItem) menuItem.checked = windowsClientSpoofEnabled;
  mainWindow?.webContents.send(
    debugSettingsIpcChannels.windowsClientSpoofChanged,
    windowsClientSpoofEnabled
  );
}

async function installDownloadedAppUpdate(): Promise<boolean> {
  const state = presentedAppUpdateState();
  if (state.status !== "available") {
    throw new Error("No Looper update is available to download.");
  }
  if (state.preview) return false;

  appUpdateDownloadStartedAt = Date.now();
  actualAppUpdateState = {
    preview: false,
    progress: 0,
    releaseName: state.releaseName,
    status: "downloading"
  };
  broadcastAppUpdateState();
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    if (actualAppUpdateState.status === "downloading") {
      actualAppUpdateState = {
        errorMessage: updateDownloadFailureMessage,
        preview: false,
        releaseName: state.releaseName,
        status: "available"
      };
      broadcastAppUpdateState();
    }
    console.warn(
      "Could not download the Looper update.",
      error instanceof Error ? error.message : error
    );
    throw new Error(updateDownloadFailureMessage);
  }
  return true;
}

function sendApplicationSettingsCommand(command: ApplicationSettingsCommand): void {
  mainWindow?.webContents.send(applicationSettingsIpcChannels.command, command);
}

function debugSettingsAreAvailable(): boolean {
  return isInternalDebugBuild || demoTimeEnabled;
}

function requireDebugSettingsAccess(): void {
  if (!debugSettingsAreAvailable()) {
    throw new CloudAccountError(
      "Debug settings are not available in this build."
    );
  }
}

function requireAdminAccess(): void {
  if (demoTimeEnabled || !verifiedCloudAccount || !verifiedAdminAccess) {
    throw new CloudAccountError(
      "Your account does not have verified access to the admin panel."
    );
  }
}

function requireAdminMfaStepUp(): void {
  if (
    demoTimeEnabled ||
    !verifiedCloudAccount ||
    verifiedAdminAccessStatus !== "mfa_required"
  ) {
    throw new CloudAccountError(
      "Your account does not have an active admin verification request."
    );
  }
}

function openAdminPanel(): void {
  requireAdminAccess();
  mainWindow?.show();
  mainWindow?.focus();
  sendApplicationSettingsCommand({ type: "show-admin-panel" });
}

function applyVerifiedAdminAccess(status: AdminAccessStatus): void {
  const nextStatus = verifiedCloudAccount === null ? "denied" : status;
  const nextAccess = nextStatus === "granted";
  if (
    verifiedAdminAccess === nextAccess &&
    verifiedAdminAccessStatus === nextStatus
  ) {
    return;
  }
  verifiedAdminAccess = nextAccess;
  verifiedAdminAccessStatus = nextStatus;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(adminIpcChannels.accessChanged, nextStatus);
  }
  updateApplicationSettingsMenu();
}

function setVerifiedAdminAccess(access: boolean): void {
  if (!access) {
    adminAccessVerificationRun += 1;
    pendingAdminAccessVerification = undefined;
  }
  applyVerifiedAdminAccess(access ? "granted" : "denied");
}

async function refreshVerifiedAdminAccess(): Promise<AdminAccessStatus> {
  const account = verifiedCloudAccount;
  if (!account) {
    setVerifiedAdminAccess(false);
    return "denied";
  }
  if (pendingAdminAccessVerification?.accountId === account.id) {
    return pendingAdminAccessVerification.result;
  }

  const verificationRun = adminAccessVerificationRun + 1;
  adminAccessVerificationRun = verificationRun;
  applyVerifiedAdminAccess("denied");

  const result = (async (): Promise<AdminAccessStatus> => {
    try {
      const status = await getCloudAccountService().getAdminAccess();
      if (
        adminAccessVerificationRun !== verificationRun ||
        verifiedCloudAccount?.id !== account.id
      ) {
        return "denied";
      }
      applyVerifiedAdminAccess(status);
      return status;
    } catch (error) {
      if (adminAccessVerificationRun === verificationRun) {
        setVerifiedAdminAccess(false);
      }
      throw error;
    } finally {
      if (pendingAdminAccessVerification?.run === verificationRun) {
        pendingAdminAccessVerification = undefined;
      }
    }
  })();
  pendingAdminAccessVerification = {
    accountId: account.id,
    result,
    run: verificationRun
  };
  return result;
}

async function refreshAdminAccessAfterPrivilegedFailure(): Promise<void> {
  setVerifiedAdminAccess(false);
  await refreshVerifiedAdminAccess().catch(() => "denied");
}

function setVerifiedCloudAccount(account: AccountSummary | null): void {
  adminAccessVerificationRun += 1;
  pendingAdminAccessVerification = undefined;
  verifiedCloudAccount = account;
  applyVerifiedAdminAccess("denied");
  const debugSettingsAvailable = debugSettingsAreAvailable();
  if (!debugSettingsAvailable) {
    if (applicationSettingsMenuState.alwaysShowDownloadAppButton) {
      applicationSettingsMenuState = {
        ...applicationSettingsMenuState,
        alwaysShowDownloadAppButton: false
      };
      sendApplicationSettingsCommand({
        type: "toggle-always-show-download-app-button"
      });
    }
    setSignedOutPreviewEnabled(false);
    setBillingPreviewMode("live");
    setUpdateButtonPreviewEnabled(false);
    setWindowsClientSpoofEnabled(false);
  }
  updateApplicationSettingsMenu();
}

function setApplicationTheme(theme: ApplicationTheme): void {
  applicationSettingsMenuState = { ...applicationSettingsMenuState, theme };
  nativeTheme.themeSource = theme;
  sendApplicationSettingsCommand({ theme, type: "set-theme" });
  installApplicationMenu();
}

function updateApplicationSettingsMenu(): void {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  const updateButtonPreviewItem = menu.getMenuItemById(
    "debug-update-button-preview"
  );
  const debugSeparator = menu.getMenuItemById("settings-debug-separator");
  const debugMenu = menu.getMenuItemById("debug-menu");
  const debugSettingsAvailable = debugSettingsAreAvailable();
  const debugMenuItemIds = [
    "debug-demo-time",
    "debug-update-button-preview"
  ] as const;

  if (updateButtonPreviewItem) {
    updateButtonPreviewItem.checked = updateButtonPreviewEnabled;
  }
  if (debugSeparator) debugSeparator.visible = debugSettingsAvailable;
  if (debugMenu) {
    debugMenu.enabled = debugSettingsAvailable;
    debugMenu.visible = debugSettingsAvailable;
  }
  for (const id of debugMenuItemIds) {
    const item = menu.getMenuItemById(id);
    if (item) {
      item.enabled = debugSettingsAvailable;
      item.visible =
        process.platform === "darwin" || debugSettingsAvailable;
    }
  }
}

function installApplicationMenu(): void {
  const selectedTheme = applicationSettingsMenuState.theme;
  const debugSettingsAvailable = debugSettingsAreAvailable();
  const debugMenuItems = (
    visible = debugSettingsAvailable,
    enabled = debugSettingsAvailable
  ): Electron.MenuItemConstructorOptions[] => [
    {
      checked: demoTimeEnabled,
      click: (menuItem) => setDemoTimeEnabled(menuItem.checked),
      enabled,
      id: "debug-demo-time",
      label: "Demo Time",
      type: "checkbox",
      visible
    },
    {
      checked: updateButtonPreviewEnabled,
      click: (menuItem) => {
        if (!debugSettingsAreAvailable()) return;
        setUpdateButtonPreviewEnabled(menuItem.checked);
      },
      enabled,
      id: "debug-update-button-preview",
      label: "Preview Update Button",
      type: "checkbox",
      visible
    }
  ];
  const settingsMenu: Electron.MenuItemConstructorOptions = {
    label: "Settings",
    submenu: [
      {
        label: "Appearance",
        submenu: [
          {
            checked: selectedTheme === "system",
            click: () => setApplicationTheme("system"),
            id: "settings-theme-system",
            label: "System",
            type: "radio"
          },
          {
            checked: selectedTheme === "dark",
            click: () => setApplicationTheme("dark"),
            id: "settings-theme-dark",
            label: "Dark",
            type: "radio"
          },
          {
            checked: selectedTheme === "light",
            click: () => setApplicationTheme("light"),
            id: "settings-theme-light",
            label: "Light",
            type: "radio"
          }
        ]
      },
      {
        id: "settings-debug-separator",
        type: "separator",
        visible: debugSettingsAvailable
      },
      ...debugMenuItems().map((item) => ({
        ...item,
        label: `Debug: ${item.label}`
      }))
    ]
  };
  const debugMenu: Electron.MenuItemConstructorOptions = {
    id: "debug-menu",
    label: "Debug",
    // Public packages compile the internal flag out, leaving this menu hidden.
    submenu: debugMenuItems(true, true)
  };
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                accelerator: "CommandOrControl+,",
                click: () => openLooperMenu(),
                label: "Settings…"
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const }
            ]
          }
        ]
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    ...(process.platform === "darwin" ? [] : [settingsMenu]),
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [
        {
          click: () => void shell.openExternal(looperSupportUrl),
          label: "Looper Support"
        },
        {
          click: () => void shell.openExternal(`mailto:${looperSupportEmail}`),
          label: "Contact Support…"
        },
        { type: "separator" },
        {
          click: () => void shell.openExternal(looperPrivacyUrl),
          label: "Privacy Policy"
        },
        {
          click: () => void shell.openExternal(looperTermsUrl),
          label: "Terms of Service"
        }
      ]
    }
  ];

  const applicationMenu = Menu.buildFromTemplate(template);
  if (process.platform === "darwin") {
    applicationMenu.insert(
      applicationMenu.items.length - 1,
      new MenuItem(debugMenu)
    );
  }
  Menu.setApplicationMenu(applicationMenu);
}

function openLooperMenu(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  sendApplicationSettingsCommand({ type: "open-looper-menu" });
}

function createWindow(): void {
  const createdWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 600,
    minHeight: 640,
    show: false,
    title: "Looper",
    autoHideMenuBar: process.platform === "win32",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 18, y: 17 } }
      : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff",
    webPreferences: {
      preload: join(mainDir, "../preload/index.cjs"),
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow = createdWindow;

  let revealFallback: ReturnType<typeof setTimeout> | undefined;
  const revealWindow = (): void => {
    if (revealFallback) {
      clearTimeout(revealFallback);
      revealFallback = undefined;
    }
    if (!createdWindow.isDestroyed() && !createdWindow.isVisible()) {
      createdWindow.show();
    }
  };

  createdWindow.once("ready-to-show", revealWindow);
  revealFallback = setTimeout(revealWindow, 5_000);

  createdWindow.on("closed", () => {
    if (revealFallback) clearTimeout(revealFallback);
    if (mainWindow === createdWindow) mainWindow = undefined;
  });

  const sendFullScreenState = (): void => {
    if (!createdWindow.webContents.isDestroyed()) {
      createdWindow.webContents.send(
        windowStateIpcChannels.fullScreenChanged,
        createdWindow.isFullScreen()
      );
    }
  };
  createdWindow.on("enter-full-screen", sendFullScreenState);
  createdWindow.on("leave-full-screen", sendFullScreenState);

  createdWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  createdWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  createdWindow.webContents.on("before-input-event", (event, input) => {
    const command = contentZoomCommandForKeyInput(input, process.platform);
    if (!command) return;

    event.preventDefault();
    createdWindow.webContents.send(contentZoomChannel, command);
  });
  createdWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  createdWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch(() => undefined);
    }
    return { action: "deny" };
  });

  if (devRendererUrl) {
    void createdWindow.loadURL(devRendererUrl);
  } else {
    void createdWindow.loadURL(packagedRendererEntryUrl);
  }
}

async function startApplicationUpdates(): Promise<void> {
  if (!shouldStartMacAppUpdates(app.isPackaged, process.platform, updateChannel)) {
    return;
  }

  startMacAppUpdates({
    architecture: process.arch,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    onError: (error) => {
      if (actualAppUpdateState.status === "downloading") {
        actualAppUpdateState = {
          errorMessage: updateDownloadFailureMessage,
          preview: false,
          releaseName: actualAppUpdateState.releaseName,
          status: "available"
        };
        broadcastAppUpdateState();
      }
      console.warn(
        "Automatic update operation failed.",
        error instanceof Error ? error.message : error
      );
    },
    onDownloadProgress: (progress) => {
      if (actualAppUpdateState.status !== "downloading") return;
      actualAppUpdateState = {
        ...actualAppUpdateState,
        progress: Math.max(actualAppUpdateState.progress, progress)
      };
      broadcastAppUpdateState();
    },
    onUpdateAvailable: (releaseName) => {
      actualAppUpdateState = {
        preview: false,
        releaseName: releaseName.trim() || "A new Looper version",
        status: "available"
      };
      broadcastAppUpdateState();
    },
    onUpdateDownloaded: () => {
      if (actualAppUpdateState.status !== "downloading") return;
      const availableState: AppUpdateState = {
        preview: false,
        releaseName: actualAppUpdateState.releaseName,
        status: "available"
      };
      actualAppUpdateState = {
        ...actualAppUpdateState,
        progress: 100,
        status: "installing"
      };
      broadcastAppUpdateState();

      const elapsedMs = Date.now() - appUpdateDownloadStartedAt;
      const restartDelayMs = Math.max(
        0,
        minimumUpdateProgressPresentationMs - elapsedMs
      );
      const restartTimer = setTimeout(() => {
        try {
          autoUpdater.quitAndInstall();
        } catch (error) {
          actualAppUpdateState = availableState;
          broadcastAppUpdateState();
          console.warn(
            "Could not restart Looper for the downloaded update.",
            error instanceof Error ? error.message : error
          );
        }
      }, restartDelayMs);
      restartTimer.unref();
    },
    platform: process.platform,
    updateChannel,
    updater: autoUpdater
  });
}

registerIpc();

app.whenReady().then(async () => {
  registerPackagedRendererProtocol();
  await removeLegacyMarketDataSettings();
  installApplicationMenu();
  createWindow();
  void startApplicationUpdates();

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
