import assert from "node:assert/strict";
import test from "node:test";
import { sortSheetsByLastModified } from "./librarySorting.ts";

test("sorts user sheets from most recently modified to least recently modified", () => {
  const sheets = [
    { id: "oldest", updatedAt: "2026-07-20T10:00:00.000Z" },
    { id: "newest", updatedAt: "2026-07-24T10:00:00.000Z" },
    { id: "middle", updatedAt: "2026-07-22T10:00:00.000Z" }
  ];

  assert.deepEqual(
    sortSheetsByLastModified(sheets).map((sheet) => sheet.id),
    ["newest", "middle", "oldest"]
  );
  assert.deepEqual(
    sheets.map((sheet) => sheet.id),
    ["oldest", "newest", "middle"],
    "sorting should not mutate the stored library"
  );
});

test("uses a deterministic order when sheets have the same modified time", () => {
  const updatedAt = "2026-07-24T10:00:00.000Z";

  assert.deepEqual(
    sortSheetsByLastModified([
      { id: "a", updatedAt },
      { id: "c", updatedAt },
      { id: "b", updatedAt }
    ]).map((sheet) => sheet.id),
    ["c", "b", "a"]
  );
});
