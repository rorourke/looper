import type { LooperEvaluation, ParsedLine } from "./looperEngine.ts";

export type SyntaxClassName =
  | "syntax-variable"
  | "syntax-global-variable"
  | "syntax-subtitle"
  | "syntax-user-function"
  | "syntax-expression"
  | "syntax-comment"
  | "syntax-operator"
  | "syntax-paren"
  | "syntax-number"
  | "syntax-reserved"
  | "syntax-loop"
  | "syntax-stock"
  | "syntax-error";

export type SyntaxSegment = {
  text: string;
  className?: SyntaxClassName;
  globalName?: string;
};

type FunctionDeclaration = {
  name: string;
  arity: number;
  start: number;
  end: number;
};

type FunctionLineScope = {
  functionName: string;
  resolvedNames: ReadonlySet<string>;
};

export type SyntaxHighlightContext = {
  declarationsByLine: ReadonlyMap<number, FunctionDeclaration>;
  functions: ReadonlyMap<string, number>;
  globalResolvedNames: ReadonlySet<string>;
  scopesByLine: ReadonlyMap<number, FunctionLineScope>;
};

const nativeReservedWords = new Set([
  "sumsection",
  "avgsection",
  "minsection",
  "maxsection",
  "loop.first",
  "loop.last",
  "loop.previous",
  "loop.min",
  "loop.max",
  "loop.avg",
  "floor",
  "ceil",
  "log",
  "sin",
  "cos",
  "tan"
]);
const basicMathFunctionNames = new Set([
  "abs",
  "sqrt",
  "round",
  "trunc",
  "sign"
]);

