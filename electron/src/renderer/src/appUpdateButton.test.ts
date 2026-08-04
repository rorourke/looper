import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const mainSourceUrl = new URL("../../main/index.ts", import.meta.url);
const preloadSourceUrl = new URL("../../preload/index.ts", import.meta.url);
const stylesSourceUrl = new URL("./styles.css", import.meta.url);
const publisherSourceUrl = new URL(
  "../../../scripts/publish_macos_release.mjs",
  import.meta.url
);
const packageSourceUrl = new URL("../../../package.json", import.meta.url);

test("morphs an available update into real download progress and restarts", async () => {
  const [app, main, preload, styles, publisher, packageSource] =
    await Promise.all([
      readFile(appSourceUrl, "utf8"),
      readFile(mainSourceUrl, "utf8"),
      readFile(preloadSourceUrl, "utf8"),
      readFile(stylesSourceUrl, "utf8"),
      readFile(publisherSourceUrl, "utf8"),
      readFile(packageSourceUrl, "utf8")
    ]);
  const packageConfig = JSON.parse(packageSource);

  assert.match(
    app,
    /\{appUpdateState\.status !== "idle" \? \([\s\S]*className=\{`app-update-button/
  );
  assert.match(app, /className=\{`app-update-button[\s\S]*is-progress/);
  assert.match(app, /className="app-update-label"[\s\S]*"Update App"/);
  assert.match(app, /className="app-update-progress-ring"/);
  assert.match(app, /"Retry Update"/);
  assert.match(app, /strokeDashoffset:/);
  assert.match(app, /requestAnimationFrame\(animatePreviewProgress\)/);
  assert.match(app, /window\.looper\.installAppUpdate\(\)/);
  assert.match(preload, /onAppUpdateStateChanged:/);
  assert.match(main, /await autoUpdater\.downloadUpdate\(\)/);
  assert.match(main, /throw new Error\(updateDownloadFailureMessage\)/);
  assert.match(main, /autoUpdater\.quitAndInstall\(\)/);
  assert.match(
    main,
    /nativeAutoUpdater\.on\("before-quit-for-update"[\s\S]*armMacUpdateExitWatchdog\(/
  );
  assert.match(main, /onDownloadProgress:[\s\S]*broadcastAppUpdateState\(\)/);
  assert.match(main, /onUpdateDownloaded:[\s\S]*status: "installing"/);
  assert.match(styles, /\.app-update-button\.is-progress \{[\s\S]*width: 38px/);
  assert.match(styles, /\.app-update-button \{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.app-update-button\.is-progress \.app-update-label[\s\S]*opacity: 0/);
  assert.match(publisher, /latest-mac\.yml/);
  assert.match(publisher, /createHash\("sha512"\)/);
  assert.match(publisher, /\.zip\.blockmap/);
  assert.deepEqual(packageConfig.build.mac.publish, [
    {
      provider: "generic",
      url: "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/macos"
    }
  ]);
  assert.match(
    styles,
    /:root\[data-theme="dark"\] \.app-update-button[\s\S]*color: #ffffff;[\s\S]*background: var\(--text-editor-subtitle\);/
  );
});
