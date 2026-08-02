import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractGlobalVariableAssignments,
  type LineEvaluation,
  type LooperEvaluation
} from "./looperEngine.ts";
import {
  GlobalVariableWorkbook,
  type GlobalVariableDocument
} from "./globalVariables.ts";

function sheet(
  id: string,
  text: string,
  loopCount = 0
): GlobalVariableDocument {
  return { decimalPlaces: 2, id, loopCount, text, title: id };
}

function evaluations(result: LooperEvaluation, variable: string): LineEvaluation[] {
  const resultLine = result.lines.find(
    (line) => line.variable?.toLocaleLowerCase() === variable.toLocaleLowerCase()
  );
  assert.ok(resultLine, `Expected ${variable}`);
  return resultLine.evaluations;
}

function values(result: LooperEvaluation, variable: string): number[] {
  return evaluations(result, variable).map((evaluation) => {
    assert.equal(evaluation.status, "success", evaluation.error ?? "Evaluation failed");
    assert.ok(evaluation.value);
    return evaluation.value.value;
  });
}

describe("workbook global variables", () => {
  test("finds only top-level at-sign assignments", () => {
    const assignments = extractGlobalVariableAssignments(`// @comment = 1
_local = 2
helper(_parameter) {
  _inside = _parameter
}
@Budget = _local * 3`);

    assert.deepEqual(assignments, [
      { lineNumber: 5, name: "@Budget", normalizedName: "@budget" }
    ]);
  });

  test("keeps underscore-prefixed names as ordinary sheet-local variables", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("One", `_budget = 10\nanswer = _budget`),
      sheet("Two", `_budget = 20\nanswer = _budget`)
    ]);

    assert.equal(workbook.definitions.size, 0);
    assert.deepEqual(values(workbook.evaluateDocument("One"), "answer"), [10]);
    assert.deepEqual(values(workbook.evaluateDocument("Two"), "answer"), [20]);
  });

  test("resolves a global from its defining sheet and preserves its value kind", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("Construction Budget", `materials = $8M
fees = $500k
@project_budget = materials + fees`),
      sheet("Burn Rate", `cash = $10M
remaining = cash - @PROJECT_BUDGET`)
    ]);

    const result = workbook.evaluateDocument("Burn Rate");
    assert.deepEqual(values(result, "remaining"), [1_500_000]);
    assert.equal(evaluations(result, "remaining")[0].value?.kind, "currency");
    assert.equal(workbook.definition("@Project_Budget")?.documentId, "Construction Budget");
  });

  test("chains globals across sheets and follows the consumer loop up to the source limit", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("Growth", `@annual = 100 * (loop + 1)`, 2),
      sheet("Tax", `@after_tax = @annual * 80%`, 2),
      sheet("Plan", `available = @after_tax`, 3)
    ]);

    assert.deepEqual(values(workbook.evaluateDocument("Plan"), "available"), [
      80,
      160,
      240,
      240
    ]);
  });

  test("preserves exact decimal values across sheets", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("Source", "@exact = 9007199254740993"),
      sheet("Consumer", "difference = @exact - 9007199254740992")
    ]);

    const result = workbook.evaluateDocument("Consumer");
    assert.deepEqual(values(result, "difference"), [1]);
    assert.equal(evaluations(result, "difference")[0].value?.exactValue, "1");
  });

  test("uses the nearest prior value for a static reassignment", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("Properties", `@hamline = 4.41M
@galewood = $13.47M`),
      sheet("Family Runway", `liquid = $27.5M
liquid = liquid - @hamline - @galewood`, 3)
    ]);

    const result = workbook.evaluateDocument("Family Runway");
    const liquidLines = result.lines.filter(
      (candidate) => candidate.variable?.toLocaleLowerCase() === "liquid"
    );
    assert.equal(liquidLines.length, 2);
    assert.deepEqual(
      liquidLines[1].evaluations.map((evaluation) => {
        assert.equal(evaluation.status, "success", evaluation.error ?? "Evaluation failed");
        return evaluation.value?.value;
      }),
      [9_620_000, 9_620_000, 9_620_000, 9_620_000]
    );
    assert.equal(liquidLines[1].dependsOnLoop, false);
  });

  test("invalidates every case-insensitive duplicate definition", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("One", `@Budget = 1`),
      sheet("Two", `@budget = 2`),
      sheet("Three", `answer = @BUDGET`)
    ]);

    for (const id of ["One", "Two"] as const) {
      const result = workbook.evaluateDocument(id);
      assert.match(result.lines[0].parseError ?? "", /defined only once/);
      assert.equal(result.lines[0].evaluations[0].status, "error");
    }
    assert.match(
      evaluations(workbook.evaluateDocument("Three"), "answer")[0].error ?? "",
      /defined only once/
    );
    assert.equal(workbook.definition("@budget"), undefined);
  });

  test("reports circular global dependencies across sheets", () => {
    const workbook = new GlobalVariableWorkbook([
      sheet("One", `@one = @two + 1`),
      sheet("Two", `@two = @one + 1`),
      sheet("Three", `answer = @one`)
    ]);

    assert.match(
      evaluations(workbook.evaluateDocument("Three"), "answer")[0].error ?? "",
      /Circular/
    );
  });

  test("cannot resolve globals from sheets outside the supplied user scope", () => {
    const ownerWorkbook = new GlobalVariableWorkbook([
      sheet("Owner source", `@private_total = 42`),
      sheet("Owner model", `answer = @private_total`)
    ]);
    const visitorWorkbook = new GlobalVariableWorkbook([
      sheet("Shared visitor sheet", `answer = @private_total`)
    ]);

    assert.deepEqual(values(ownerWorkbook.evaluateDocument("Owner model"), "answer"), [42]);
    assert.match(
      evaluations(
        visitorWorkbook.evaluateDocument("Shared visitor sheet"),
        "answer"
      )[0].error ?? "",
      /Unresolved global variable/
    );
  });

  test("does not evaluate a sheet omitted from the current workbook scope", () => {
    const previewWorkbook = new GlobalVariableWorkbook([
      sheet("Visible example", "answer = 42")
    ]);

    assert.equal(
      previewWorkbook.evaluateDocumentIfPresent("Hidden authenticated sheet"),
      undefined
    );
    assert.deepEqual(
      values(
        previewWorkbook.evaluateDocumentIfPresent("Visible example")!,
        "answer"
      ),
      [42]
    );
  });
});
