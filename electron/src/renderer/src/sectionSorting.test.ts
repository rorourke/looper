import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gettingStartedExamples } from "./gettingStartedDocument.ts";
import type { LineEvaluation, ParsedLine } from "./looperEngine.ts";
import { createInitialDocument, evaluateLooperText } from "./looperEngine.ts";
import {
  buildSectionSortLineOrder,
  canSafelySortSection,
  createSectionSortUndoSnapshot,
  currentSectionSortDirection,
  isSortableSectionTitle,
  nextSectionSortDirection,
  restoreSectionSortSnapshot
} from "./sectionSorting.ts";

function line(
  lineNumber: number,
  kind: ParsedLine["kind"],
  value?: number
): ParsedLine {
  const evaluation: LineEvaluation = value === undefined
    ? { loop: 0, status: kind === "title" ? "title" : "empty" }
    : {
        loop: 0,
        status: "success",
        value: { formatted: String(value), isLooped: false, kind: "decimal", value }
      };

  return {
    dependsOnLoop: false,
    evaluations: [evaluation],
    expression: "",
    kind,
    lineNumber,
    source: kind === "title"
      ? `Section ${lineNumber}:`
      : kind === "empty"
        ? ""
        : `value_${lineNumber} = ${value ?? ""}`
  };
}

function sectionReducer(lineNumber: number, value: number): ParsedLine {
  return {
    ...line(lineNumber, "equation", value),
    expression: "sumsection",
    source: "total = sumsection"
  };
}

function formula(
  lineNumber: number,
  variable: string,
  expression: string,
  value: number
): ParsedLine {
  return {
    ...line(lineNumber, "equation", value),
    expression,
    source: `${variable} = ${expression}`,
    variable
  };
}

