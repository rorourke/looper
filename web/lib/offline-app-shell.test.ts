import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const webRoot = new URL("../", import.meta.url);

test("caches only the root web app shell and never cloud API responses", async () => {
  const [appSource, workerSource] = await Promise.all([
    readFile(new URL("app/LooperWebApp.tsx", webRoot), "utf8"),
    readFile(new URL("public/looper-sw.js", webRoot), "utf8")
  ]);

  assert.match(appSource, /serviceWorker\s*\.\s*register\("\/looper-sw\.js"/);
  assert.match(workerSource, /url\.pathname === "\/"/);
  assert.match(workerSource, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.doesNotMatch(workerSource, /caches\.put\([^)]*\/api\//);
  assert.match(
    workerSource,
    /request\.mode === "navigate" && url\.pathname === "\/"/
  );
});
