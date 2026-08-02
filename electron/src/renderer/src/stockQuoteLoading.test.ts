import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { evaluateLooperText } from "./looperEngine.ts";
import { evaluationWaitsForStockQuote } from "./stockQuoteLoading.ts";

describe("stock quote loading presentation", () => {
  test("marks direct and dependent quote errors as loading only while the symbol is in flight", () => {
    const evaluation = evaluateLooperText(
      "tesla = $TSLA\ndouble_tesla = tesla * 2",
      0
    );
    const directQuote = evaluation.lines[0].evaluations[0];
    const dependentQuote = evaluation.lines[1].evaluations[0];

    assert.equal(
      evaluationWaitsForStockQuote(directQuote, new Set(["TSLA"])),
      true
    );
    assert.equal(
      evaluationWaitsForStockQuote(dependentQuote, new Set(["TSLA"])),
      true
    );
    assert.equal(evaluationWaitsForStockQuote(directQuote, new Set()), false);
    assert.equal(
      evaluationWaitsForStockQuote(directQuote, new Set(["AAPL"])),
      false
    );
  });
});
