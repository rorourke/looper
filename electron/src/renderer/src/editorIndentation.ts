export type EditorTextEdit = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

export const functionBodyIndent = "\t";

function clampSelection(value: string, position: number): number {
  return Math.max(0, Math.min(position, value.length));
}

function lineStartIndex(value: string, position: number): number {
  return value.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
}

function leadingWhitespace(value: string): string {
  return value.match(/^[\t ]*/)?.[0] ?? "";
}

type OpenFunctionContext = {
  bodyIndent: string;
  closingIndent: string;
};

function openFunctionContextBefore(
  value: string,
  position: number
): OpenFunctionContext | undefined {
  const source = value.slice(0, position);
  const contexts: OpenFunctionContext[] = [];

  for (const line of source.split("\n")) {
    const code = line.replace(/\/\/.*$/, "");
    const lineIndent = leadingWhitespace(line);
    for (const character of code) {
      if (character === "{") {
        const parentBodyIndent = contexts.at(-1)?.bodyIndent ?? "";
        const closingIndent = lineIndent.startsWith(parentBodyIndent)
          ? lineIndent
          : parentBodyIndent;
        contexts.push({
          bodyIndent: `${closingIndent}${functionBodyIndent}`,
          closingIndent
        });
      }
      if (character === "}") contexts.pop();
    }
  }

  return contexts.at(-1);
}

export function insertIndentedNewline(
  value: string,
  selectionStart: number,
  selectionEnd = selectionStart
): EditorTextEdit {
  const start = clampSelection(value, selectionStart);
  const end = Math.max(start, clampSelection(value, selectionEnd));
  const beforeSelection = value.slice(0, start);
  let afterSelection = value.slice(end);
  const currentLineBeforeCaret = beforeSelection.slice(
    lineStartIndex(beforeSelection, beforeSelection.length)
  );
  const currentIndent = leadingWhitespace(currentLineBeforeCaret);
  const opensFunctionBody = currentLineBeforeCaret
    .replace(/\/\/.*$/, "")
    .trimEnd()
    .endsWith("{");
  const functionContext = openFunctionContextBefore(value, start);
  const nextIndent =
    functionContext && !currentIndent.startsWith(functionContext.bodyIndent)
      ? functionContext.bodyIndent
      : currentIndent;

  let insertion = `\n${nextIndent}`;
  if (opensFunctionBody && functionContext) {
    const closingBrace = afterSelection.match(/^[\t ]*}/);
    if (closingBrace) {
      afterSelection = afterSelection.slice(closingBrace[0].length - 1);
      insertion += `\n${functionContext.closingIndent}`;
    }
  }

  const caretPosition = beforeSelection.length + 1 + nextIndent.length;
  return {
    text: `${beforeSelection}${insertion}${afterSelection}`,
    selectionStart: caretPosition,
    selectionEnd: caretPosition
  };
}

export function insertDedentedClosingBrace(
  value: string,
  selectionStart: number,
  selectionEnd = selectionStart
): EditorTextEdit | undefined {
  const start = clampSelection(value, selectionStart);
  const end = Math.max(start, clampSelection(value, selectionEnd));
  if (start !== end) return undefined;

  const currentLineStart = lineStartIndex(value, start);
  const currentLineBeforeCaret = value.slice(currentLineStart, start);
  if (
    !currentLineBeforeCaret.endsWith(functionBodyIndent) ||
    currentLineBeforeCaret.trim().length > 0 ||
    !openFunctionContextBefore(value, currentLineStart)
  ) {
    return undefined;
  }

  const dedentedWhitespace = currentLineBeforeCaret.slice(
    0,
    -functionBodyIndent.length
  );
  const replacement = `${dedentedWhitespace}}`;
  const caretPosition = currentLineStart + replacement.length;
  return {
    text: `${value.slice(0, currentLineStart)}${replacement}${value.slice(end)}`,
    selectionStart: caretPosition,
    selectionEnd: caretPosition
  };
}
