import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { gettingStartedExamples } from "./gettingStartedDocument.ts";
import {
  evaluateLooperText,
  visibleLooperText,
  type LooperEvaluation
} from "./looperEngine.ts";
import {
  buildSyntaxHighlightContext,
  highlightLineSegments,
  type SyntaxClassName,
  type SyntaxHighlightContext,
  type SyntaxSegment
} from "./syntaxHighlighting.ts";

type ClassifiedToken = [text: string, className: SyntaxClassName | undefined];

function classifiedTokens(segments: SyntaxSegment[]): ClassifiedToken[] {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => [segment.text, segment.className]);
}

function lineTokens(
  source: string,
  evaluation: LooperEvaluation,
  context: SyntaxHighlightContext,
  lineNumber: number
): ClassifiedToken[] {
  const sourceLine = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")[
    lineNumber
  ];
  return classifiedTokens(
    highlightLineSegments(sourceLine, evaluation.lines[lineNumber], lineNumber, context)
  );
}

function lineNumberContaining(source: string, text: string): number {
  const lineNumber = source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .findIndex((line) => line.includes(text));
  assert.notEqual(lineNumber, -1, `Expected a line containing ${text}`);
  return lineNumber;
}

function classesForText(tokens: ClassifiedToken[], text: string): Array<SyntaxClassName | undefined> {
  return tokens.filter(([token]) => token === text).map(([, className]) => className);
}

