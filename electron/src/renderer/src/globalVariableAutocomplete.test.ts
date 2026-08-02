import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  completeGlobalVariableToken,
  globalVariableAutocompleteSuggestions,
  globalVariableTokenAtCaret,
  type GlobalVariableAutocompleteDefinition
} from "./globalVariableAutocomplete.ts";

function definition(
  name: string,
  documentId = "Budget",
  lineNumber = 0
): GlobalVariableAutocompleteDefinition {
  return {
    documentId,
    documentTitle: documentId,
    lineNumber,
    name,
    normalizedName: name.toLocaleLowerCase()
  };
}

describe("global variable autocomplete", () => {
  test("recognizes an at-name token at the caret", () => {
    assert.deepEqual(globalVariableTokenAtCaret("remaining = @bu", 15), {
      end: 15,
      lineNumber: 0,
      query: "bu",
      start: 12
    });
    assert.deepEqual(globalVariableTokenAtCaret("one = 1\nanswer = @", 18), {
      end: 18,
      lineNumber: 1,
      query: "",
      start: 17
    });
  });

  test("replaces the entire token when completing from its middle", () => {
    const text = "remaining = @budegt + 1";
    const token = globalVariableTokenAtCaret(text, "remaining = @bud".length);
    assert.ok(token);
    assert.equal(token.end, "remaining = @budegt".length);
    assert.deepEqual(completeGlobalVariableToken(text, token, "@budget"), {
      selectionEnd: "remaining = @budget".length,
      selectionStart: "remaining = @budget".length,
      text: "remaining = @budget + 1"
    });
  });

  test("does not activate inside comments or another identifier", () => {
    assert.equal(globalVariableTokenAtCaret("// see @bud", 11), undefined);
    assert.equal(globalVariableTokenAtCaret("email@bud", 9), undefined);
    assert.equal(globalVariableTokenAtCaret("@@bud", 5), undefined);
  });

  test("filters, deduplicates, and excludes the definition being edited", () => {
    const definitions = [
      definition("@runway", "Plan", 2),
      definition("@Budget", "Budget", 0),
      definition("@budget", "Duplicate", 4),
      definition("@burn_rate", "Budget", 1)
    ];

    assert.deepEqual(
      globalVariableAutocompleteSuggestions(definitions, "bu").map((item) => item.name),
      ["@Budget", "@burn_rate"]
    );
    assert.deepEqual(
      globalVariableAutocompleteSuggestions(definitions, "b", {
        documentId: "Budget",
        lineNumber: 0
      }).map((item) => item.name),
      ["@burn_rate"]
    );
  });
});
