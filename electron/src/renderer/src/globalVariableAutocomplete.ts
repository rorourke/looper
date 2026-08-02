export type GlobalVariableAutocompleteToken = {
  end: number;
  lineNumber: number;
  query: string;
  start: number;
};

export type GlobalVariableAutocompleteDefinition = {
  documentId: string;
  documentTitle: string;
  lineNumber: number;
  name: string;
  normalizedName: string;
};

export type GlobalVariableAutocompleteEdit = {
  selectionEnd: number;
  selectionStart: number;
  text: string;
};

export function globalVariableTokenAtCaret(
  text: string,
  caret: number
): GlobalVariableAutocompleteToken | undefined {
  const safeCaret = Math.max(0, Math.min(Math.trunc(caret), text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeCaret - 1)) + 1;
  const lineEndIndex = text.indexOf("\n", safeCaret);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const beforeCaret = text.slice(lineStart, safeCaret);
  const match = beforeCaret.match(/(?:^|[^@A-Za-z0-9_])(@[A-Za-z0-9_]*)$/);
  const tokenText = match?.[1];
  if (!tokenText) return undefined;

  const start = safeCaret - tokenText.length;
  const commentIndex = text.slice(lineStart, lineEnd).indexOf("//");
  if (commentIndex !== -1 && lineStart + commentIndex <= start) return undefined;

  const trailingName = text.slice(safeCaret, lineEnd).match(/^[A-Za-z0-9_]*/)?.[0] ?? "";
  return {
    end: safeCaret + trailingName.length,
    lineNumber: text.slice(0, lineStart).split("\n").length - 1,
    query: tokenText.slice(1),
    start
  };
}

export function globalVariableAutocompleteSuggestions(
  definitions: readonly GlobalVariableAutocompleteDefinition[],
  query: string,
  excludedLocation?: { documentId: string; lineNumber: number },
  limit = 8
): GlobalVariableAutocompleteDefinition[] {
  const normalizedQuery = query.toLocaleLowerCase();
  const seenNames = new Set<string>();
  return definitions
    .filter((definition) => {
      if (seenNames.has(definition.normalizedName)) return false;
      seenNames.add(definition.normalizedName);
      if (
        excludedLocation &&
        definition.documentId === excludedLocation.documentId &&
        definition.lineNumber === excludedLocation.lineNumber
      ) {
        return false;
      }
      return definition.normalizedName.slice(1).startsWith(normalizedQuery);
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    )
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function completeGlobalVariableToken(
  text: string,
  token: GlobalVariableAutocompleteToken,
  name: string
): GlobalVariableAutocompleteEdit {
  const caret = token.start + name.length;
  return {
    selectionEnd: caret,
    selectionStart: caret,
    text: `${text.slice(0, token.start)}${name}${text.slice(token.end)}`
  };
}
