import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const mainSourceUrl = new URL("../../main/index.ts", import.meta.url);
const settingsWindowSourceUrl = new URL("./SettingsWindow.tsx", import.meta.url);

test("keeps the legacy admin implementation outside the open-source product surface", async () => {
  const [app, main, settingsWindow] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
    readFile(settingsWindowSourceUrl, "utf8")
  ]);

  assert.match(main, /const openSourceProduct = true/);
  assert.match(main, /if \(!openSourceProduct\) \{[\s\S]*adminIpcChannels\.openPanel/);
  assert.doesNotMatch(main, /id: "settings-admin-panel"/);
  assert.match(app, /\{!localOnlyMode \? <AdminPanelDialog/);
  assert.doesNotMatch(settingsWindow, /Admin Panel/);
  assert.doesNotMatch(settingsWindow, /getAdminAccess\(\)/);
  assert.doesNotMatch(settingsWindow, /openAdminPanel\(\)/);
});
