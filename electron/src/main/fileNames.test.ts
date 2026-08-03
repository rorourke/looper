import assert from "node:assert/strict";
import test from "node:test";
import { safeFileName } from "./fileNames.ts";

test("creates portable filenames for Mac and Windows", () => {
  assert.equal(
    safeFileName('What if? <plan> | "A"*'),
    "What if- -plan- - -A--"
  );
  assert.equal(safeFileName("Budget.loop"), "Budget");
  assert.equal(safeFileName("Budget..."), "Budget");
  assert.equal(safeFileName("CON"), "_CON");
  assert.equal(safeFileName("lpt1.report"), "_lpt1.report");
  assert.equal(safeFileName("...", "Fallback"), "Fallback");
  assert.equal(safeFileName(` ${"a".repeat(120)} `).length, 96);
});