const loopHelperPattern = /^loop\.(?:first|last|previous|min|max|avg)$/i;
const localIdentifierPattern = /^[_A-Za-z][_A-Za-z0-9]*$/;
const globalIdentifierPattern = /^@[_A-Za-z][_A-Za-z0-9]*$/;
const variableIdentifierPattern = /^(?:@[_A-Za-z]|[_A-Za-z])[_A-Za-z0-9]*$/;
const functionDeclarationPattern =
  /^(\s*)([_A-Za-z][_A-Za-z0-9]*)\s*\(([^)]*)\)\s*\{/;
const maximumHighlightedLineLength = 16_384;
const expressionTokenPatternSource =
  String.raw`\/\/.*|\$[_A-Za-z][_A-Za-z0-9]*(?:\.[_A-Za-z][_A-Za-z0-9]*)?|\$?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:da|[YZEPTGMkhdcmunpfazy])?%?|@[_A-Za-z][_A-Za-z0-9]*|[_A-Za-zπ][_A-Za-z0-9]*(?:\.[_A-Za-z][_A-Za-z0-9]*)?|[=+\-*/^×÷(),:{}]|\S`;

export function buildSyntaxHighlightContext(
  source: string,
  evaluation: LooperEvaluation
): SyntaxHighlightContext {
  const sourceLines = normalizeLineEndings(source).split("\n");
  const functions = new Map<string, number>();
  const declarationsByLine = new Map<number, FunctionDeclaration>();

  sourceLines.forEach((sourceLine, lineNumber) => {
    const code = stripComment(sourceLine);
    const match = code.match(functionDeclarationPattern);
    if (!match) return;

    const parameters = parseParameters(match[3]);
    if (!parameters) return;
    const name = normalizeName(match[2]);
    const start = match[1].length;
    functions.set(name, parameters.length);
    declarationsByLine.set(lineNumber, {
      name,
      arity: parameters.length,
      start,
      end: start + match[2].length
    });
  });

  const globalResolvedNames = new Set<string>();
  for (const line of evaluation.lines) {
    if (
      line.kind === "equation" &&
      line.variable &&
      line.evaluations.some((item) => item.status === "success")
    ) {
      globalResolvedNames.add(normalizeName(line.variable));
    }
  }

  const scopesByLine = new Map<number, FunctionLineScope>();
  let activeFunction:
    | { name: string; resolvedNames: Set<string> }
    | undefined;

  sourceLines.forEach((sourceLine, lineNumber) => {
    const code = stripComment(sourceLine);
    const declarationMatch = code.match(functionDeclarationPattern);

    if (!activeFunction && declarationMatch) {
      const parameters = parseParameters(declarationMatch[3]);
      if (!parameters) return;
      activeFunction = {
        name: normalizeName(declarationMatch[2]),
        resolvedNames: new Set(parameters)
      };
      scopesByLine.set(lineNumber, snapshotScope(activeFunction));

      const bodySource = code.slice(declarationMatch[0].length).split("}", 1)[0];
      addAssignedName(bodySource, activeFunction.resolvedNames);
      if (code.includes("}")) activeFunction = undefined;
      return;
    }

    if (!activeFunction) return;
    scopesByLine.set(lineNumber, snapshotScope(activeFunction));
    addAssignedName(code.split("}", 1)[0], activeFunction.resolvedNames);
    if (code.includes("}")) activeFunction = undefined;
  });

  return {
    declarationsByLine,
    functions,
    globalResolvedNames,
    scopesByLine
  };
}

export function highlightLineSegments(
  source: string,
  line: ParsedLine | undefined,
  lineNumber: number,
  context: SyntaxHighlightContext
): SyntaxSegment[] {
  if (!source) return [{ text: " " }];
  if (source.length > maximumHighlightedLineLength) return [{ text: source }];

  const commentIndex = source.indexOf("//");
  const code = commentIndex >= 0 ? source.slice(0, commentIndex) : source;
  const comment = commentIndex >= 0 ? source.slice(commentIndex) : "";
  const segments = highlightCodeSegments(code, line, lineNumber, context);

  if (comment) segments.push({ text: comment, className: "syntax-comment" });
  return segments.length > 0 ? segments : [{ text: " " }];
}

function highlightCodeSegments(
  source: string,
  line: ParsedLine | undefined,
  lineNumber: number,
  context: SyntaxHighlightContext
): SyntaxSegment[] {
  if (!source) return [];

  if (line?.kind === "title") {
    const colonIndex = source.indexOf(":");
    if (colonIndex < 0) return [{ text: source, className: "syntax-subtitle" }];
    const segments: SyntaxSegment[] = [
      { text: source.slice(0, colonIndex + 1), className: "syntax-subtitle" }
    ];
    if (colonIndex + 1 < source.length) {
      segments.push({
        text: source.slice(colonIndex + 1),
        className: "syntax-expression"
      });
    }
    return segments;
  }

  const equalsIndex = topLevelEqualsIndex(source);
  if (equalsIndex < 0) {
    return tokenizeSyntaxSegments(source, lineNumber, context);
  }

  return [
    ...highlightAssignmentHead(source.slice(0, equalsIndex), line),
    { text: "=", className: "syntax-operator" },
    ...tokenizeSyntaxSegments(source.slice(equalsIndex + 1), lineNumber, context)
  ];
}

function highlightAssignmentHead(
  source: string,
  line: ParsedLine | undefined
): SyntaxSegment[] {
  const match = source.match(/^(\s*)(.*?)(\s*)$/);
  if (!match) return [{ text: source, className: "syntax-error" }];

  const [, leading, name, trailing] = match;
  const segments: SyntaxSegment[] = [];
  if (leading) segments.push({ text: leading });

  if (name) {
    const normalizedName = normalizeName(name);
    const className: SyntaxClassName =
      line?.parseError || !variableIdentifierPattern.test(name)
        ? "syntax-error"
        : normalizedName === "loop"
          ? "syntax-loop"
          : isGlobalVariableName(normalizedName)
            ? "syntax-global-variable"
          : nativeReservedWords.has(normalizedName)
            ? "syntax-reserved"
            : "syntax-variable";
    segments.push({
      text: name,
      className,
      globalName: isGlobalVariableName(normalizedName) ? normalizedName : undefined
    });
  }

  if (trailing) segments.push({ text: trailing });
  return segments;
}

function tokenizeSyntaxSegments(
  source: string,
  lineNumber: number,
  context: SyntaxHighlightContext
): SyntaxSegment[] {
  const segments: SyntaxSegment[] = [];
  const tokenPattern = new RegExp(expressionTokenPatternSource, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(source)) !== null) {
    const token = match[0];
    const index = match.index;
    if (index > lastIndex) segments.push({ text: source.slice(lastIndex, index) });

    if (loopHelperPattern.test(token)) {
      segments.push({ text: token.slice(0, 4), className: "syntax-loop" });
      segments.push({ text: token.slice(4), className: "syntax-reserved" });
      lastIndex = index + token.length;

      const emptyParentheses = source.slice(lastIndex).match(/^(\s*)(\(\s*\))/);
      if (emptyParentheses) {
        if (emptyParentheses[1]) segments.push({ text: emptyParentheses[1] });
        segments.push({ text: emptyParentheses[2], className: "syntax-reserved" });
        lastIndex += emptyParentheses[0].length;
        tokenPattern.lastIndex = lastIndex;
      }
      continue;
    }

    const className = syntaxClassForToken(token, index, source, lineNumber, context);
    segments.push({
      text: token,
      className,
      globalName:
        className === "syntax-global-variable" ? normalizeName(token) : undefined
    });
    lastIndex = index + token.length;
  }

  if (lastIndex < source.length) segments.push({ text: source.slice(lastIndex) });
  return segments;
}