describe("native syntax highlighting semantics", () => {
  function exampleSource(title: string): { loopCount: number; text: string } {
    const example = gettingStartedExamples.find((candidate) => candidate.title === title);
    assert.ok(example, `Expected a Getting Started example titled ${title}`);
    return {
      loopCount: example.loopCount,
      text: visibleLooperText(example.text, example.isLoopEnabled)
    };
  }

  test("routes the Getting Started showcase through native semantic roles", () => {
    const functions = exampleSource("Functions");
    const functionsText = functions.text;
    const functionsEvaluation = evaluateLooperText(functionsText, functions.loopCount);
    const functionsContext = buildSyntaxHighlightContext(
      functionsText,
      functionsEvaluation
    );
    const runway = exampleSource("Startup Runway");
    const runwayText = runway.text;
    const runwayEvaluation = evaluateLooperText(runwayText, runway.loopCount);
    const runwayContext = buildSyntaxHighlightContext(runwayText, runwayEvaluation);
    const sumSection = exampleSource("Sum Section");
    const sumSectionText = sumSection.text;
    const sumSectionEvaluation = evaluateLooperText(
      sumSectionText,
      sumSection.loopCount
    );
    const sumSectionContext = buildSyntaxHighlightContext(
      sumSectionText,
      sumSectionEvaluation
    );

    assert.deepEqual(lineTokens(runwayText, runwayEvaluation, runwayContext, 0), [
      ["Startup runway:", "syntax-subtitle"]
    ]);

    const declarationLine = lineNumberContaining(
      functionsText,
      "monthlyInterest(rate, loan)"
    );
    const declaration = lineTokens(
      functionsText,
      functionsEvaluation,
      functionsContext,
      declarationLine
    );
    assert.deepEqual(classesForText(declaration, "monthlyInterest"), ["syntax-user-function"]);
    for (const parameter of ["rate", "loan"]) {
      const classes = classesForText(declaration, parameter);
      assert.ok(classes.length > 0);
      assert.ok(classes.every((className) => className === "syntax-variable"));
    }

    const callLine = lineNumberContaining(functionsText, "loan_a_monthly =");
    const call = lineTokens(
      functionsText,
      functionsEvaluation,
      functionsContext,
      callLine
    );
    assert.deepEqual(classesForText(call, "loan_a_monthly"), ["syntax-variable"]);
    assert.deepEqual(classesForText(call, "monthlyInterest"), ["syntax-user-function"]);
    for (const number of ["2.75%", "$3M"]) {
      assert.deepEqual(classesForText(call, number), ["syntax-number"]);
    }

    const balanceLine = lineNumberContaining(runwayText, "starting_balance =");
    const balance = lineTokens(runwayText, runwayEvaluation, runwayContext, balanceLine);
    assert.deepEqual(classesForText(balance, "loop"), ["syntax-loop"]);
    assert.deepEqual(classesForText(balance, "starting_balance"), ["syntax-variable"]);
    assert.deepEqual(classesForText(balance, "cash_in_bank"), ["syntax-variable"]);
    assert.deepEqual(classesForText(balance, "monthly_burn"), ["syntax-variable"]);

    const endingLine = lineNumberContaining(runwayText, "ending_balance =");
    const ending = lineTokens(runwayText, runwayEvaluation, runwayContext, endingLine);
    assert.deepEqual(classesForText(ending, "ending_balance"), ["syntax-variable"]);
    assert.deepEqual(classesForText(ending, "starting_balance"), ["syntax-variable"]);
    assert.deepEqual(classesForText(ending, "revenue"), ["syntax-variable"]);
    assert.deepEqual(classesForText(ending, "expenses"), ["syntax-variable"]);

    const totalLine = lineNumberContaining(sumSectionText, "total =");
    const total = lineTokens(
      sumSectionText,
      sumSectionEvaluation,
      sumSectionContext,
      totalLine
    );
    assert.deepEqual(classesForText(total, "total"), ["syntax-variable"]);
    assert.deepEqual(classesForText(total, "sumsection"), ["syntax-reserved"]);

    const mathText = `circle = pi * 6 ^ 2
product = 250 x 600 * 2
signal = sin(π / 2)`;
    const mathEvaluation = evaluateLooperText(mathText, 0);
    const mathContext = buildSyntaxHighlightContext(mathText, mathEvaluation);
    const piLine = lineNumberContaining(mathText, "circle =");
    assert.deepEqual(
      classesForText(lineTokens(mathText, mathEvaluation, mathContext, piLine), "pi"),
      ["syntax-number"]
    );
    const productLine = lineNumberContaining(mathText, "product =");
    const product = lineTokens(mathText, mathEvaluation, mathContext, productLine);
    assert.deepEqual(classesForText(product, "x"), ["syntax-operator"]);
    assert.deepEqual(classesForText(product, "*"), ["syntax-operator"]);
    const trigLine = lineNumberContaining(mathText, "signal =");
    const trig = lineTokens(mathText, mathEvaluation, mathContext, trigLine);
    assert.deepEqual(classesForText(trig, "sin"), ["syntax-reserved"]);
    assert.deepEqual(classesForText(trig, "π"), ["syntax-number"]);
  });

  test("renders unusually long lines without recursively classifying nested calls", () => {
    const source = "f(".repeat(10_000);
    const evaluation = evaluateLooperText(source, 0);
    const context = buildSyntaxHighlightContext(source, evaluation);

    assert.deepEqual(highlightLineSegments(source, evaluation.lines[0], 0, context), [
      { text: source }
    ]);
  });

  test("distinguishes ordinary, unresolved, invalid-call, stock, title, and error tokens", () => {
    const source = `
day = 3
answer = day
double(x) {
x * 2
}
valid = double(2)
grouped = double(1,000)
invalid = double(1, 2)
unknown = mystery
recursive(x) {
recursive(x)
}
Market: details
quote = $AAPL.daylow
bad name = 3
// plain comment`;
    const result = evaluateLooperText(source, 0);
    const syntaxContext = buildSyntaxHighlightContext(source, result);

    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 1), "day"), [
      "syntax-variable"
    ]);
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 2), "day"), [
      "syntax-variable"
    ]);
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 6), "double"), [
      "syntax-user-function"
    ]);
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 7), "double"), [
      "syntax-user-function"
    ]);
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 8), "double"), [
      "syntax-expression"
    ]);
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 9), "mystery"), [
      "syntax-expression"
    ]);
    assert.deepEqual(
      classesForText(lineTokens(source, result, syntaxContext, 11), "recursive"),
      ["syntax-expression"]
    );
    assert.deepEqual(lineTokens(source, result, syntaxContext, 13), [
      ["Market:", "syntax-subtitle"],
      [" details", "syntax-expression"]
    ]);
    assert.deepEqual(
      classesForText(lineTokens(source, result, syntaxContext, 14), "$AAPL.daylow"),
      ["syntax-stock"]
    );
    assert.deepEqual(classesForText(lineTokens(source, result, syntaxContext, 15), "bad name"), [
      "syntax-error"
    ]);
    assert.deepEqual(lineTokens(source, result, syntaxContext, 16), [
      ["// plain comment", "syntax-comment"]
    ]);
  });

  test("highlights basic number functions without stealing sheet-defined functions", () => {
    const source = `absolute = abs(-42)
root = sqrt(81)
rounded = round(3.7)
truncated = trunc(3.7)
direction = sign(-42)`;
    const result = evaluateLooperText(source, 0);
    const syntaxContext = buildSyntaxHighlightContext(source, result);

    for (const [lineNumber, functionName] of [
      [0, "abs"],
      [1, "sqrt"],
      [2, "round"],
      [3, "trunc"],
      [4, "sign"]
    ] as const) {
      assert.deepEqual(
        classesForText(lineTokens(source, result, syntaxContext, lineNumber), functionName),
        ["syntax-reserved"]
      );
    }

    const customSource = `abs(value) { value + 100 }
answer = abs(5)`;
    const customResult = evaluateLooperText(customSource, 0);
    const customContext = buildSyntaxHighlightContext(customSource, customResult);
    assert.deepEqual(
      classesForText(lineTokens(customSource, customResult, customContext, 0), "abs"),
      ["syntax-user-function"]
    );
    assert.deepEqual(
      classesForText(lineTokens(customSource, customResult, customContext, 1), "abs"),
      ["syntax-user-function"]
    );
  });

  test("highlights loop references and marks sheet assignments as errors", () => {
    const source = `value = loop * 2
loop = 8`;
    const result = evaluateLooperText(source, 2);
    const syntaxContext = buildSyntaxHighlightContext(source, result);

    assert.deepEqual(
      classesForText(lineTokens(source, result, syntaxContext, 0), "value"),
      ["syntax-variable"]
    );
    assert.deepEqual(
      classesForText(lineTokens(source, result, syntaxContext, 0), "loop"),
      ["syntax-loop"]
    );
    assert.deepEqual(
      classesForText(lineTokens(source, result, syntaxContext, 1), "loop"),
      ["syntax-error"]
    );
  });

  test("gives globals their own semantic role and navigation name", () => {
    const source = `@Project_Total = 40
remaining = 100 - @PROJECT_TOTAL
missing = @unknown_global`;
    const result = evaluateLooperText(source, 0);
    const syntaxContext = buildSyntaxHighlightContext(source, result);

    for (const [lineNumber, token] of [
      [0, "@Project_Total"],
      [1, "@PROJECT_TOTAL"],
      [2, "@unknown_global"]
    ] as const) {
      const segment = highlightLineSegments(
        source.split("\n")[lineNumber],
        result.lines[lineNumber],
        lineNumber,
        syntaxContext
      ).find((candidate) => candidate.text === token);
      assert.equal(segment?.className, "syntax-global-variable");
      assert.equal(segment?.globalName, token.toLocaleLowerCase());
    }
  });
});

