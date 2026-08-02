import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createInitialDocument,
  DEFAULT_DECIMAL_PLACES,
  evaluateLooperText as evaluateSheetText,
  extractStockSymbols,
  normalizeDocumentData,
  normalizeDecimalPlaces,
  normalizeLoopPeriodLabel,
  type LineEvaluation,
  type LooperEvaluation,
  type StockQuote,
  type StockQuoteMap
} from "./looperEngine.ts";
import { insertIndentedNewline } from "./editorIndentation.ts";

function evaluateLooperText(
  source: string,
  loopCountOrLegacyEnabled: number | boolean = true,
  stockQuotes: StockQuoteMap = {}
): LooperEvaluation {
  if (typeof loopCountOrLegacyEnabled === "number") {
    return evaluateSheetText(source, loopCountOrLegacyEnabled, stockQuotes);
  }

  const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const legacyLoop = lines[0]?.match(/^loop\s*=\s*(\d+)$/i);
  if (legacyLoop) {
    return evaluateSheetText(lines.slice(1).join("\n"), Number(legacyLoop[1]), stockQuotes);
  }
  return evaluateSheetText(source, loopCountOrLegacyEnabled ? 3 : 0, stockQuotes);
}

describe("sheet loop metadata", () => {
  test("starts new documents with a basic loop example and no loop row", () => {
    const data = createInitialDocument();
    assert.equal(data.text, "10 * loop");
    assert.equal(data.decimalPlaces, DEFAULT_DECIMAL_PLACES);
    assert.equal(data.loopCount, 3);
    assert.equal(data.loopPeriod, "Loop");
    assert.deepEqual(data.loopedLines, []);
    assert.deepEqual(data.loopSidebarDividerLines, []);
    assert.equal(data.isLoopVariablePublished, false);
  });

  test("preserves valid sidebar divider positions", () => {
    const data = normalizeDocumentData({
      ...createInitialDocument(),
      loopSidebarDividerLines: [4, -1, 0, 2.5, 4]
    });

    assert.deepEqual(data.loopSidebarDividerLines, [0, 4]);
  });

  test("keeps only unique in-range published line numbers", () => {
    const data = normalizeDocumentData({
      ...createInitialDocument(),
      text: "first = 1\nsecond = 2",
      loopedLines: [1, -1, 1, 2, "0"]
    });

    assert.deepEqual(data.loopedLines, [1]);
  });

  test("defaults the loop variable on for older sheets and preserves an explicit opt-out", () => {
    const olderSheet = normalizeDocumentData({
      title: "Older sheet",
      text: "value = loop * 2",
      loopCount: 3,
      loopedLines: []
    });
    const optedOutSheet = normalizeDocumentData({
      ...createInitialDocument(),
      isLoopVariablePublished: false
    });

    assert.equal(olderSheet.isLoopVariablePublished, true);
    assert.equal(optedOutSheet.isLoopVariablePublished, false);
  });

  test("keeps decimal precision on each sheet and clamps it between zero and three", () => {
    const olderSheet = normalizeDocumentData({
      title: "Older sheet",
      text: "value = 1 / 3"
    });
    const oneDecimal = normalizeDocumentData({
      ...olderSheet,
      decimalPlaces: 1
    });

    assert.equal(olderSheet.decimalPlaces, 2);
    assert.equal(oneDecimal.decimalPlaces, 1);
    assert.equal(normalizeDecimalPlaces(-10), 0);
    assert.equal(normalizeDecimalPlaces(2.9), 2);
    assert.equal(normalizeDecimalPlaces(10), 3);
    assert.equal(normalizeDecimalPlaces("not a number"), 2);
  });

  test("allows no iteration label only when the loop count is zero", () => {
    assert.equal(normalizeLoopPeriodLabel(undefined, 0), "None");
    assert.equal(normalizeLoopPeriodLabel("None", 0), "None");
    assert.equal(normalizeLoopPeriodLabel("Month", 0), "Month");
    assert.equal(normalizeLoopPeriodLabel("None", 1), "Year");
    assert.equal(normalizeLoopPeriodLabel(undefined, 1), "Year");

    const zeroLoopSheet = normalizeDocumentData({
      title: "Static sheet",
      text: "total = 2 + 2",
      loopCount: 0,
      loopedLines: []
    });
    const loopedSheet = normalizeDocumentData({
      ...zeroLoopSheet,
      loopCount: 2,
      loopPeriod: "None"
    });

    assert.equal(zeroLoopSheet.loopPeriod, "None");
    assert.equal(loopedSheet.loopPeriod, "Year");
  });

  test("migrates the old top loop row into sheet metadata", () => {
    const data = normalizeDocumentData({
      title: "Legacy",
      text: "loop = 8\n\nvalue = loop * 2",
      fontScale: 0,
      loopPeriod: "Year",
      loopedLines: [0, 2],
      isLoopEnabled: true,
      isResultsHidden: false,
      resultSortMode: "manual"
    });

    assert.equal(data.loopCount, 8);
    assert.equal(data.text, "value = loop * 2");
    assert.deepEqual(data.loopedLines, [0]);
  });

  test("preserves repeated Enter edits without creating content", () => {
    let edit = insertIndentedNewline("", 0);
    for (let index = 0; index < 4; index += 1) {
      edit = insertIndentedNewline(edit.text, edit.selectionStart, edit.selectionEnd);
    }

    const data = normalizeDocumentData({ ...createInitialDocument(), text: edit.text });
    assert.equal(data.text, "\n\n\n\n\n");
    assert.equal(data.text.includes("loop"), false);
  });

  test("drives loop calculations from the supplied sheet count", () => {
    const result = evaluateLooperText("value = loop * 2", 2);

    assert.equal(result.loopCount, 2);
    assert.deepEqual(values(result, "value"), [0, 2, 4]);
  });

  test("rejects every attempt to assign the reserved loop word", () => {
    const result = evaluateLooperText("loop = 8\nvalue = loop", 2);
    const assignment = result.lines[0];
    assert.equal(result.loopCount, 2);
    assert.deepEqual(values(result, "value"), [0, 1, 2]);
    assert.equal(assignment.parseError, '"loop" is reserved and cannot be assigned in the sheet');
    assert.ok(assignment.evaluations.every((evaluation) => evaluation.status === "error"));
    assert.match(assignment.evaluations[0].error ?? "", /reserved/);

    const reloaded = normalizeDocumentData({
      ...createInitialDocument(),
      loopCount: 2,
      text: "loop = 8"
    });
    assert.equal(reloaded.text, "loop = 8");
  });

  test("fails oversized loop evaluation closed without allocating every cell", () => {
    const source = Array.from({ length: 2_000 }, (_, index) => `value_${index} = loop`).join("\n");
    const result = evaluateLooperText(source, 1_000);

    assert.equal(result.loopCount, 0);
    assert.equal(result.lines.length, 2_000);
    assert.equal(result.lines[0].evaluations.length, 1);
    assert.match(result.lines[0].evaluations[0].error ?? "", /too large/i);
  });
});

