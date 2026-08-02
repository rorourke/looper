import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isSheetStorageProvider } from "../../shared/sheetStorage.ts";

const appSourceUrl = new URL("./App.tsx", import.meta.url);
const mainSourceUrl = new URL("../../main/index.ts", import.meta.url);
const preloadSourceUrl = new URL("../../preload/index.ts", import.meta.url);
const stylesSourceUrl = new URL("./styles.css", import.meta.url);
const webPageUrl = new URL("../../../../web/app/page.tsx", import.meta.url);

test("accepts the old cloud setting only so existing installs can migrate", () => {
  assert.equal(isSheetStorageProvider("looper-cloud"), true);
  assert.equal(isSheetStorageProvider("local"), true);
  assert.equal(isSheetStorageProvider("self-hosted"), false);
});

test("promotes local files to the desktop product default", async () => {
  const [app, main] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8")
  ]);

  assert.match(main, /join\(app\.getPath\("documents"\), "Looper"\)/);
  assert.match(main, /rawProvider !== "local"/);
  assert.match(main, /stores sheets locally in the open-source desktop app/);
  assert.match(app, /const localOnlyMode = true/);
  assert.match(app, /window\.looper\s*\.listLocalSheets\(\)/);
  assert.match(app, /await createLocalOwnedSheet\(intent\)/);
  assert.match(app, /userLibraryDocuments\.filter\(\(document\) => Boolean\(document\.local\)\)/);
});

test("installs the interactive public demo without a backend runtime", async () => {
  const page = await readFile(webPageUrl, "utf8");

  assert.match(page, /LooperWebApp/);
  assert.doesNotMatch(page, /SUPABASE/);
  assert.doesNotMatch(page, /No account\. No subscription\. Your sheets stay on your computer\./);
});

test("exposes local file controls and safe drag import in the desktop library", async () => {
  const [app, main, preload, styles] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
    readFile(preloadSourceUrl, "utf8"),
    readFile(stylesSourceUrl, "utf8")
  ]);

  assert.match(app, /<span>Open Sheet…<\/span>/);
  assert.match(app, /Show Sheet Folder in Finder/);
  assert.match(app, /Change Sheet Folder…/);
  assert.match(app, /openDroppedDocuments\(files\)/);
  assert.match(app, /window\.addEventListener\("drop", handleDrop\)/);
  assert.match(app, /Drop to import/);
  assert.match(styles, /\.local-sheet-drop-overlay\s*\{/);
  assert.match(main, /"document:open-dropped"/);
  assert.match(main, /normalizeLocalDocumentImportPaths\(rawPaths\)/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
});
