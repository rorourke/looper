import type { EditorTextEdit } from "./editorIndentation";

const lineCommentPrefix = "// ";

function clampSelection(value: string, position: number): number {
  return Math.max(0, Math.min(position, value.length));
}

function lineStartIndex(value: string, position: number): number {
  if (position <= 0) return 0;
  return value.lastIndexOf("\n", position - 1) + 1;
}

function lineEndIndex(value: string, position: number): number {
  const nextLineBreak = value.indexOf("\n", position);
  return nextLineBreak < 0 ? value.length : nextLineBreak;
}

type LineCommentEdit = {
  end: number;
  replacement: string;
  start: number;
};

function selectionOffsetAfterEdits(
  position: number,
  edits: readonly LineCommentEdit[],
  includeEditAtPosition: boolean
): number {
  return edits.reduce((offset, edit) => {
    const applies = includeEditAtPosition ? edit.start <= position : edit.start < position;
    if (!applies) return offset;
    return offset + edit.replacement.length - (edit.end - edit.start);
  }, position);
}

export function toggleLineComments(
  value: string,
  selectionStart: number,
  selectionEnd = selectionStart
): EditorTextEdit {
  const start = clampSelection(value, Math.min(selectionStart, selectionEnd));
  const end = clampSelection(value, Math.max(selectionStart, selectionEnd));
  const selectedLineStart = lineStartIndex(value, start);
  const finalSelectedPosition = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const selectedLineEnd = lineEndIndex(value, finalSelectedPosition);
  const selectedSource = value.slice(selectedLineStart, selectedLineEnd);
  const lines = selectedSource.split("\n");
  const allLinesAreCommented = lines.every((line) => /^\s*\/\//.test(line));
  const edits: LineCommentEdit[] = [];
  let lineOffset = selectedLineStart;

  for (const line of lines) {
    const leadingWhitespaceLength = line.match(/^[\t ]*/)?.[0].length ?? 0;
    const commentStart = lineOffset + leadingWhitespaceLength;

    if (allLinesAreCommented) {
      const comment = line.slice(leadingWhitespaceLength).match(/^\/\/[ ]?/);
      if (comment) {
        edits.push({ end: commentStart + comment[0].length, replacement: "", start: commentStart });
      }
    } else {
      edits.push({ end: commentStart, replacement: lineCommentPrefix, start: commentStart });
    }

    lineOffset += line.length + 1;
  }

  let text = value;
  for (const edit of [...edits].reverse()) {
    text = `${text.slice(0, edit.start)}${edit.replacement}${text.slice(edit.end)}`;
  }

  if (start === end) {
    const caret = selectionOffsetAfterEdits(start, edits, true);
    return { text, selectionStart: caret, selectionEnd: caret };
  }

  return {
    text,
    selectionStart: selectionOffsetAfterEdits(start, edits, false),
    selectionEnd: selectionOffsetAfterEdits(end, edits, true)
  };
}
