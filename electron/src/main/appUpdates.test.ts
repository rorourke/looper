import assert from "node:assert/strict";
import test from "node:test";
import {
  initialUpdateCheckDelayMs,
  macUpdateFeed,
  recurringUpdateCheckIntervalMs,
  shouldStartMacAppUpdates,
  startMacAppUpdates,
  type AppUpdaterLike
} from "./appUpdates.ts";

function fakeUpdater(check: () => void): AppUpdaterLike {
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkForUpdates: check,
    downloadUpdate: async () => undefined,
    on: () => undefined,
    quitAndInstall: () => undefined,
    setFeedURL: () => undefined
  };
}

test("only enables updates for stable packaged macOS builds", () => {
  assert.equal(shouldStartMacAppUpdates(true, "darwin", "stable"), true);
  assert.equal(shouldStartMacAppUpdates(false, "darwin", "stable"), false);
  assert.equal(shouldStartMacAppUpdates(true, "linux", "stable"), false);
  assert.equal(shouldStartMacAppUpdates(true, "darwin", "disabled"), false);
  assert.equal(shouldStartMacAppUpdates(true, "darwin", undefined), false);
});

test("uses the shared HTTPS release metadata base", () => {
  assert.equal(
    macUpdateFeed("1.2.3", "arm64"),
    "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/macos"
  );
});

test("checks in the background and reports availability and download progress", () => {
  const scheduled: Array<{ callback: () => void; delayMs: number; kind: string }> = [];
  let unrefCount = 0;
  let checkCount = 0;
  const errors: unknown[] = [];
  const available: string[] = [];
  const progress: number[] = [];
  let downloadedCount = 0;
  let feedOptions: { provider: "generic"; url: string } | undefined;
  let notAvailableListener: (() => void) | undefined;
  let availableListener:
    | ((info: { releaseName?: string | null; version: string }) => void)
    | undefined;
  let progressListener: ((info: { percent: number }) => void) | undefined;
  let downloadedListener:
    | ((info: { releaseName?: string | null; version: string }) => void)
    | undefined;
  const updater = fakeUpdater(() => {
    checkCount += 1;
  });
  updater.setFeedURL = (options) => {
    feedOptions = options;
  };
  updater.on = (event, listener) => {
    if (event === "update-available") {
      availableListener = listener as typeof availableListener;
    } else if (event === "download-progress") {
      progressListener = listener as typeof progressListener;
    } else if (event === "update-downloaded") {
      downloadedListener = listener as typeof downloadedListener;
    } else if (event === "update-not-available") {
      notAvailableListener = listener as typeof notAvailableListener;
    }
  };

  assert.equal(
    startMacAppUpdates({
      architecture: "arm64",
      currentVersion: "1.2.3",
      isPackaged: true,
      onError: (error) => errors.push(error),
      onDownloadProgress: (percent) => progress.push(percent),
      onUpdateAvailable: (releaseName) => available.push(releaseName),
      onUpdateDownloaded: () => {
        downloadedCount += 1;
      },
      platform: "darwin",
      timers: {
        setInterval: (callback, delayMs) => {
          scheduled.push({ callback, delayMs, kind: "interval" });
          return { unref: () => (unrefCount += 1) };
        },
        setTimeout: (callback, delayMs) => {
          scheduled.push({ callback, delayMs, kind: "timeout" });
          return { unref: () => (unrefCount += 1) };
        }
      },
      updateChannel: "stable",
      updater
    }),
    true
  );

  assert.deepEqual(feedOptions, {
    provider: "generic",
    url: "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/macos"
  });
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.deepEqual(
    scheduled.map(({ delayMs, kind }) => ({ delayMs, kind })),
    [
      { delayMs: initialUpdateCheckDelayMs, kind: "timeout" },
      { delayMs: recurringUpdateCheckIntervalMs, kind: "interval" }
    ]
  );
  assert.equal(unrefCount, 2);
  assert.equal(checkCount, 0);

  scheduled[0]?.callback();
  assert.equal(checkCount, 1);
  scheduled[1]?.callback();
  assert.equal(checkCount, 1);
  notAvailableListener?.();
  assert.deepEqual(available, []);
  scheduled[1]?.callback();
  assert.equal(checkCount, 2);
  availableListener?.({ releaseName: "Looper 1.2.4", version: "1.2.4" });
  progressListener?.({ percent: 42.5 });
  assert.deepEqual(available, ["Looper 1.2.4"]);
  assert.deepEqual(progress, [42.5]);
  downloadedListener?.({ version: "1.2.4" });
  assert.equal(downloadedCount, 1);
  scheduled[1]?.callback();
  assert.equal(checkCount, 2);
  assert.deepEqual(errors, []);
});

test("reports synchronous update check failures", () => {
  const expected = new Error("update check failed");
  const errors: unknown[] = [];
  let initialCheck: (() => void) | undefined;

  startMacAppUpdates({
    architecture: "x64",
    currentVersion: "1.2.3",
    isPackaged: true,
    onError: (error) => errors.push(error),
    onDownloadProgress: () => undefined,
    onUpdateAvailable: () => undefined,
    onUpdateDownloaded: () => undefined,
    platform: "darwin",
    timers: {
      setInterval: () => ({}),
      setTimeout: (callback) => {
        initialCheck = callback;
        return {};
      }
    },
    updateChannel: "stable",
    updater: fakeUpdater(() => {
      throw expected;
    })
  });

  initialCheck?.();
  assert.deepEqual(errors, [expected]);
});
