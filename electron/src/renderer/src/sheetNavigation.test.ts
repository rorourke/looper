import assert from "node:assert/strict";
import test from "node:test";
import { shouldEscapeToDocumentLibrary } from "./sheetNavigation.ts";

const plainSheetEscape = {
  hasOpenTransientUi: false,
  isComposing: false,
  isEditorView: true,
  isRepeat: false,
  key: "Escape"
};

test("a plain Escape on a sheet returns to the document library", () => {
  assert.equal(shouldEscapeToDocumentLibrary(plainSheetEscape), true);
});

test("Escape first dismisses transient sheet UI", () => {
  assert.equal(
    shouldEscapeToDocumentLibrary({
      ...plainSheetEscape,
      hasOpenTransientUi: true
    }),
    false
  );
});

test("Escape does not navigate from the library, during composition, or on repeat", () => {
  assert.equal(
    shouldEscapeToDocumentLibrary({
      ...plainSheetEscape,
      isEditorView: false
    }),
    false
  );
  assert.equal(
    shouldEscapeToDocumentLibrary({
      ...plainSheetEscape,
      isComposing: true
    }),
    false
  );
  assert.equal(
    shouldEscapeToDocumentLibrary({
      ...plainSheetEscape,
      isRepeat: true
    }),
    false
  );
  assert.equal(
    shouldEscapeToDocumentLibrary({
      ...plainSheetEscape,
      key: "x"
    }),
    false
  );
});
