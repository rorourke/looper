import { isDividerLine } from "./dividerLine.ts";
import type { LooperDocumentData, ParsedLine } from "./looperEngine.ts";
import Decimal from "decimal.js";

export type SectionSortDirection = "ascending" | "descending";

export type SectionSortUndoSnapshot = {
  documentId: string;
  loopedLines: number[];
  resultSortMode: LooperDocumentData["resultSortMode"];
  text: string;
  variableDefinitions: LooperDocumentData["variableDefinitions"];
  wasDirty: boolean;
};

type SortableSectionRow = {
  lineIndex: number;
  value: number;
  exactValue: string;
};

const sectionReducerPattern = /\b(?:sumsection|avgsection|minsection|maxsection)\b/i;
const orderIndependentVariableNames = new Set([
  "loop",
  "pi",
  "sumsection",
  "avgsection",
  "minsection",
  "maxsection"
]);

export function createSectionSortUndoSnapshot(
  documentId: string,
  data: LooperDocumentData,
  wasDirty: boolean
): SectionSortUndoSnapshot {
  return {
    documentId,
    loopedLines: [...data.loopedLines],
    resultSortMode: data.resultSortMode,
    text: data.text,
    variableDefinitions: data.variableDefinitions?.map((definition) => ({ ...definition })),
    wasDirty
  };
}

export function restoreSectionSortSnapshot(
  data: LooperDocumentData,
  snapshot: SectionSortUndoSnapshot
): LooperDocumentData {
  return {
    ...data,
    loopedLines: [...snapshot.loopedLines],
    resultSortMode: snapshot.resultSortMode,
    text: snapshot.text,
    variableDefinitions: snapshot.variableDefinitions?.map((definition) => ({ ...definition }))
  };
}

export function isSortableSectionTitle(line: ParsedLine | undefined): boolean {
  if (line?.kind !== "title") return false;
  return line.source.replace(/\/\/.*$/, "").trimEnd().endsWith(":");
}

function isSectionReducerLine(line: ParsedLine | undefined): boolean {
  return line?.kind === "equation" && sectionReducerPattern.test(line.expression);
}

function sectionEndIndex(lines: ParsedLine[], titleLineIndex: number): number {
  for (let lineIndex = titleLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    if (
      isSortableSectionTitle(lines[lineIndex]) ||
      isDividerLine(lines[lineIndex]?.source ?? "")
    ) {
      return lineIndex;
    }
  }
  return lines.length;
}

function pinnedSectionReducerIndex(
  lines: ParsedLine[],
  titleLineIndex: number
): number | undefined {
  const sectionEnd = sectionEndIndex(lines, titleLineIndex);
  let lineIndex = sectionEnd - 1;
  while (lineIndex > titleLineIndex && lines[lineIndex]?.kind === "empty") {
    lineIndex -= 1;
  }
  return isSectionReducerLine(lines[lineIndex]) ? lineIndex : undefined;
}

function expressionReferencesVariable(expression: string, variable: string): boolean {
  if (orderIndependentVariableNames.has(variable)) return false;

  const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const referencePattern = new RegExp(
    `(^|[^_$A-Za-z0-9.])${escapedVariable}(?![_A-Za-z0-9.])`,
    "gi"
  );

  for (const match of expression.matchAll(referencePattern)) {
    const tokenEnd = (match.index ?? 0) + match[0].length;
    if (!expression.slice(tokenEnd).trimStart().startsWith("(")) return true;
  }

  return false;
}

function relativeOrderCanChange(
  leftLineIndex: number,
  rightLineIndex: number,
  sortableLineIndexes: Set<number>
): boolean {
  const leftIsSortable = sortableLineIndexes.has(leftLineIndex);
  const rightIsSortable = sortableLineIndexes.has(rightLineIndex);
  if (leftIsSortable && rightIsSortable) return true;
  if (!leftIsSortable && !rightIsSortable) return false;

  const fixedLineIndex = leftIsSortable ? rightLineIndex : leftLineIndex;
  let hasSortableLineBefore = false;
  let hasSortableLineAfter = false;
  for (const lineIndex of sortableLineIndexes) {
    hasSortableLineBefore ||= lineIndex < fixedLineIndex;
    hasSortableLineAfter ||= lineIndex > fixedLineIndex;
  }
  return hasSortableLineBefore && hasSortableLineAfter;
}

function sortableSectionRows(
  lines: ParsedLine[],
  titleLineIndex: number,
  resultLoop: number
): SortableSectionRow[] {
  if (!isSortableSectionTitle(lines[titleLineIndex])) return [];

  const sectionEnd = sectionEndIndex(lines, titleLineIndex);

  const pinnedReducerLineIndex = pinnedSectionReducerIndex(lines, titleLineIndex);

  const rows: SortableSectionRow[] = [];
  for (let lineIndex = titleLineIndex + 1; lineIndex < sectionEnd; lineIndex += 1) {
    const line = lines[lineIndex];
    if (lineIndex === pinnedReducerLineIndex) continue;

    const evaluation = line?.evaluations[resultLoop];
    const value = evaluation?.status === "success" ? evaluation.value?.value : undefined;
    const exactValue = evaluation?.status === "success" && typeof value === "number"
      ? evaluation.value?.exactValue ?? (Number.isFinite(value) ? String(value) : undefined)
      : undefined;
    if (typeof value === "number" && exactValue && new Decimal(exactValue).isFinite()) {
      rows.push({ lineIndex, value, exactValue });
    }
  }

  return rows;
}

