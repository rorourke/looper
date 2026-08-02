const untitledDocumentTitle = "Untitled";

function titleFromSheetText(text: string): string | undefined {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    const commentIndex = line.indexOf("//");
    const code = (commentIndex >= 0 ? line.slice(0, commentIndex) : line).trim();
    const colonIndex = code.indexOf(":");
    if (colonIndex < 0) continue;

    const title = code.slice(0, colonIndex).trim();
    if (title) return title;
  }

  return undefined;
}

export function autoTitleForSheet(currentTitle: string, text: string): string {
  if (currentTitle !== untitledDocumentTitle) return currentTitle;
  return titleFromSheetText(text) ?? currentTitle;
}
