import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  nextApplicationTheme,
  parseDefaultDecimalPlaces,
  parseShowGettingStartedFiles,
  parseStartupView
} from "./applicationPreferences.ts";

const appUrl = new URL("./App.tsx", import.meta.url);

test("parses default decimal places within the supported range", () => {
  assert.equal(parseDefaultDecimalPlaces("0"), 0);
  assert.equal(parseDefaultDecimalPlaces(3), 3);
  assert.equal(parseDefaultDecimalPlaces(null), 2);
  assert.equal(parseDefaultDecimalPlaces(""), 2);
  assert.equal(parseDefaultDecimalPlaces("1.5"), 2);
  assert.equal(parseDefaultDecimalPlaces(4), 2);
  assert.equal(parseDefaultDecimalPlaces("not-a-number"), 2);
});

test("parses the preferred startup view", () => {
  assert.equal(parseStartupView("library"), "library");
  assert.equal(parseStartupView("last-sheet"), "last-sheet");
  assert.equal(parseStartupView("editor"), "last-sheet");
});

test("shows Getting Started files by default and remembers when they are hidden", () => {
  assert.equal(parseShowGettingStartedFiles(null), true);
  assert.equal(parseShowGettingStartedFiles("true"), true);
  assert.equal(parseShowGettingStartedFiles("false"), false);
  assert.equal(parseShowGettingStartedFiles(false), false);
});

test("cycles through the available application themes", () => {
  assert.equal(nextApplicationTheme("system", true), "dark");
  assert.equal(nextApplicationTheme("dark", true), "light");
  assert.equal(nextApplicationTheme("light", true), "system");
  assert.equal(nextApplicationTheme("light", false), "dark");
  assert.equal(nextApplicationTheme("dark", false), "light");
  assert.equal(nextApplicationTheme("system", false), "light");
});

test("changes Appearance directly from the pop-over without opening Settings", async () => {
  const app = await readFile(appUrl, "utf8");
  const appearanceRow = app.match(
    /<button\s+aria-label=\{`Appearance:[\s\S]+?<\/button>/
  )?.[0];

  assert.ok(appearanceRow);
  assert.match(appearanceRow, /setTheme\(nextAppearanceTheme\)/);
  assert.match(appearanceRow, /icon=\{Palette\}/);
  assert.doesNotMatch(appearanceRow, /setIsSettingsDialogOpen/);
  assert.doesNotMatch(appearanceRow, /setIsLibrarySettingsMenuOpen/);
});

test("uses a Log Out icon in the pop-over Sign Out row", async () => {
  const app = await readFile(appUrl, "utf8");
  const signOutRow = app.match(
    /className="settings-menu-action"\s+disabled=\{isSigningOut\}[\s\S]+?<\/button>/
  )?.[0];

  assert.ok(signOutRow);
  assert.match(signOutRow, /icon=\{LogOut\}/);
  assert.match(signOutRow, /Signing Out…[\s\S]*Sign Out/);
  assert.doesNotMatch(signOutRow, /destructive/);
});
