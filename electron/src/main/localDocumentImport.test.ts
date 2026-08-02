import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  normalizeLocalDocumentImportPaths,
  readLocalDocumentImport
} from "./localDocumentImport.ts";

test("accepts a bounded, unique list of absolute .loop files", () => {
  assert.deepEqual(
    normalizeLocalDocumentImportPaths([
      "/tmp/Budget.loop",
      "/tmp/Budget.loop",
      "/tmp/Forecast.LOOP"
    ]),
    ["/tmp/Budget.loop", "/tmp/Forecast.LOOP"]
  );

  for (const value of [
    [],
    ["relative.loop"],
    ["/tmp/not-a-loop.txt"],
    ["/tmp/invalid.loop\0"],
    Array.from({ length: 21 }, (_, index) => `/tmp/${index}.loop`)
  ]) {
    assert.throws(
      () => normalizeLocalDocumentImportPaths(value),
      /Looper sheets|\.loop files/
    );
  }
});

test("reads a selected .loop file after validating its size", async () => {
  const root = await mkdtemp(join(tmpdir(), "looper-import-"));
  const sheetPath = join(root, "Imported.loop");
  try {
    await writeFile(sheetPath, '{"title":"Imported","text":"total = 2"}\n');
    assert.match(await readLocalDocumentImport(sheetPath), /total = 2/);

    await writeFile(sheetPath, Buffer.alloc(1024 * 1024 + 64 * 1024 + 1));
    await assert.rejects(readLocalDocumentImport(sheetPath), /larger than 1 MiB/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
