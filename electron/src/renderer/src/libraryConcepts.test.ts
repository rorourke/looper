import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLooperText } from "./looperEngine.ts";
import { libraryConcepts } from "./libraryConcepts.ts";
import { formatResultText } from "./resultFormatting.ts";

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

  const evaluation = evaluateLooperText(concept.source, concept.loopCount);
  const spent = evaluation.lines.at(-1);
  assert.deepEqual(
    spent?.evaluations.map((item) => [item.loop, item.value?.formatted]),
    [
      [0, "$1.2K"],
      [1, "$2.4K"],
      [2, "$3.6K"],
      [3, "$4.8K"],
      [4, "$6K"]
    ]
  );
});

test("hardcoded mobile histories match the fixed marketing examples", () => {
  const conceptsWithLoopValues = libraryConcepts.filter(
    (concept) => "loopValues" in concept
  );

  assert.deepEqual(
    conceptsWithLoopValues.map((concept) => concept.id),
    ["loop-keyword", "loop-helpers"]
  );

  for (const concept of conceptsWithLoopValues) {
    const evaluation = evaluateLooperText(
      concept.source,
      concept.loopCount
    );

    for (const [lineNumberText, values] of Object.entries(concept.loopValues)) {
      const lineNumber = Number(lineNumberText);
      assert.deepEqual(
        evaluation.lines[lineNumber].evaluations.map(formatResultText),
        values,
        `${concept.title} line ${lineNumber} should keep its hardcoded history current`
      );
    }
  }
});
