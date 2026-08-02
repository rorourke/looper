import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLooperText } from "./looperEngine.ts";
import { libraryConcepts } from "./libraryConcepts.ts";

test("library concepts are unique, valid Looper examples", () => {
  assert.equal(new Set(libraryConcepts.map((concept) => concept.id)).size, libraryConcepts.length);

  for (const concept of libraryConcepts) {
    const sourceLines = concept.source.split("\n");
    const evaluation = evaluateLooperText(
      concept.source,
      concept.loopCount,
      "stockQuotes" in concept ? concept.stockQuotes : undefined
    );

    assert.equal(sourceLines.length, 4, `${concept.title} should have exactly four lines`);
    assert.equal(
      sourceLines.every((line) => line.trim().length > 0),
      true,
      `${concept.title} should use all four lines`
    );
    assert.equal(evaluation.errors, 0, `${concept.title} should evaluate without errors`);
  }
});

test("the magic word introduces the loop variable directly", () => {
  const concept = libraryConcepts.find((candidate) => candidate.id === "loop-keyword");

  assert.ok(concept);
  assert.equal(libraryConcepts[0], concept);
  assert.equal(concept.title, "The Magic Word");
  assert.match(concept.description, /counts each step/i);
  assert.equal(concept.source.split("\n")[0], "loop");
  assert.ok(concept.loopCount > 0);
});
