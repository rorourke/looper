import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../app/LooperWebApp.tsx", import.meta.url);
const apiUrl = new URL("./browser-looper-api.ts", import.meta.url);
const homeUrl = new URL("../app/page.tsx", import.meta.url);
const sharedAppUrl = new URL("../../electron/src/renderer/src/App.tsx", import.meta.url);

test("runs the public site as an interactive, disposable demo", async () => {
  const [app, api, home, sharedApp] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(homeUrl, "utf8"),
    readFile(sharedAppUrl, "utf8")
  ]);

  assert.match(home, /return <LooperWebApp \/>/);
  assert.match(app, /window\.looper = createBrowserLooperApi\(\)/);
  assert.match(app, /publicDemoMode: true/);
  assert.doesNotMatch(app + home + api, /SUPABASE|supabase|stripe|billing\/checkout/);

  assert.match(
    sharedApp,
    /if \(publicDemoMode\) \{\s*const documents = createGettingStartedDocuments\(\);[\s\S]*initialViewMode: "library"/
  );
  assert.match(sharedApp, /if \(publicDemoMode\) return \[\];/);
  assert.match(sharedApp, /actionsHidden=\{publicDemoMode\}/);
  assert.match(
    sharedApp,
    /!publicDemoMode \? \(\s*<button\s*className="signed-out-library-action signed-out-create-sheet-action"/
  );
  assert.match(
    sharedApp,
    /!publicDemoMode &&\s*\(localOnlyMode \|\| presentedAccountState\.status !== "anonymous"\)\s*\? newSheetCard/
  );
  assert.match(sharedApp, /if \(!localOnlyMode \|\| publicDemoMode\) return;/);
  assert.match(
    sharedApp,
    /if \(publicDemoMode \|\| demoTimeEnabled\) return;\s*try \{\s*const localDocuments/
  );
  assert.match(sharedApp, /if \(!publicDemoMode\) newDocument\(\);/);
  assert.match(sharedApp, /if \(!publicDemoMode\) void openDocument\(\);/);
  assert.match(api, /This action is unavailable in the public Looper demo/);
  assert.match(api, /async createLocalSheet\(\) \{ unavailable\(\); \}/);
  assert.match(api, /async createCloudSheet\(\) \{ unavailable\(\); \}/);
});

test("keeps the restored Looper demo identity and source link", async () => {
  const sharedApp = await readFile(sharedAppUrl, "utf8");
  assert.match(
    sharedApp,
    /is an open source desktop notebook calculator\. It uses the magic word /
  );
  assert.match(sharedApp, /to manipulate calculations over time\./);
  assert.match(sharedApp, /https:\/\/github\.com\/rorourke\/looper/);
  assert.match(sharedApp, /<span>View Source<\/span>/);
});