describe("editor syntax color palette", () => {
  test("keeps every dark and light editor color stable", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const [darkTheme, lightTheme = ""] = css.split(':root[data-theme="light"]');

    const darkColors = [
      "--text-editor-expression: #ffffff",
      "--text-editor-comment: rgba(255, 255, 255, 0.33)",
      "--text-editor-variable: #00b1ff",
      "--text-editor-global-variable: #42e8d2",
      "--text-editor-subtitle: #ff57be",
      "--text-editor-user-function-name: #fffd9b",
      "--text-editor-operator: #ffd00f",
      "--text-editor-parenthesis: #ffffff",
      "--text-editor-number: #77e04f",
      "--text-editor-reserved-word: #fffd9b",
      "--text-editor-error: #ff4d67",
      "--text-editor-looped-number: #b186ff",
      "--text-editor-stock-symbol: #fffd9b",
      "--line-number-color: rgba(255, 255, 255, 0.33)",
      "--line-number-active: #ffffff"
    ];
    const lightColors = [
      "--text-editor-expression: #1d1d1f",
      "--text-editor-comment: rgba(0, 0, 0, 0.55)",
      "--text-editor-variable: #006ec1",
      "--text-editor-global-variable: #a40078",
      "--text-editor-subtitle: #c9343a",
      "--text-editor-user-function-name: #c9343a",
      "--text-editor-operator: #c9343a",
      "--text-editor-parenthesis: #1d1d1f",
      "--text-editor-number: #247d22",
      "--text-editor-reserved-word: #87561f",
      "--text-editor-error: #d70015",
      "--text-editor-looped-number: #7723f2",
      "--text-editor-stock-symbol: #87561f",
      "--line-number-color: rgba(0, 0, 0, 0.42)",
      "--line-number-active: #1d1d1f"
    ];

    for (const color of darkColors) assert.ok(darkTheme.includes(color), color);
    for (const color of lightColors) assert.ok(lightTheme.includes(color), color);

    const globalReferenceRule = css.match(
      /\.syntax-global-variable\.global-reference \{([\s\S]*?)\}/
    )?.[1] ?? "";
    const globalReferenceHoverRule = css.match(
      /\.syntax-global-variable\.global-reference:hover \{([\s\S]*?)\}/
    )?.[1] ?? "";
    assert.doesNotMatch(globalReferenceRule, /text-decoration/);
    assert.match(globalReferenceHoverRule, /background:/);
    assert.match(globalReferenceHoverRule, /box-shadow:/);
  });

  test("marks sidebar-published definitions with a deeper dotted treatment", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    assert.match(css, /--text-editor-variable-published:\s*#[0-9a-f]{6}/i);
    assert.match(css, /\.variable-definition\.sidebar-published\s*\{[^}]*text-decoration-style:\s*dotted/s);
    assert.match(css, /\.syntax-variable\.variable-definition\.sidebar-published/);
  });
});
