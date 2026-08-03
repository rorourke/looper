import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LineEvaluation } from "./looperEngine.ts";
import {
  formatResultText,
  resultColumnCharacterCount
} from "./resultFormatting.ts";

const loopedEvaluation: LineEvaluation = {
  loop: 2,
  status: "success",
  value: {
    formatted: "$125",
    isLooped: true,
    kind: "currency",
    value: 125
  }
};

describe("result formatting", () => {
  test("keeps loop brackets in the presentation layer", () => {
    assert.equal(formatResultText(loopedEvaluation), "$125");
  });

  test("formats static values", () => {
    const staticEvaluation: LineEvaluation = {
      ...loopedEvaluation,
      value: { ...loopedEvaluation.value!, isLooped: false }
    };

    assert.equal(formatResultText(staticEvaluation), "$125");
  });

  test("labels duplicate global definitions inline", () => {
    const duplicateGlobal: LineEvaluation = {
      error: 'Global variable "@budget" must be defined only once',
      loop: 0,
      status: "error"
    };

    assert.equal(formatResultText(duplicateGlobal), "Duplicate");
  });

  test("keeps the compact marker for other evaluation errors", () => {
    const unresolvedVariable: LineEvaluation = {
      error: 'Unresolved variable "budget"',
      loop: 0,
      status: "error"
    };

    assert.equal(formatResultText(unresolvedVariable), "!");
  });

  test("sizes the result column from the longest formatted equation result", () => {
    assert.equal(
      resultColumnCharacterCount(
        [
          {
            dependsOnLoop: false,
            evaluations: [
              {
                loop: 0,
                status: "success",
                value: {
                  formatted: "$9.35M",
                  isLooped: false,
                  kind: "currency",
                  value: 9_350_000
                }
              }
            ],
            expression: "",
            kind: "equation",
            lineNumber: 0,
            source: ""
          },
          {
            dependsOnLoop: false,
            evaluations: [],
            expression: "",
            kind: "title",
            lineNumber: 1,
            source: "A title that should not affect result width"
          }
        ],
        0
      ),
      6
    );
  });

  test("reserves room for brackets around a looped result", () => {
    assert.equal(
      resultColumnCharacterCount(
        [
          {
            dependsOnLoop: true,
            evaluations: [loopedEvaluation],
            expression: "",
            kind: "equation",
            lineNumber: 0,
            source: "balance = $125 * loop"
          }
        ],
        0
      ),
      7
    );
  });

  test("keeps enough width for result controls when the sheet has no values", () => {
    assert.equal(resultColumnCharacterCount([], 0), 1);
  });
});
