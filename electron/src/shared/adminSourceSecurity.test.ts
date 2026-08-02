import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const electronSourceRoot = new URL("../", import.meta.url);

async function productionSourceFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<URL[]> => {
      const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory);
      if (entry.isDirectory()) return productionSourceFiles(url);
      if (
        !entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".tsx")
      ) {
        return [];
      }
      return entry.name.includes(".test.") ? [] : [url];
    })
  );
  return files.flat();
}

test("keeps admin identity and email authorization out of Electron production code", async () => {
  const files = await productionSourceFiles(electronSourceRoot);
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const combinedSource = sources.join("\n");

  assert.doesNotMatch(combinedSource, /rorourke@gmail\.com/i);
  assert.doesNotMatch(
    combinedSource,
    /ADMIN_ACCOUNT_EMAIL|isAdminAccountEmail|internalDebugAccountEmail/
  );
});

test("requires an online server grant instead of trusting cached account identity", async () => {
  const [mainSource, preloadSource, appSource] = await Promise.all([
    readFile(new URL("../main/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../preload/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../renderer/src/App.tsx", import.meta.url), "utf8")
  ]);

  assert.match(mainSource, /let verifiedAdminAccess = false/);
  assert.match(
    mainSource,
    /const status = await getCloudAccountService\(\)\.getAdminAccess\(\)/
  );
  assert.match(
    mainSource,
    /if \(demoTimeEnabled \|\| !verifiedCloudAccount \|\| !verifiedAdminAccess\)/
  );
  assert.doesNotMatch(mainSource, /verifiedCloudAccount\?\.email/);
  assert.match(
    mainSource,
    /webContents\.send\(adminIpcChannels\.accessChanged, nextStatus\)/
  );
  assert.match(preloadSource, /ipcRenderer\.on\(adminIpcChannels\.accessChanged/);
  assert.match(appSource, /window\.looper\.onAdminAccessChanged/);
  assert.match(appSource, /setHasAdminAccess\(status === "granted"\)/);
  assert.match(
    mainSource,
    /adminIpcChannels\.getOverview[\s\S]*?catch \(error\) \{[\s\S]*?refreshAdminAccessAfterPrivilegedFailure\(\)/
  );
  assert.match(
    mainSource,
    /async function refreshAdminAccessAfterPrivilegedFailure\(\)[\s\S]*?setVerifiedAdminAccess\(false\);[\s\S]*?refreshVerifiedAdminAccess\(\)/
  );
  assert.match(
    mainSource,
    /const signOutScope =[\s\S]*?verifiedAdminAccessStatus === "denied" \? "local" : "global";[\s\S]*?\.signOut\(signOutScope\)/
  );
});