function syntaxClassForToken(
  token: string,
  index: number,
  source: string,
  lineNumber: number,
  context: SyntaxHighlightContext
): SyntaxClassName {
  if (/^\$[_A-Za-z][_A-Za-z0-9]*(?:\.[_A-Za-z][_A-Za-z0-9]*)?$/.test(token)) {
    return "syntax-stock";
  }
  if (/^\$?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)/.test(token)) {
    return "syntax-number";
  }
  if (token === "x" && isInfixMultiplicationX(source, index)) return "syntax-operator";
  if (/^[=+\-*/^×÷]$/.test(token)) return "syntax-operator";
  if (/^[(),:{}]$/.test(token)) return "syntax-paren";

  const normalized = normalizeName(token);
  if (normalized === "loop") return "syntax-loop";
  if (normalized === "pi" || token === "π") return "syntax-number";
  if (nativeReservedWords.has(normalized)) return "syntax-reserved";

  const declaration = context.declarationsByLine.get(lineNumber);
  if (
    declaration &&
    normalized === declaration.name &&
    index >= declaration.start &&
    index < declaration.end
  ) {
    return "syntax-user-function";
  }

  const openParenthesisIndex = nextOpenParenthesisIndex(source, index + token.length);
  if (openParenthesisIndex !== undefined) {
    const expectedArity = context.functions.get(normalized);
    const actualArity = functionCallArity(source, openParenthesisIndex);
    const scope = context.scopesByLine.get(lineNumber);
    if (expectedArity !== undefined) {
      if (
        actualArity === expectedArity &&
        scope?.functionName !== normalized
      ) {
        return "syntax-user-function";
      }
      return "syntax-expression";
    }
    if (basicMathFunctionNames.has(normalized) && actualArity === 1) {
      return "syntax-reserved";
    }
    return "syntax-expression";
  }

  const scope = context.scopesByLine.get(lineNumber);
  if (isGlobalVariableName(normalized)) return "syntax-global-variable";
  const resolvedNames = scope?.resolvedNames ?? context.globalResolvedNames;
  if (resolvedNames.has(normalized)) return "syntax-variable";
  return basicMathFunctionNames.has(normalized) ? "syntax-reserved" : "syntax-expression";
}

function isGlobalVariableName(value: string): boolean {
  return globalIdentifierPattern.test(value);
}

function isInfixMultiplicationX(source: string, index: number): boolean {
  const previousCharacter = source.slice(0, index).trimEnd().at(-1);
  return previousCharacter !== undefined && !/[=+\-*/^×÷(,{:]/.test(previousCharacter);
}

function nextOpenParenthesisIndex(source: string, start: number): number | undefined {
  const remainder = source.slice(start);
  const match = remainder.match(/^\s*\(/);
  return match ? start + match[0].length - 1 : undefined;
}

function functionCallArity(source: string, openParenthesisIndex: number): number | undefined {
  let depth = 0;
  let commas = 0;
  let hasArgument = false;

  for (let index = openParenthesisIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") {
      depth += 1;
      if (depth > 1) hasArgument = true;
      continue;
    }
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return hasArgument ? commas + 1 : 0;
      continue;
    }
    if (depth === 1 && character === ",") {
      if (!isNumericGroupingComma(source, openParenthesisIndex, index)) commas += 1;
      continue;
    }
    if (depth === 1 && !/\s/.test(character)) hasArgument = true;
  }

  return undefined;
}

function isNumericGroupingComma(
  source: string,
  openParenthesisIndex: number,
  commaIndex: number
): boolean {
  const beforeComma = source.slice(openParenthesisIndex + 1, commaIndex);
  const afterComma = source.slice(commaIndex + 1);
  return (
    /(?:^|[^\d,])(\d{1,3}(?:,\d{3})*)$/.test(beforeComma) &&
    /^\d{3}(?!\d)/.test(afterComma)
  );
}

function parseParameters(source: string): string[] | undefined {
  if (!source.trim()) return [];
  const parameters = source.split(",").map((parameter) => normalizeName(parameter.trim()));
  return parameters.every((parameter) => localIdentifierPattern.test(parameter))
    ? parameters
    : undefined;
}

function snapshotScope(scope: {
  name: string;
  resolvedNames: Set<string>;
}): FunctionLineScope {
  return {
    functionName: scope.name,
    resolvedNames: new Set(scope.resolvedNames)
  };
}

function addAssignedName(source: string, resolvedNames: Set<string>): void {
  const equalsIndex = topLevelEqualsIndex(source);
  if (equalsIndex < 0) return;
  const candidate = normalizeName(source.slice(0, equalsIndex).trim());
  if (localIdentifierPattern.test(candidate)) resolvedNames.add(candidate);
}

function topLevelEqualsIndex(source: string): number {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (source[index] === "=" && depth === 0) return index;
  }
  return -1;
}

function stripComment(source: string): string {
  const commentIndex = source.indexOf("//");
  return commentIndex >= 0 ? source.slice(0, commentIndex) : source;
}

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeName(value: string): string {
  return value.toLowerCase();
}
