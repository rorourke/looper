import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { exportLooperCsv } from "./csvExport.ts";
import { evaluateLooperText } from "./looperEngine.ts";

describe("CSV export", () => {
  test("mirrors the sheet with titles, summaries, and loop columns", () => {
    const evaluation = evaluateLooperText(`Budget:
rent = $2,000
seasonal = $100 + loop * 25
total = sumsection
`, 2);

    assert.equal(
      exportLooperCsv(evaluation, "Month"),
      [
        "Calculation,Summary,Month 0,Month 1,Month 2",
        "Budget:,,,,",
        '"rent = $2,000",2000,2000,2000,2000',
        "seasonal = $100 + loop * 25,150,100,125,150",
        "total = sumsection,2150,2100,2125,2150",
        ""
      ].join("\r\n")
    );
  });

  test("preserves notes and blank rows while escaping spreadsheet text", () => {
    const evaluation = evaluateLooperText(`Notes:
// Keep this context

-2`, 0);

    assert.equal(
      exportLooperCsv(evaluation, "Step"),
      [
        "Calculation,Summary,Step 0",
        "Notes:,,",
        "// Keep this context,,",
        ",,",
        "'-2,-2,-2",
        ""
      ].join("\r\n")
    );
  });

  test("exports an unlabeled zero-count sheet without inventing a label", () => {
    const evaluation = evaluateLooperText("total = 2 + 2", 0);

    assert.equal(
      exportLooperCsv(evaluation, "None"),
      [
        "Calculation,Summary,0",
        "total = 2 + 2,4,4",
        ""
      ].join("\r\n")
    );
  });

  test("escapes CSV punctuation and preserves evaluation errors", () => {
    const evaluation = evaluateLooperText(`Quarter "A", assumptions:
broken = missing`, 0);

    assert.equal(
      exportLooperCsv(evaluation, "=Period"),
      [
        "Calculation,Summary,'=Period 0",
        '"Quarter ""A"", assumptions:",,',
        'broken = missing,"Error: Unresolved variable ""missing""","Error: Unresolved variable ""missing"""',
        ""
      ].join("\r\n")
    );
  });

  test("exports exact decimal values beyond JavaScript's safe integer range", () => {
    const evaluation = evaluateLooperText(
      "exact = 9007199254740993\ndifference = exact - 9007199254740992",
      0
    );

    assert.equal(
      exportLooperCsv(evaluation, "None"),
      [
        "Calculation,Summary,0",
        "exact = 9007199254740993,9007199254740993,9007199254740993",
        "difference = exact - 9007199254740992,1,1",
        ""
      ].join("\r\n")
    );
  });
});