function line(result: LooperEvaluation, variable: string): LineEvaluation[] {
  const match = result.lines.find(
    (candidate) => candidate.variable?.toLowerCase() === variable.toLowerCase()
  );
  assert.ok(match, `Expected a line assigning ${variable}`);
  return match.evaluations;
}

function values(result: LooperEvaluation, variable: string): number[] {
  return line(result, variable).map((evaluation) => {
    assert.equal(evaluation.status, "success", evaluation.error ?? `Expected ${variable} to succeed`);
    assert.ok(evaluation.value);
    return evaluation.value.value;
  });
}

function approximately(actual: number[], expected: number[], epsilon = 1e-9): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= epsilon, `${value} != ${expected[index]}`);
  });
}

describe("Looper expression language", () => {
  test("supports native numeric forms, operators, constants, and math functions", () => {
    const result = evaluateLooperText(`loop = 0
grouped = 1,250,000
currency = $24 * (1 + 20%)
ascii_x = 250 x 600
asterisk = 250 * 600
si = 82k + 2M
unicode = 12 × 3 ÷ 2
circle = pi * 6 ^ 2
rounded = floor(3.9) + ceil(3.1)
trig = sin(π / 2) + cos(0) + tan(0)
magnitude = log(1M)
tiny = 1u`);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "grouped"), [1_250_000]);
    approximately(values(result, "currency"), [28.8]);
    assert.deepEqual(values(result, "ascii_x"), [150_000]);
    assert.deepEqual(values(result, "asterisk"), [150_000]);
    assert.deepEqual(values(result, "si"), [2_082_000]);
    assert.deepEqual(values(result, "unicode"), [18]);
    approximately(values(result, "circle"), [Math.PI * 36]);
    assert.deepEqual(values(result, "rounded"), [7]);
    approximately(values(result, "trig"), [2]);
    assert.deepEqual(values(result, "magnitude"), [6]);
    assert.equal(line(result, "tiny")[0].value?.formatted, "0");
  });

  test("limits displayed results to two decimal places and rounds tiny currency to zero", () => {
    const result = evaluateLooperText(`decimal = 1.23456
rounded_up = 1.999
currency = $1 / 3
currency_residue = $0.0000000004656613`, 0);

    assert.equal(result.errors, 0);
    assert.equal(line(result, "decimal")[0].value?.formatted, "1.23");
    assert.equal(line(result, "rounded_up")[0].value?.formatted, "2");
    assert.equal(line(result, "currency")[0].value?.formatted, "$0.33");
    assert.equal(line(result, "currency_residue")[0].value?.formatted, "$0.00");
  });

  test("formats results with each sheet's selected decimal places", () => {
    const source = `decimal = 1.23456
currency = $1 / 3
currency_residue = $0.0000000004656613`;
    const oneDecimal = evaluateSheetText(source, 0, {}, 1);
    const threeDecimals = evaluateSheetText(source, 0, {}, 3);

    assert.equal(line(oneDecimal, "decimal")[0].value?.formatted, "1.2");
    assert.equal(line(oneDecimal, "currency")[0].value?.formatted, "$0.3");
    assert.equal(line(oneDecimal, "currency_residue")[0].value?.formatted, "$0.0");
    assert.equal(line(threeDecimals, "decimal")[0].value?.formatted, "1.235");
    assert.equal(line(threeDecimals, "currency")[0].value?.formatted, "$0.333");
    assert.equal(line(threeDecimals, "currency_residue")[0].value?.formatted, "$0.000");
  });

  test("supports basic number functions without shadowing sheet-defined functions", () => {
    const result = evaluateLooperText(`absolute = abs(-42)
root = sqrt(81)
rounded = round(3.7)
truncated = trunc(3.7)
direction = sign(-42)`, 0);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "absolute"), [42]);
    assert.deepEqual(values(result, "root"), [9]);
    assert.deepEqual(values(result, "rounded"), [4]);
    assert.deepEqual(values(result, "truncated"), [3]);
    assert.deepEqual(values(result, "direction"), [-1]);

    const customized = evaluateLooperText(`abs(value) { value + 100 }
answer = abs(5)`, 0);
    assert.equal(customized.errors, 0);
    assert.deepEqual(values(customized, "answer"), [105]);

    const wrongArity = evaluateLooperText("answer = round(3.14159, 2)", 0);
    assert.equal(wrongArity.errors, 1);
    assert.match(line(wrongArity, "answer")[0].error ?? "", /expects one argument/i);
  });

  test("rejects undefined arithmetic and special-function results", () => {
    const result = evaluateLooperText(`division = 1 / 0
indeterminate = 0 / 0
badRoot = sqrt(-1)
badLog = log(-1)
zeroLog = log(0)
badPower = (-1) ^ 0.5`, 0);

    assert.equal(result.errors, 6);
    for (const variable of [
      "division",
      "indeterminate",
      "badRoot",
      "badLog",
      "zeroLog",
      "badPower"
    ]) {
      assert.equal(line(result, variable)[0].status, "error");
    }
    assert.match(line(result, "division")[0].error ?? "", /division by zero/i);
  });

  test("uses precise decimal arithmetic for large integers, cancellation, and averages", () => {
    const result = evaluateLooperText(`unsafeDifference = 9007199254740993 - 9007199254740992
cancellation = 10000000000000000 + 1 - 10000000000000000
decimalDrift = (0.1 + 0.2 - 0.3) * 1P
large = 1Y ^ 20
averageInput = 1Y ^ 12.8
stableAverage = loop.avg(averageInput)`, 20);

    assert.deepEqual(values(result, "unsafeDifference"), Array(21).fill(1));
    assert.deepEqual(values(result, "cancellation"), Array(21).fill(1));
    assert.deepEqual(values(result, "decimalDrift"), Array(21).fill(0));
    assert.equal(line(result, "large")[0].value?.exactValue, "1e+480");
    assert.equal(
      line(result, "stableAverage")[0].value?.exactValue,
      line(result, "averageInput")[0].value?.exactValue
    );
    assert.notEqual(line(result, "stableAverage")[0].value?.formatted, "Infinity");
  });

  test("uses conventional power precedence and symmetric half-up rounding", () => {
    const result = evaluateLooperText(`precedence = -2 ^ 2
parenthesized = (-2) ^ 2
negativeExponent = 2 ^ -2
powerChain = 2 ^ 3 ^ 2
negativeHalf = round(-1.5)
positiveHalf = round(1.5)
negativeZero = trunc(-0.1)`, 0);

    assert.deepEqual(values(result, "precedence"), [-4]);
    assert.deepEqual(values(result, "parenthesized"), [4]);
    assert.deepEqual(values(result, "negativeExponent"), [0.25]);
    assert.deepEqual(values(result, "powerChain"), [512]);
    assert.deepEqual(values(result, "negativeHalf"), [-2]);
    assert.deepEqual(values(result, "positiveHalf"), [2]);
    assert.equal(Object.is(values(result, "negativeZero")[0], -0), false);
    assert.equal(line(result, "negativeZero")[0].value?.formatted, "0");

    const zeroDecimals = evaluateSheetText(
      "raw = -1.5\nrounded = round(-1.5)",
      0,
      {},
      0
    );
    assert.equal(line(zeroDecimals, "raw")[0].value?.formatted, "-2");
    assert.equal(line(zeroDecimals, "rounded")[0].value?.formatted, "-2");
  });

  test("abbreviates large result values with familiar compact suffixes", () => {
    const result = evaluateLooperText(`loop = 0
thousand = 30,000
million = 32,000,000
billion = 3,200,000,000
trillion = $3,200,000,000,000
rounded = 999,999
negative = -35,500
belowThreshold = 999`);

    assert.equal(result.errors, 0);
    assert.equal(line(result, "thousand")[0].value?.formatted, "30K");
    assert.equal(line(result, "million")[0].value?.formatted, "32M");
    assert.equal(line(result, "billion")[0].value?.formatted, "3.2B");
    assert.equal(line(result, "trillion")[0].value?.formatted, "$3.2T");
    assert.equal(line(result, "rounded")[0].value?.formatted, "1M");
    assert.equal(line(result, "negative")[0].value?.formatted, "-35.5K");
    assert.equal(line(result, "belowThreshold")[0].value?.formatted, "999");
  });

  test("resolves full loop history instead of running partial history", () => {
    const result = evaluateLooperText(`loop = 3
value = loop * 10
previous = loop.previous(value)
first = loop.first(value)
last = loop.last(value)
minimum = loop.min(value)
maximum = loop.max(value)
average = loop.avg(value)`);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "previous"), [0, 0, 10, 20]);
    assert.deepEqual(values(result, "first"), [0, 0, 0, 0]);
    assert.deepEqual(values(result, "last"), [30, 30, 30, 30]);
    assert.deepEqual(values(result, "minimum"), [0, 0, 0, 0]);
    assert.deepEqual(values(result, "maximum"), [30, 30, 30, 30]);
    assert.deepEqual(values(result, "average"), [15, 15, 15, 15]);
  });

  test("supports argument-less loop selectors with or without parentheses", () => {
    const result = evaluateLooperText(`loop = 4
first = loop.first
last = loop.last()
previous = loop.previous()
minimum = loop.min
maximum = loop.max()
average = loop.avg`);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "first"), [0, 0, 0, 0, 0]);
    assert.deepEqual(values(result, "last"), [4, 4, 4, 4, 4]);
    assert.deepEqual(values(result, "previous"), [0, 0, 1, 2, 3]);
    assert.deepEqual(values(result, "minimum"), [0, 0, 0, 0, 0]);
    assert.deepEqual(values(result, "maximum"), [4, 4, 4, 4, 4]);
    assert.deepEqual(values(result, "average"), [2, 2, 2, 2, 2]);
  });

  test("supports explicit recurrence, zero-default self references, and sequential reassignment", () => {
    const explicit = evaluateLooperText(`loop = 3
weekly = 100
total = loop.previous(total) * 1.1 + weekly`);
    assert.equal(explicit.errors, 0);
    approximately(values(explicit, "total"), [100, 210, 331, 464.1]);

    const implicit = evaluateLooperText(`loop = 3
balance = 100
balance = balance * 1.1`);
    assert.equal(implicit.errors, 0);
    approximately(values(implicit, "balance"), [100, 100, 100, 100]);
    const redefinition = implicit.lines.filter(
      (candidate) => candidate.variable?.toLowerCase() === "balance"
    )[1];
    assert.ok(redefinition);
    approximately(
      redefinition.evaluations.map((evaluation) => evaluation.value?.value ?? Number.NaN),
      [110, 110, 110, 110]
    );
    assert.equal(redefinition.dependsOnLoop, false);

    const seededExplicit = evaluateLooperText(`loop = 3
x = 10
x = loop.previous(x) + 2`);
    assert.equal(seededExplicit.errors, 0);
    const seededRedefinition = seededExplicit.lines.filter(
      (candidate) => candidate.variable?.toLowerCase() === "x"
    )[1];
    assert.ok(seededRedefinition);
    assert.deepEqual(
      seededRedefinition.evaluations.map((evaluation) => evaluation.value?.value),
      [2, 4, 6, 8]
    );

    const zeroDefaultSelfReference = evaluateLooperText(`loop = 3
burn = $50k
total_burn = total_burn + burn`);
    assert.equal(zeroDefaultSelfReference.errors, 0);
    assert.deepEqual(values(zeroDefaultSelfReference, "total_burn"), [
      50_000, 50_000, 50_000, 50_000
    ]);
    assert.equal(
      zeroDefaultSelfReference.lines.find(
        (candidate) => candidate.variable === "total_burn"
      )?.dependsOnLoop,
      false
    );

    const staticSalaryChain = evaluateLooperText(`loop = 3
taxrate = 37.1%
salary = salary - (salary * taxrate)
investments = $750.79k
income = salary + investments
burnrate = income - $1.35M`);
    assert.deepEqual(values(staticSalaryChain, "salary"), [0, 0, 0, 0]);
    assert.deepEqual(values(staticSalaryChain, "income"), [
      750_790, 750_790, 750_790, 750_790
    ]);
    assert.deepEqual(values(staticSalaryChain, "burnrate"), [
      -599_210, -599_210, -599_210, -599_210
    ]);
    for (const variable of ["salary", "income", "burnrate"]) {
      assert.equal(
        staticSalaryChain.lines.find(
          (candidate) => candidate.variable === variable
        )?.dependsOnLoop,
        false
      );
    }

    const loopDrivenSelfReference = evaluateLooperText(`loop = 3
total = total + loop
downstream = total + 1`);
    assert.deepEqual(values(loopDrivenSelfReference, "total"), [0, 1, 2, 3]);
    assert.deepEqual(values(loopDrivenSelfReference, "downstream"), [1, 2, 3, 4]);
    assert.equal(
      loopDrivenSelfReference.lines.find(
        (candidate) => candidate.variable === "downstream"
      )?.dependsOnLoop,
      true
    );

    const misspelledReference = evaluateLooperText(`loop = 2
burn = $50k
total_burn = total_brn + burn`);
    const misspelledTotal = line(misspelledReference, "total_burn");
    assert.equal(misspelledReference.errors, 3);
    assert.ok(
      misspelledTotal.every(
        (evaluation) =>
          evaluation.status === "error" &&
          evaluation.error === 'Unresolved variable "total_brn"'
      )
    );

    const staticSelfReference = evaluateLooperText(
      `burn = $50k
total_burn = total_burn + burn`,
      false
    );
    assert.equal(staticSelfReference.errors, 0);
    assert.deepEqual(values(staticSelfReference, "total_burn"), [50_000]);
  });

  test("keeps selector lookup tied to the nearest prior definition", () => {
    const result = evaluateLooperText(`loop = 2
x = loop
firstX = loop.first(x)
lastX = loop.last(x)
x = 100 + loop`);
    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "firstX"), [0, 0, 0]);
    assert.deepEqual(values(result, "lastX"), [2, 2, 2]);
  });

  test("treats variable names as case-insensitive", () => {
    const result = evaluateLooperText(`loop = 2
StartingBalance = 100 + loop
result = startingbalance
ending = loop.last(STARTINGBALANCE)`);
    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "result"), [100, 101, 102]);
    assert.deepEqual(values(result, "ending"), [102, 102, 102]);
  });

  test("keeps index and iteration available as ordinary native variables", () => {
    const result = evaluateLooperText(`loop = 2
index = 100
iteration = index + 1
answer = index + iteration`);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "index"), [100, 100, 100]);
    assert.deepEqual(values(result, "iteration"), [101, 101, 101]);
    assert.deepEqual(values(result, "answer"), [201, 201, 201]);
  });
});

