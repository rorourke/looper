import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isApplicationSettingsCommand,
  parseApplicationSettingsMenuState
} from "../shared/applicationSettings.ts";

const mainSourceUrl = new URL("./index.ts", import.meta.url);
const appSourceUrl = new URL("../renderer/src/App.tsx", import.meta.url);

test("validates settings state and commands at the IPC boundary", () => {
  assert.deepEqual(
    parseApplicationSettingsMenuState({
      alwaysShowDownloadAppButton: false,
      defaultDecimalPlaces: 2,
      isSigningOut: false,
      sheetCount: 3,
      startupView: "last-sheet",
      theme: "system"
    }),
    {
      accountEmail: undefined,
      alwaysShowDownloadAppButton: false,
      defaultDecimalPlaces: 2,
      isSigningOut: false,
      sheetCount: 3,
      startupView: "last-sheet",
      theme: "system"
    }
  );
  assert.equal(parseApplicationSettingsMenuState({ theme: "sepia" }), undefined);
  assert.equal(isApplicationSettingsCommand({ theme: "dark", type: "set-theme" }), true);
  assert.equal(
    isApplicationSettingsCommand({
      decimalPlaces: 7,
      type: "set-default-decimal-places"
    }),
    false
  );
  assert.equal(isApplicationSettingsCommand({ type: "export-all-sheets" }), true);
  assert.equal(isApplicationSettingsCommand({ type: "open-looper-menu" }), true);
});

test("opens the in-app Looper menu from the native Settings shortcut", async () => {
  const [mainSource, appSource] = await Promise.all([
    readFile(mainSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8")
  ]);

  assert.match(mainSource, /id: "settings-theme-system"/);
  assert.match(mainSource, /id: "settings-theme-dark"/);
  assert.match(mainSource, /id: "settings-theme-light"/);
  assert.match(mainSource, /accelerator: "CommandOrControl\+,"/);
  assert.match(mainSource, /label: "Settings…"/);
  assert.match(mainSource, /click: \(\) => openLooperMenu\(\)/);
  assert.match(
    mainSource,
    /sendApplicationSettingsCommand\(\{ type: "open-looper-menu" \}\)/
  );
  assert.doesNotMatch(mainSource, /openApplicationSettingsWindow|settingsWindow/);
  assert.match(mainSource, /debugSettingsAreAvailable\(\): boolean \{\s*return isInternalDebugBuild \|\| demoTimeEnabled;/);
  assert.match(mainSource, /id: "debug-demo-time"/);
  assert.match(mainSource, /id: "debug-update-button-preview"/);
  assert.doesNotMatch(mainSource, /id: "settings-account"/);
  assert.doesNotMatch(mainSource, /id: "settings-admin-panel"/);
  assert.doesNotMatch(mainSource, /id: "settings-sign-out"/);
  assert.doesNotMatch(mainSource, /id: "debug-billing-state"/);

  assert.match(appSource, /onApplicationSettingsCommand/);
  assert.match(appSource, /command\.type === "open-looper-menu"/);
  assert.match(appSource, /setIsLibrarySettingsMenuOpen\(true\)/);
  assert.match(appSource, /command\.type === "set-default-decimal-places"/);
  assert.match(appSource, /command\.type === "set-startup-view"/);
});
