import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("./App.tsx", import.meta.url);

test("shows only the learning and template section headings", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.doesNotMatch(app, />\s*Your sheets\s*</);
  assert.match(app, />\s*Looper Basics\s*</);
  assert.match(app, />\s*Templates\s*</);
  assert.doesNotMatch(app, />\s*Learn the ropes\s*</);
});
