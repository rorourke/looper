export function isDividerLine(source: string): boolean {
  return /^\s*-{3,}\s*$/.test(source);
}

export function shouldDisplayDivider(source: string, isCursorOnLine: boolean): boolean {
  return isDividerLine(source) && !isCursorOnLine;
}

export type DividerLineEdit = {
  inserted: boolean;
  targetLineNumber: number;
  text: string;
};

export function toggleDividerAboveLine(text: string, lineNumber: number): DividerLineEdit {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!Number.isInteger(lineNumber) || lineNumber < 0 || lineNumber >= lines.length) {
    return { inserted: false, targetLineNumber: lineNumber, text };
  }

  if (lineNumber > 0 && isDividerLine(lines[lineNumber - 1] ?? "")) {
    lines.splice(lineNumber - 1, 1);
    return {
      inserted: false,
      targetLineNumber: lineNumber - 1,
      text: lines.join("\n")
    };
  }

  lines.splice(lineNumber, 0, "---");
  return {
    inserted: true,
    targetLineNumber: lineNumber + 1,
    text: lines.join("\n")
  };
}
