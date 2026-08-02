import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("./App.tsx", import.meta.url);
const mainUrl = new URL("../../main/index.ts", import.meta.url);
const preloadUrl = new URL("../../preload/index.ts", import.meta.url);
const stylesUrl = new URL("./styles.css", import.meta.url);

test("reclaims the macOS traffic-light inset while the window is full screen", async () => {
  const [app, main, preload, styles] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(mainUrl, "utf8"),
    readFile(preloadUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(main, /createdWindow\.on\("enter-full-screen", sendFullScreenState\)/);
  assert.match(main, /createdWindow\.on\("leave-full-screen", sendFullScreenState\)/);
  assert.match(preload, /onWindowFullScreenChanged/);
  assert.match(app, /data-window-full-screen=\{isWindowFullScreen \? "true" : undefined\}/);
  assert.match(
    styles,
    /\.looper-shell\[data-window-full-screen="true"\]\s*\{\s*--titlebar-left-inset:\s*var\(--window-edge-inset\);/
  );
  assert.match(
    styles,
    /\.titlebar-controls\s*\{[^}]*padding:\s*0 var\(--titlebar-control-inset\)\s*0 var\(--titlebar-left-inset\);/s
  );
});
