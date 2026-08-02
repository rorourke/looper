export const initialUpdateCheckDelayMs = 15_000;
export const recurringUpdateCheckIntervalMs = 4 * 60 * 60 * 1000;
export const macUpdateFeedUrl =
  "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/macos";

type UpdateTimerHandle = {
  unref?: () => void;
};

type UpdateTimers = {
  setInterval: (callback: () => void, delayMs: number) => UpdateTimerHandle;
  setTimeout: (callback: () => void, delayMs: number) => UpdateTimerHandle;
};

type UpdateInfoLike = {
  releaseName?: string | null;
  version: string;
};

type DownloadProgressLike = {
  percent: number;
};

export type AppUpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown> | void;
  downloadUpdate: () => Promise<unknown>;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(
    event: "checking-for-update",
    listener: () => void
  ): unknown;
  on(
    event: "update-available" | "update-not-available" | "update-downloaded",
    listener: (info: UpdateInfoLike) => void
  ): unknown;
  on(
    event: "download-progress",
    listener: (progress: DownloadProgressLike) => void
  ): unknown;
  quitAndInstall: () => void;
  setFeedURL: (options: { provider: "generic"; url: string }) => void;
};

type StartMacAppUpdatesOptions = {
  architecture: string;
  currentVersion: string;
  isPackaged: boolean;
  onError: (error: unknown) => void;
  onDownloadProgress: (progress: number) => void;
  onUpdateAvailable: (releaseName: string) => void;
  onUpdateDownloaded: () => void;
  platform: NodeJS.Platform;
  timers?: UpdateTimers;
  updateChannel: string | undefined;
  updater: AppUpdaterLike;
};

const defaultTimers: UpdateTimers = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs)
};

export function shouldStartMacAppUpdates(
  isPackaged: boolean,
  platform: NodeJS.Platform,
  updateChannel: string | undefined
): boolean {
  return isPackaged && platform === "darwin" && updateChannel === "stable";
}

export function macUpdateFeed(
  _currentVersion: string,
  _architecture: string
): string {
  return macUpdateFeedUrl;
}

export function startMacAppUpdates(options: StartMacAppUpdatesOptions): boolean {
  if (
    !shouldStartMacAppUpdates(
      options.isPackaged,
      options.platform,
      options.updateChannel
    )
  ) {
    return false;
  }

  const { updater } = options;
  let checkInProgress = false;
  let updateAvailable = false;
  let updateDownloaded = false;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.setFeedURL({
    provider: "generic",
    url: macUpdateFeed(options.currentVersion, options.architecture)
  });
  updater.on("checking-for-update", () => {
    checkInProgress = true;
  });
  updater.on("update-available", (info) => {
    checkInProgress = false;
    updateAvailable = true;
    options.onUpdateAvailable(
      info.releaseName?.trim() || `Looper ${info.version}`
    );
  });
  updater.on("update-not-available", () => {
    checkInProgress = false;
  });
  updater.on("error", (error) => {
    checkInProgress = false;
    options.onError(error);
  });
  updater.on("download-progress", ({ percent }) => {
    options.onDownloadProgress(Math.max(0, Math.min(100, percent)));
  });
  updater.on("update-downloaded", () => {
    checkInProgress = false;
    updateDownloaded = true;
    options.onUpdateDownloaded();
  });

  const checkForUpdates = (): void => {
    if (checkInProgress || updateAvailable || updateDownloaded) return;
    checkInProgress = true;
    try {
      const check = updater.checkForUpdates();
      if (check && "catch" in check) {
        void check.catch(() => {
          checkInProgress = false;
        });
      }
    } catch (error) {
      checkInProgress = false;
      options.onError(error);
    }
  };
  const timers = options.timers ?? defaultTimers;
  const initialCheck = timers.setTimeout(
    checkForUpdates,
    initialUpdateCheckDelayMs
  );
  const recurringCheck = timers.setInterval(
    checkForUpdates,
    recurringUpdateCheckIntervalMs
  );
  initialCheck.unref?.();
  recurringCheck.unref?.();
  return true;
}
