import assert from "node:assert/strict";
import test from "node:test";
import { abbreviatedSourceFolderPath } from "./sourceFolder.ts";

test("abbreviates a source folder to its final path component", () => {
  assert.equal(
    abbreviatedSourceFolderPath("/Users/ryan/Documents/Looper"),
    "/Looper"
  );
  assert.equal(
    abbreviatedSourceFolderPath("C:\\Users\\Ryan\\Downloads\\"),
    "/Downloads"
  );
});

test("handles source folder roots and a path that has not loaded", () => {
  assert.equal(abbreviatedSourceFolderPath("/"), "/");
  assert.equal(abbreviatedSourceFolderPath("C:\\"), "C:\\");
  assert.equal(abbreviatedSourceFolderPath(undefined), "…");
});
