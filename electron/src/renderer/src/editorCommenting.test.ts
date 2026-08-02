import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toggleLineComments } from "./editorCommenting.ts";

describe("line commenting", () => {
  test("comments a fully selected line at its beginning", () => {
    const source = "first\namount = 42\nlast";
    const selectionStart = source.indexOf("amount");
    const selectionEnd = selectionStart + "amount = 42".length;
    const edit = toggleLineComments(source, selectionStart, selectionEnd);

    assert.equal(edit.text, "first\n// amount = 42\nlast");
    assert.equal(edit.selectionStart, selectionStart);
    assert.equal(edit.selectionEnd, selectionEnd + 3);
  });

  test("does not comment the next line when a whole-line selection includes its newline", () => {
    const source = "first\namount = 42\nlast";
    const selectionStart = source.indexOf("amount");
    const selectionEnd = source.indexOf("last");
    const edit = toggleLineComments(source, selectionStart, selectionEnd);

    assert.equal(edit.text, "first\n// amount = 42\nlast");
    assert.equal(edit.selectionStart, selectionStart);
    assert.equal(edit.selectionEnd, selectionEnd + 3);
  });

  test("comments each selected line and preserves indentation", () => {
    const source = "before\n\tfirst = 1\n\tsecond = 2\nafter";
    const selectionStart = source.indexOf("\tfirst");
    const selectionEnd = source.indexOf("after");
    const edit = toggleLineComments(source, selectionStart, selectionEnd);

    assert.equal(edit.text, "before\n\t// first = 1\n\t// second = 2\nafter");
    assert.equal(edit.selectionStart, selectionStart);
    assert.equal(edit.selectionEnd, selectionEnd + 6);
  });

  test("uncomments a selected commented line", () => {
    const source = "first\n// amount = 42\nlast";
    const selectionStart = source.indexOf("//");
    const selectionEnd = selectionStart + "// amount = 42".length;
    const edit = toggleLineComments(source, selectionStart, selectionEnd);

    assert.equal(edit.text, "first\namount = 42\nlast");
    assert.equal(edit.selectionStart, selectionStart);
    assert.equal(edit.selectionEnd, selectionEnd - 3);
  });
});
