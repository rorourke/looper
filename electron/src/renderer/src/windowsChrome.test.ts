import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("./App.tsx", import.meta.url);
const mainUrl = new URL("../../main/index.ts", import.meta.url);
const rendererMainUrl = new URL("./main.tsx", import.meta.url);
const stylesUrl = new URL("./styles.css", import.meta.url);

test("places native Windows chrome above the Looper header", async () => {
  const [app, main, rendererMain, styles] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(mainUrl, "utf8"),
    readFile(rendererMainUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(
    main,
    /titleBarStyle: process\.platform === "darwin" \? "hiddenInset" : "default"/
  );
  assert.match(main, /autoHideMenuBar: process\.platform === "win32"/);
  assert.doesNotMatch(main, /titleBarOverlay|setTitleBarOverlay/);
  assert.match(
    rendererMain,
    /document\.documentElement\.dataset\.platform = String\(window\.looper\.platform\)/
  );
  assert.match(
    styles,
    /:root\[data-platform="win32"\][\s\S]*"Segoe UI Variable Text"[\s\S]*--titlebar-content-width: 100%/
  );
  assert.match(styles, /width: var\(--titlebar-content-width\)/);
  assert.match(app, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(app, /runtimePlatform === "darwin" \? "⌘" : "Ctrl\+"/);
});
