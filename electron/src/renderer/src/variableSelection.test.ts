import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  reconcilePublishedLineNumbers,
  reconcileSelectedVariableLines,
  reconcileVariableDefinitions,
  remapVariableDefinitionMetadata,
  variableDefinitionStateForText,
  variableGroupsForOptions,
  variableOptionsForText
} from "./variableSelection.ts";

describe("variable selection", () => {
  test("keeps published titles, blanks, and arbitrary lines attached while editing", () => {
    const before = "Budget:\n\nFurniture = 200\nTotal = Furniture";
    const after = "Overview:\nBudget:\n\nFurniture = 250\nTotal = Furniture";

    assert.deepEqual(reconcilePublishedLineNumbers(before, after, [1, 2]), [2, 3]);
  });

  test("keeps every redefinition and labels it with section context", () => {
    const options = variableOptionsForText([
      "Good:",
      "Furniture = 200k",
      "Better:",
      "furniture = 500k",
      "furniture = 600k",
      "loop = 3"
    ].join("\n"));

    assert.deepEqual(
      options.map(({ isRedefinition, lineNumber, name, occurrence, qualifier }) => ({
        isRedefinition,
        lineNumber,
        name,
        occurrence,
        qualifier
      })),
      [
        {
          isRedefinition: false,
          lineNumber: 1,
          name: "Furniture",
          occurrence: 1,
          qualifier: "Good"
        },
        {
          isRedefinition: true,
          lineNumber: 3,
          name: "furniture",
          occurrence: 2,
          qualifier: "Better #1"
        },
        {
          isRedefinition: true,
          lineNumber: 4,
          name: "furniture",
          occurrence: 3,
          qualifier: "Better #2"
        }
      ]
    );
  });

  test("uses occurrence labels when definitions have no section title", () => {
    const options = variableOptionsForText(
      "furniture = 200k\n\nfurniture = 500k\nfurniture = 900k"
    );

    assert.deepEqual(options.map((option) => option.qualifier), ["#1", "#2", "#3"]);
    assert.deepEqual(options.map((option) => option.isRedefinition), [false, true, true]);
  });

  test("keeps section and fallback labels distinct when only some definitions have titles", () => {
    const options = variableOptionsForText(
      "furniture = 200k\nGood:\nfurniture = 500k"
    );

    assert.deepEqual(options.map((option) => option.qualifier), ["#1", "Good"]);
  });

  test("groups case-insensitive redefinitions for the variables drawer", () => {
    const groups = variableGroupsForOptions(
      variableOptionsForText("Furniture = 1\nfurniture = 2\nother = 3")
    );

    assert.deepEqual(
      groups.map((group) => ({
        count: group.definitions.length,
        key: group.key,
        name: group.name
      })),
      [
        { count: 2, key: "furniture", name: "Furniture" },
        { count: 1, key: "other", name: "other" }
      ]
    );
  });

  test("keeps the exact published occurrence through inserted blank lines", () => {
    const before = "first = 1\nsecond = 2\nsecond = 3";
    const initial = variableDefinitionStateForText(before, [], [2]);
    const selectedId = initial.metadata.find((definition) => definition.lineNumber === 2)?.id;
    const after = "first = 1\n\n\nsecond = 2\nsecond = 3";
    const reconciled = reconcileVariableDefinitions(
      before,
      after,
      initial.metadata,
      initial.selectedLineNumbers
    );

    assert.deepEqual(reconciled.selectedLineNumbers, [4]);
    assert.equal(
      reconciled.metadata.find((definition) => definition.lineNumber === 4)?.id,
      selectedId
    );
  });

  test("keeps a published definition selected while its value or name is edited", () => {
    const before = "furniture = 200\nother = 3";
    const initial = variableDefinitionStateForText(before, [], [0]);
    const selectedId = initial.metadata[0]?.id;
    const after = "fixtures = 250\nother = 3";
    const reconciled = reconcileVariableDefinitions(
      before,
      after,
      initial.metadata,
      initial.selectedLineNumbers
    );

    assert.deepEqual(reconciled.selectedLineNumbers, [0]);
    assert.equal(reconciled.metadata[0]?.id, selectedId);
    assert.equal(reconciled.definitions[0]?.name, "fixtures");
  });

  test("leaves a newly pasted distinct definition unpublished", () => {
    const before = "furniture = 200";
    const initial = variableDefinitionStateForText(before, [], [0]);
    const reconciled = reconcileVariableDefinitions(
      before,
      "furniture = 200\nfurniture = 500",
      initial.metadata,
      initial.selectedLineNumbers
    );

    assert.deepEqual(reconciled.selectedLineNumbers, [0]);
    assert.equal(reconciled.definitions.length, 2);
  });

  test("safely unpublishes when an identical pasted copy makes identity ambiguous", () => {
    const before = "furniture = 200";
    const initial = variableDefinitionStateForText(before, [], [0]);
    const reconciled = reconcileVariableDefinitions(
      before,
      "furniture = 200\nfurniture = 200",
      initial.metadata,
      initial.selectedLineNumbers
    );

    assert.deepEqual(reconciled.selectedLineNumbers, []);
    assert.equal(reconciled.definitions.length, 2);
  });

  test("keeps selection attached to definitions when lines move", () => {
    const before = [
      "income = 100",
      "tax = income * 0.2",
      "",
      "net = income - tax"
    ].join("\n");
    const after = [
      "",
      "net = income - tax",
      "income = 100",
      "tax = income * 0.2"
    ].join("\n");

    assert.deepEqual(reconcileSelectedVariableLines(before, after, [0, 3]), [1, 2]);
  });

  test("leaves new variables hidden and removes deleted variables", () => {
    const before = "kept = 1\ndeleted = 2";
    const after = "kept = 1\nadded = 3";

    assert.deepEqual(reconcileSelectedVariableLines(before, after, [0, 1]), [0, 1]);
    assert.deepEqual(reconcileSelectedVariableLines(before, "kept = 1", [1]), []);
  });

  test("does not publish the first variable typed into a blank sheet", () => {
    assert.deepEqual(reconcileSelectedVariableLines("", "revenue = 100", []), []);
  });

  test("remaps stored identities alongside explicit row reordering", () => {
    const state = variableDefinitionStateForText("first = 1\nsecond = 2");
    const remapped = remapVariableDefinitionMetadata(
      state.metadata,
      new Map([[0, 1], [1, 0]])
    );

    assert.equal(remapped.find((definition) => definition.lineNumber === 1)?.id, state.metadata[0]?.id);
    assert.equal(remapped.find((definition) => definition.lineNumber === 0)?.id, state.metadata[1]?.id);
  });

  test("does not expose loop or function-local assignments", () => {
    const options = variableOptionsForText([
      "tax(amount) {",
      "  local = amount * 10%",
      "  return local",
      "}",
      "loop = 3",
      "visible = 1"
    ].join("\n"));

    assert.deepEqual(options.map((option) => option.name), ["visible"]);
  });
});
