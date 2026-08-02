export function lineIndexAtVerticalOffset(
  rowHeights: number[],
  verticalOffset: number,
  minimumIndex = 0
): number {
  if (rowHeights.length === 0) return -1;

  const lowerBound = Math.max(0, Math.min(minimumIndex, rowHeights.length - 1));
  let rowBottom = 0;

  for (let index = 0; index < rowHeights.length; index += 1) {
    rowBottom += Math.max(0, rowHeights[index] ?? 0);
    if (index >= lowerBound && verticalOffset < rowBottom) return index;
  }

  return rowHeights.length - 1;
}

export function lineUsesFullEditorWidth(source: string): boolean {
  return source.trimStart().startsWith("//");
}

export function editorRowsMatchText(rowSources: string[], text: string): boolean {
  // Even an empty document needs one row so the caret inherits the editor inset.
  return rowSources.length > 0 && rowSources.join("\n") === text;
}

export type RowDragShiftDirection = "down" | "up";

export function rowDragShiftDirection(
  sourceIndex: number,
  targetIndex: number,
  rowIndex: number
): RowDragShiftDirection | undefined {
  if (sourceIndex < targetIndex && rowIndex > sourceIndex && rowIndex <= targetIndex) {
    return "up";
  }

  if (sourceIndex > targetIndex && rowIndex >= targetIndex && rowIndex < sourceIndex) {
    return "down";
  }

  return undefined;
}