describe("section reducers", () => {
  test("supports sum, average, minimum, and maximum with exact section boundaries", () => {
    const result = evaluateLooperText(`loop = 2

Bills:
rent = $2,000 + loop * 100
car = $400
groceries = $600
total = sumsection

Sleep:
monday = 7
tuesday = 8
wednesday = 6
average = avgsection

Race:
lap1 = 63.8
lap2 = 62.4
lap3 = 64.1
fastest = minsection

Greenhouse:
morning = 68
noon = 79
afternoon = 84
peak = maxsection`);

    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "total"), [3000, 3100, 3200]);
    assert.deepEqual(values(result, "average"), [7, 7, 7]);
    assert.deepEqual(values(result, "fastest"), [62.4, 62.4, 62.4]);
    assert.deepEqual(values(result, "peak"), [84, 84, 84]);
    assert.equal(line(result, "total")[0].value?.kind, "currency");
  });

  test("a reducer closes its section even without a blank line", () => {
    const result = evaluateLooperText(`loop = 0
a = 1
b = 2
firstTotal = sumsection
c = 10
d = 20
secondTotal = sumsection`);
    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "firstTotal"), [3]);
    assert.deepEqual(values(result, "secondTotal"), [30]);
  });

  test("a divider is structural and closes the current section", () => {
    const result = evaluateLooperText(`first = 1
---
second = 2
total = sumsection`, 0);

    assert.equal(result.errors, 0);
    assert.equal(result.lines[1].kind, "empty");
    assert.equal(result.lines[1].evaluations[0].status, "empty");
    assert.deepEqual(values(result, "total"), [2]);
  });

  test("propagates an input error instead of returning an incomplete summary", () => {
    const result = evaluateLooperText(`known = 100
broken = missing + 50
total = sumsection`, 0);

    assert.equal(line(result, "broken")[0].status, "error");
    assert.equal(line(result, "total")[0].status, "error");
    assert.match(line(result, "total")[0].error ?? "", /cannot include line 2/i);
  });
});

