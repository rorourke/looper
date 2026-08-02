import assert from "node:assert/strict";
import test from "node:test";
import {
  editorRowsMatchText,
  lineIndexAtVerticalOffset,
  lineUsesFullEditorWidth,
  rowDragShiftDirection
} from "./lineLayout.ts";

test("maps pointer offsets across wrapped editor rows", () => {
  const rowHeights = [30, 30, 90, 30];

  assert.equal(lineIndexAtVerticalOffset(rowHeights, 59), 1);
  assert.equal(lineIndexAtVerticalOffset(rowHeights, 60), 2);
  assert.equal(lineIndexAtVerticalOffset(rowHeights, 149), 2);
  assert.equal(lineIndexAtVerticalOffset(rowHeights, 150), 3);
});

test("respects locked leading rows and clamps offsets past the document", () => {
  const rowHeights = [30, 60, 30];

  assert.equal(lineIndexAtVerticalOffset(rowHeights, -20, 1), 1);
  assert.equal(lineIndexAtVerticalOffset(rowHeights, 10, 1), 1);
  assert.equal(lineIndexAtVerticalOffset(rowHeights, 999, 1), 2);
  assert.equal(lineIndexAtVerticalOffset([], 0, 1), -1);
});

test("only comment-only rows can use the result lane", () => {
  assert.equal(lineUsesFullEditorWidth("// a long note"), true);
  assert.equal(lineUsesFullEditorWidth("  // an indented note"), true);
  assert.equal(lineUsesFullEditorWidth("total = 42 // still has a result"), false);
  assert.equal(lineUsesFullEditorWidth("total = 42"), false);
});

test("requires a rendered row for an empty editor", () => {
  assert.equal(editorRowsMatchText([], ""), false);
  assert.equal(editorRowsMatchText([""], ""), true);
  assert.equal(editorRowsMatchText(["first", "second"], "first\nsecond"), true);
});

test("moves intervening rows into the drag placeholder", () => {
  assert.equal(rowDragShiftDirection(1, 3, 1), undefined);
  assert.equal(rowDragShiftDirection(1, 3, 2), "up");
  assert.equal(rowDragShiftDirection(1, 3, 3), "up");
  assert.equal(rowDragShiftDirection(1, 3, 4), undefined);

  assert.equal(rowDragShiftDirection(4, 1, 0), undefined);
  assert.equal(rowDragShiftDirection(4, 1, 1), "down");
  assert.equal(rowDragShiftDirection(4, 1, 3), "down");
  assert.equal(rowDragShiftDirection(4, 1, 4), undefined);
});
