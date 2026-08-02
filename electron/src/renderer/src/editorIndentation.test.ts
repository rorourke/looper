import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  insertDedentedClosingBrace,
  insertIndentedNewline
} from "./editorIndentation.ts";

describe("function body indentation", () => {
  test("opens a tab-indented body and keeps the closing brace outside it", () => {
    const source = "payment(amount) {}";
    const caret = source.indexOf("}");
    const edit = insertIndentedNewline(source, caret);

    assert.equal(edit.text, "payment(amount) {\n\t\n}");
    assert.equal(edit.selectionStart, "payment(amount) {\n\t".length);
    assert.equal(edit.selectionEnd, edit.selectionStart);
  });

  test("carries the current function-body indent onto the next line", () => {
    const source = "payment(amount) {\n\tmonthly = amount / 12\n}";
    const caret = source.indexOf("\n}");
    const edit = insertIndentedNewline(source, caret);

    assert.equal(edit.text, "payment(amount) {\n\tmonthly = amount / 12\n\t\n}");
    assert.equal(edit.selectionStart, source.indexOf("\n}") + 2);
  });

  test("reintroduces a tab after an unindented line inside a function", () => {
    const source = "payment(amount) {\nmonthly = amount / 12\n}";
    const caret = source.indexOf("\n}");
    const edit = insertIndentedNewline(source, caret);

    assert.equal(edit.text, "payment(amount) {\nmonthly = amount / 12\n\t\n}");
    assert.equal(edit.selectionStart, source.indexOf("\n}") + 2);
  });

  test("dedents a closing brace typed on an indented function-body line", () => {
    const source = "payment(amount) {\n\tmonthly = amount / 12\n\t";
    const edit = insertDedentedClosingBrace(source, source.length);

    assert.ok(edit);
    assert.equal(edit.text, "payment(amount) {\n\tmonthly = amount / 12\n}");
    assert.equal(edit.selectionStart, edit.text.length);
  });

  test("does not dedent whitespace outside a function", () => {
    assert.equal(insertDedentedClosingBrace("\t", 1), undefined);
  });

  test("does not treat braces in comments as function bodies", () => {
    const source = "// describe {\nnext";
    const edit = insertIndentedNewline(source, source.length);

    assert.equal(edit.text, "// describe {\nnext\n");
  });

  test("does not indent after a function has closed", () => {
    const source = "payment(amount) {\n\tamount\n}";
    const edit = insertIndentedNewline(source, source.length);

    assert.equal(edit.text, "payment(amount) {\n\tamount\n}\n");
  });
});
