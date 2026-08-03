import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseShowGettingStartedFiles } from "./applicationPreferences.ts";

const appUrl = new URL("./App.tsx", import.meta.url);

test("shows only the learning and template section headings", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.doesNotMatch(app, />\s*Your sheets\s*</);
  assert.match(app, />\s*Looper Basics\s*</);
  assert.match(app, />\s*Templates\s*</);
  assert.doesNotMatch(app, />\s*Learn the ropes\s*</);
});

test("can hide the Getting Started sections without deleting their files", async () => {
  const app = await readFile(appUrl, "utf8");
  const gettingStartedMenuStart = app.indexOf(
    'aria-checked={showGettingStartedFiles}'
  );
  const appearanceMenuStart = app.indexOf(
    'aria-label={`Appearance:',
    gettingStartedMenuStart
  );

  assert.equal(parseShowGettingStartedFiles(null), true);
  assert.match(app, /aria-checked=\{showGettingStartedFiles\}/);
  assert.match(app, />Show Getting Started Files</);
  assert.match(app, /icon=\{BookOpen\}/);
  assert.match(app, /setShowGettingStartedFiles\(\(current\) => !current\)/);
  assert.ok(gettingStartedMenuStart >= 0);
  assert.ok(appearanceMenuStart > gettingStartedMenuStart);
  assert.doesNotMatch(
    app.slice(gettingStartedMenuStart, appearanceMenuStart),
    /settings-separator/
  );
  assert.match(
    app,
    /showGettingStartedFiles \? gettingStartedLibraryDocuments : \[\]/
  );
  assert.match(
    app,
    /\.\.\.visibleGettingStartedLibraryDocuments/
  );
  assert.doesNotMatch(app, /setLibraryDocuments\([^)]*showGettingStartedFiles/);
});