describe("user functions", () => {
  test("executes inline, multiline, nested, and loop-dependent functions", () => {
    const result = evaluateLooperText(`loop = 3
double(x) { x * 2 }
compound(amount, rate, periods) {
factor = (1 + rate) ^ periods
amount * factor
}
boost(value) {
double(value) + 5
}
principal = $10,000
balance = compound(principal, 7%, loop)
boosted = boost(loop)`);

    assert.equal(result.errors, 0);
    approximately(values(result, "balance"), [10_000, 10_700, 11_449, 12_250.43]);
    assert.deepEqual(values(result, "boosted"), [5, 7, 9, 11]);
    const functionLines = result.lines.filter((candidate) => candidate.kind === "function");
    assert.ok(functionLines.length >= 7);
    assert.ok(functionLines.every((candidate) => candidate.evaluations.every((item) => item.status === "empty")));
  });

  test("reports bad arity and recursion clearly", () => {
    const badArity = evaluateLooperText(`loop = 0
double(x) { x * 2 }
answer = double()`);
    assert.match(line(badArity, "answer")[0].error ?? "", /expects 1 argument/);

    const recursive = evaluateLooperText(`loop = 0
again(x) { again(x) }
answer = again(1)`);
    assert.match(line(recursive, "answer")[0].error ?? "", /Recursive function/);
  });
});

describe("market symbols", () => {
  test("extracts symbols and evaluates injected live prices", () => {
    const quote: StockQuote = {
      symbol: "AAPL",
      price: 215
    };
    const source = `loop = 0
apple = $aapl
holding = $AAPL * 10`;
    const result = evaluateLooperText(source, true, { AAPL: quote });

    assert.deepEqual(extractStockSymbols(`${source}\n// ignored = $MSFT`), ["AAPL"]);
    assert.equal(result.errors, 0);
    assert.deepEqual(values(result, "apple"), [215]);
    assert.deepEqual(values(result, "holding"), [2_150]);
  });

  test("explains that live market data is price-only", () => {
    const result = evaluateLooperText(
      "dayHigh = $AAPL.dayhigh",
      0,
      { AAPL: { price: 215 } }
    );

    assert.equal(result.errors, 1);
    assert.match(line(result, "dayHigh")[0].error ?? "", /supports prices only/i);
    assert.match(line(result, "dayHigh")[0].error ?? "", /use \$AAPL/i);
  });
});
