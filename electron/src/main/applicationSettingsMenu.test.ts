import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isApplicationSettingsCommand,
  parseApplicationSettingsPreferenceChange,
  parseApplicationSettingsMenuState
} from "../shared/applicationSettings.ts";

const mainSourceUrl = new URL("./index.ts", import.meta.url);
const appSourceUrl = new URL("../renderer/src/App.tsx", import.meta.url);
const settingsWindowSourceUrl = new URL(
  "../renderer/src/SettingsWindow.tsx",
  import.meta.url
);

test("validates settings state and preferences at the IPC boundary", () => {
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
  assert.deepEqual(
    parseApplicationSettingsPreferenceChange({
      decimalPlaces: 3,
      type: "set-default-decimal-places"
    }),
    { decimalPlaces: 3, type: "set-default-decimal-places" }
  );
  assert.equal(
    parseApplicationSettingsPreferenceChange({
      decimalPlaces: 7,
      type: "set-default-decimal-places"
    }),
    undefined
  );
  assert.equal(isApplicationSettingsCommand({ type: "export-all-sheets" }), true);
});

test("connects the native menu to local-only Settings", async () => {
  const [mainSource, appSource, settingsWindowSource] = await Promise.all([
    readFile(mainSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8"),
    readFile(settingsWindowSourceUrl, "utf8")
  ]);

  assert.match(mainSource, /id: "settings-theme-system"/);
  assert.match(mainSource, /id: "settings-theme-dark"/);
  assert.match(mainSource, /id: "settings-theme-light"/);
  assert.match(mainSource, /accelerator: "CommandOrControl\+,"/);
  assert.match(mainSource, /label: "Settings…"/);
  assert.match(mainSource, /height: 560/);
  assert.match(mainSource, /debugSettingsAreAvailable\(\): boolean \{\s*return isInternalDebugBuild \|\| demoTimeEnabled;/);
  assert.match(mainSource, /id: "debug-demo-time"/);
  assert.match(mainSource, /id: "debug-update-button-preview"/);
  assert.doesNotMatch(mainSource, /id: "settings-account"/);
  assert.doesNotMatch(mainSource, /id: "settings-admin-panel"/);
  assert.doesNotMatch(mainSource, /id: "settings-sign-out"/);
  assert.doesNotMatch(mainSource, /id: "debug-billing-state"/);

  assert.match(appSource, /onApplicationSettingsCommand/);
  assert.match(appSource, /command\.type === "set-default-decimal-places"/);
  assert.match(appSource, /command\.type === "set-startup-view"/);
  assert.match(settingsWindowSource, /getSheetStorageSettings\(\)/);
  assert.match(settingsWindowSource, /onSheetStorageSettingsChanged/);
  assert.match(settingsWindowSource, /revealLocalSheetDirectory\(\)/);
  assert.match(settingsWindowSource, /setSheetStorageProvider\(\s*"local",\s*true/);
  assert.match(settingsWindowSource, /Sheet folder/);
  assert.match(settingsWindowSource, /portable \.loop file/);
  assert.doesNotMatch(settingsWindowSource, /Admin Panel/);
});
