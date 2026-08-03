import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const mainSourceUrl = new URL("../../main/index.ts", import.meta.url);
const stylesSourceUrl = new URL("./styles.css", import.meta.url);

test("limits debug UI to internal builds and local product previews", async () => {
  const [app, main, styles] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
    readFile(stylesSourceUrl, "utf8")
  ]);

  assert.match(main, /const isInternalDebugBuild =\s*isDev \|\| __LOOPER_INTERNAL_DEBUG_BUILD__/);
  assert.match(main, /return isInternalDebugBuild \|\| demoTimeEnabled/);
  assert.doesNotMatch(main, /hasDebugSettingsAccess/);
  assert.match(app, /setLibrarySettingsMenuView\("debug"\)/);
  assert.ok(
    app.indexOf('className="settings-menu-action settings-drill-row settings-debug-action"') >
      app.indexOf('<span className="settings-label">Appearance</span>'),
    "Debug should render below Appearance in the root menu"
  );
  assert.match(styles, /--settings-menu-font-size:\s*13px/);
  assert.match(
    styles,
    /\.settings-debug-action\s*\{\s*color:\s*var\(--text-editor-error\)/
  );
  assert.match(app, />\s*Demo Time\s*</);
  assert.match(app, />Preview Update Button</);
  assert.doesNotMatch(app, />Always Show Get App Button</);
  assert.doesNotMatch(app, />Preview Logged-Out Mode</);
  assert.doesNotMatch(app, />\s*Billing State\s*</);
  assert.doesNotMatch(app, />Show Upgrade Screen</);
});