describe("section result sorting", () => {
  test("captures and restores the exact pre-sort row state", () => {
    const beforeSort = {
      ...createInitialDocument(),
      loopedLines: [1, 3],
      resultSortMode: "ascending" as const,
      text: "Bills:\nrent = 2000\ncar = 400",
      variableDefinitions: [{
        id: "rent-definition",
        lineNumber: 1,
        normalizedName: "rent",
        source: "rent = 2000"
      }]
    };
    const snapshot = createSectionSortUndoSnapshot("sheet-1", beforeSort, false);
    beforeSort.loopedLines.push(5);
    beforeSort.variableDefinitions?.push({
      id: "car-definition",
      lineNumber: 2,
      normalizedName: "car",
      source: "car = 400"
    });

    const restored = restoreSectionSortSnapshot(
      {
        ...beforeSort,
        loopCount: 12,
        loopedLines: [2, 1, 3],
        resultSortMode: "manual",
        text: "Bills:\ncar = 400\nrent = 2000"
      },
      snapshot
    );

    assert.equal(snapshot.documentId, "sheet-1");
    assert.equal(snapshot.wasDirty, false);
    assert.equal(restored.text, beforeSort.text);
    assert.deepEqual(restored.loopedLines, [1, 3]);
    assert.deepEqual(restored.variableDefinitions, [{
      id: "rent-definition",
      lineNumber: 1,
      normalizedName: "rent",
      source: "rent = 2000"
    }]);
    assert.equal(restored.resultSortMode, "ascending");
    assert.equal(restored.loopCount, 12);
  });

  test("sorts numeric rows without crossing the next title or moving structural rows", () => {
    const lines = [
      line(0, "title"),
      line(1, "equation", 20),
      line(2, "equation", 5),
      line(3, "empty"),
      line(4, "equation", 10),
      line(5, "title"),
      line(6, "equation", 100)
    ];

    assert.deepEqual(buildSectionSortLineOrder(lines, 0, 0, "descending"), [0, 1, 4, 3, 2, 5, 6]);
    assert.deepEqual(buildSectionSortLineOrder(lines, 0, 0, "ascending"), [0, 2, 4, 3, 1, 5, 6]);
  });

  test("keeps equal totals stable", () => {
    const lines = [
      line(0, "title"),
      line(1, "equation", 10),
      line(2, "equation", 10),
      line(3, "equation", 5)
    ];

    assert.deepEqual(buildSectionSortLineOrder(lines, 0, 0, "descending"), [0, 1, 2, 3]);
  });

  test("sorts by exact values when approximate numbers are indistinguishable", () => {
    const result = evaluateLooperText(
      "Large values:\nhigh = 9007199254740993\nlow = 9007199254740992",
      0
    );

    assert.equal(result.lines[1].evaluations[0].value?.value, 9007199254740992);
    assert.equal(result.lines[2].evaluations[0].value?.value, 9007199254740992);
    assert.deepEqual(
      buildSectionSortLineOrder(result.lines, 0, 0, "ascending"),
      [0, 2, 1]
    );
  });

  test("pins a trailing section reducer ahead of blank lines and the next title", () => {
    const lines = [
      line(0, "title"),
      line(1, "equation", 10),
      line(2, "equation", 30),
      sectionReducer(3, 40),
      line(4, "empty"),
      line(5, "title"),
      line(6, "equation", 100)
    ];

    assert.deepEqual(buildSectionSortLineOrder(lines, 0, 0, "descending"), [0, 2, 1, 3, 4, 5, 6]);
  });

  test("allows a section reducer in the middle of a section to move", () => {
    const lines = [
      line(0, "title"),
      line(1, "equation", 10),
      sectionReducer(2, 30),
      line(3, "equation", 20),
      line(4, "title")
    ];

    assert.deepEqual(buildSectionSortLineOrder(lines, 0, 0, "descending"), [0, 2, 3, 1, 4]);
  });

  test("only treats rows ending in a colon as sortable section titles", () => {
    const title = line(0, "title");
    const inlineSubtitle = { ...line(1, "title"), source: "Market: details" };

    assert.equal(isSortableSectionTitle(title), true);
    assert.equal(isSortableSectionTitle(inlineSubtitle), false);
    assert.deepEqual(
      buildSectionSortLineOrder([inlineSubtitle, line(1, "equation", 20)], 0, 0, "descending"),
      [0, 1]
    );
  });

  test("toggles descending to ascending and defaults other arrangements to descending", () => {
    const descending = [line(0, "title"), line(1, "equation", 20), line(2, "equation", 10)];
    const ascending = [line(0, "title"), line(1, "equation", 10), line(2, "equation", 20)];
    const unsorted = [
      line(0, "title"),
      line(1, "equation", 10),
      line(2, "equation", 30),
      line(3, "equation", 20)
    ];

    assert.equal(currentSectionSortDirection(descending, 0, 0), "descending");
    assert.equal(nextSectionSortDirection(descending, 0, 0), "ascending");
    assert.equal(nextSectionSortDirection(ascending, 0, 0), "descending");
    assert.equal(nextSectionSortDirection(unsorted, 0, 0), "descending");
  });

  test("allows independent values with any supported trailing section summary", () => {
    for (const reducer of ["sumsection", "avgsection", "minsection", "maxsection"]) {
      const summary = {
        ...sectionReducer(3, 2400),
        expression: reducer,
        source: `summary = ${reducer}`
      };
      const lines = [
        line(0, "title"),
        formula(1, "rent", "2000", 2000),
        formula(2, "car", "400", 400),
        summary
      ];

      assert.equal(canSafelySortSection(lines, 0, 0), true, reducer);
    }
  });

  test("rejects a section summary that would move with the sorted rows", () => {
    const lines = [
      line(0, "title"),
      formula(1, "first", "10", 10),
      sectionReducer(2, 30),
      formula(3, "last", "20", 20),
      line(4, "title")
    ];

    assert.equal(canSafelySortSection(lines, 0, 0), false);
  });

  test("rejects sections whose formulas depend on neighboring assignments", () => {
    const lines = [
      line(0, "title"),
      formula(1, "balance", "1000", 1000),
      formula(2, "interest", "balance * 5%", 50),
      formula(3, "ending_balance", "balance + interest", 1050)
    ];

    assert.equal(canSafelySortSection(lines, 0, 0), false);
  });

  test("rejects duplicate assignments whose precedence could change", () => {
    const lines = [
      line(0, "title"),
      formula(1, "balance", "1000", 1000),
      formula(2, "balance", "1200", 1200),
      formula(3, "fee", "25", 25)
    ];

    assert.equal(canSafelySortSection(lines, 0, 0), false);
  });

  test("ignores assignments and references beyond the current section", () => {
    const lines = [
      line(0, "title"),
      formula(1, "adjusted", "outside_value + 1", 11),
      formula(2, "flat", "5", 5),
      line(3, "title"),
      formula(4, "outside_value", "10", 10)
    ];

    assert.equal(canSafelySortSection(lines, 0, 0), true);
  });

  test("rejects sections without at least two sortable values", () => {
    const lines = [line(0, "title"), formula(1, "only", "10", 10)];

    assert.equal(canSafelySortSection(lines, 0, 0), false);
  });
});