export function canSafelySortSection(
  lines: ParsedLine[],
  titleLineIndex: number,
  resultLoop: number
): boolean {
  if (!isSortableSectionTitle(lines[titleLineIndex])) return false;

  const sortableRows = sortableSectionRows(lines, titleLineIndex, resultLoop);
  if (sortableRows.length < 2) return false;

  const sortableLineIndexes = new Set(sortableRows.map((row) => row.lineIndex));
  const sectionEnd = sectionEndIndex(lines, titleLineIndex);
  const pinnedReducerLineIndex = pinnedSectionReducerIndex(lines, titleLineIndex);
  const definitions = new Map<string, number[]>();

  // A reducer closes the evaluator's current group. Only a trailing reducer can
  // remain fixed while its own input rows are sorted.
  for (let lineIndex = titleLineIndex + 1; lineIndex < sectionEnd; lineIndex += 1) {
    if (
      isSectionReducerLine(lines[lineIndex]) &&
      lineIndex !== pinnedReducerLineIndex
    ) {
      return false;
    }
  }

  if (pinnedReducerLineIndex !== undefined) {
    let reducerInputStartIndex = pinnedReducerLineIndex;
    for (
      let lineIndex = pinnedReducerLineIndex - 1;
      lineIndex > titleLineIndex;
      lineIndex -= 1
    ) {
      if (
        lines[lineIndex]?.kind !== "equation" ||
        isSectionReducerLine(lines[lineIndex])
      ) {
        break;
      }
      reducerInputStartIndex = lineIndex;
    }
    if (sortableRows.some((row) => row.lineIndex < reducerInputStartIndex)) {
      return false;
    }
  }

  for (let lineIndex = titleLineIndex + 1; lineIndex < sectionEnd; lineIndex += 1) {
    const variable = lines[lineIndex]?.variable?.toLowerCase();
    if (!variable) continue;
    const lineIndexes = definitions.get(variable) ?? [];
    lineIndexes.push(lineIndex);
    definitions.set(variable, lineIndexes);
  }

  // Reordering duplicate assignments can change which value later rows resolve.
  for (const lineIndexes of definitions.values()) {
    for (let left = 0; left < lineIndexes.length; left += 1) {
      for (let right = left + 1; right < lineIndexes.length; right += 1) {
        if (relativeOrderCanChange(lineIndexes[left], lineIndexes[right], sortableLineIndexes)) {
          return false;
        }
      }
    }
  }

  // A row that consumes a variable assigned by another row is position-sensitive.
  for (let lineIndex = titleLineIndex + 1; lineIndex < sectionEnd; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line?.kind !== "equation") continue;

    for (const [variable, definitionLineIndexes] of definitions) {
      if (!expressionReferencesVariable(line.expression, variable)) continue;
      for (const definitionLineIndex of definitionLineIndexes) {
        if (
          definitionLineIndex !== lineIndex &&
          relativeOrderCanChange(definitionLineIndex, lineIndex, sortableLineIndexes)
        ) {
          return false;
        }
      }
    }
  }

  // A reducer that can move would change the group of rows it summarizes.
  for (let lineIndex = titleLineIndex + 1; lineIndex < sectionEnd; lineIndex += 1) {
    if (isSectionReducerLine(lines[lineIndex]) && sortableLineIndexes.has(lineIndex)) return false;
  }

  return true;
}

export function currentSectionSortDirection(
  lines: ParsedLine[],
  titleLineIndex: number,
  resultLoop: number
): SectionSortDirection | undefined {
  const rows = sortableSectionRows(lines, titleLineIndex, resultLoop);
  if (rows.length < 2) return undefined;

  const isAscending = rows.every(
    (row, index) => index === 0 || new Decimal(rows[index - 1].exactValue).lte(row.exactValue)
  );
  const isDescending = rows.every(
    (row, index) => index === 0 || new Decimal(rows[index - 1].exactValue).gte(row.exactValue)
  );

  if (isAscending === isDescending) return undefined;
  return isAscending ? "ascending" : "descending";
}

export function nextSectionSortDirection(
  lines: ParsedLine[],
  titleLineIndex: number,
  resultLoop: number
): SectionSortDirection {
  return currentSectionSortDirection(lines, titleLineIndex, resultLoop) === "descending"
    ? "ascending"
    : "descending";
}

export function buildSectionSortLineOrder(
  lines: ParsedLine[],
  titleLineIndex: number,
  resultLoop: number,
  direction: SectionSortDirection
): number[] {
  const lineOrder = Array.from({ length: lines.length }, (_, index) => index);
  const rows = sortableSectionRows(lines, titleLineIndex, resultLoop);

  const sortedRows = [...rows].sort((left, right) => {
    const comparison = direction === "ascending"
      ? new Decimal(left.exactValue).cmp(right.exactValue)
      : new Decimal(right.exactValue).cmp(left.exactValue);
    return comparison || left.lineIndex - right.lineIndex;
  });

  rows.forEach((row, index) => {
    lineOrder[row.lineIndex] = sortedRows[index].lineIndex;
  });

  return lineOrder;
}
