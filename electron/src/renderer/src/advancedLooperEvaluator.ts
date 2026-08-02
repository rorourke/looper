import type {
  EvaluatedValue,
  LineEvaluation,
  LooperEvaluation,
  ParsedLine,
  ValueKind
} from "./looperEngine.ts";
import { isDividerLine } from "./dividerLine.ts";
import Decimal from "decimal.js";

export type StockQuote = {
  symbol?: string;
  price: number;
};

export type StockQuoteMap = Record<string, StockQuote | undefined>;

export type ResolvedGlobalValue = {
  value: number;
  exactValue?: string;
  kind: ValueKind;
  isLooped: boolean;
  sourceName?: string;
};

export type GlobalVariableAssignment = {
  lineNumber: number;
  name: string;
  normalizedName: string;
};

export type VariableAssignment = GlobalVariableAssignment & {
  sectionTitle?: string;
  source: string;
};

export type AdvancedLooperEvaluatorOptions = {
  invalidGlobalDefinitionErrors?: ReadonlyMap<number, string>;
  resolveGlobal?: (name: string, loop: number) => ResolvedGlobalValue;
};

type OperatorValue = "+" | "-" | "*" | "/" | "^";

type Token =
  | { type: "number"; value: Decimal; kind: ValueKind }
  | { type: "identifier"; value: string }
  | { type: "stock"; symbol: string; modifier?: string }
  | { type: "operator"; value: OperatorValue }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma"; value: "," }
  | { type: "eof"; value: "" };

type ExpressionNode =
  | { type: "number"; value: Decimal; kind: ValueKind }
  | { type: "identifier"; name: string }
  | { type: "stock"; symbol: string; modifier?: string }
  | { type: "unary"; operator: "+" | "-"; operand: ExpressionNode }
  | { type: "binary"; operator: OperatorValue; left: ExpressionNode; right: ExpressionNode }
  | { type: "call"; name: string; args: ExpressionNode[] }
  | { type: "section"; reducer: SectionReducer };

type RawValue = {
  value: Decimal;
  kind: ValueKind;
  isLooped: boolean;
  sourceName?: string;
};

type EvaluationResult =
  | { ok: true; value: RawValue }
  | { ok: false; error: string };

type SectionReducer = "sumsection" | "avgsection" | "minsection" | "maxsection";

type FunctionBodyLine = {
  lineNumber: number;
  source: string;
  expression: string;
  variable?: string;
};

type UserFunction = {
  name: string;
  parameters: string[];
  body: FunctionBodyLine[];
  startLine: number;
  endLine: number;
};

type ExpressionContext = {
  loop: number;
  lineNumber: number;
  locals?: Map<string, RawValue>;
  callStack: string[];
};

type FunctionScan = {
  definitions: Map<string, UserFunction>;
  lineNumbers: Set<number>;
};

const sectionReducers = new Set<SectionReducer>([
  "sumsection",
  "avgsection",
  "minsection",
  "maxsection"
]);

const loopFunctions = new Set(["first", "last", "previous", "min", "max", "avg"]);
Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP
});
const decimalPi = Decimal.acos(-1);
const mathFunctions = new Map<string, (value: Decimal) => Decimal>([
  ["floor", (value) => value.floor()],
  ["ceil", (value) => value.ceil()],
  ["log", (value) => value.log(10)],
  ["sin", (value) => value.sin()],
  ["cos", (value) => value.cos()],
  ["tan", (value) => value.tan()]
]);
const basicMathFunctions = new Map<string, (value: Decimal) => Decimal>([
  ["abs", (value) => value.abs()],
  ["sqrt", (value) => value.sqrt()],
  ["round", (value) => value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)],
  ["trunc", (value) => value.trunc()],
  ["sign", (value) => new Decimal(value.isZero() ? 0 : value.isPositive() ? 1 : -1)]
]);
const siMultipliers: Record<string, string> = {
  Y: "1e24",
  Z: "1e21",
  E: "1e18",
  P: "1e15",
  T: "1e12",
  G: "1e9",
  M: "1e6",
  k: "1e3",
  h: "1e2",
  da: "1e1",
  d: "1e-1",
  c: "1e-2",
  m: "1e-3",
  u: "1e-6",
  n: "1e-9",
  p: "1e-12",
  f: "1e-15",
  a: "1e-18",
  z: "1e-21",
  y: "1e-24"
};

const displaySuffixes = new Map<number, string>([
  [24, "Y"],
  [21, "Z"],
  [18, "E"],
  [15, "P"],
  [12, "T"],
  [9, "B"],
  [6, "M"],
  [3, "K"],
  [0, ""],
  [-3, "m"],
  [-6, "µ"],
  [-9, "n"],
  [-12, "p"],
  [-15, "f"],
  [-18, "a"],
  [-21, "z"],
  [-24, "y"]
]);

export function extractStockSymbols(text: string): string[] {
  const symbols = new Set<string>();
  const source = normalizeLineEndings(text);

  for (const line of source.split("\n")) {
    const code = stripComment(line);
    for (const match of code.matchAll(/\$([_A-Za-z][_A-Za-z0-9]*)(?:\.[_A-Za-z][_A-Za-z0-9]*)?/g)) {
      symbols.add(match[1].toUpperCase());
    }
  }

  return Array.from(symbols).sort((left, right) => left.localeCompare(right));
}

export function extractGlobalVariableAssignments(
  text: string
): GlobalVariableAssignment[] {
  const sourceLines = normalizeLineEndings(text).split("\n");
  const functionScan = scanUserFunctions(sourceLines);

  return sourceLines.flatMap((source, lineNumber) => {
    const line = parseDocumentLine(source, lineNumber, functionScan.lineNumbers);
    if (
      line.kind !== "equation" ||
      !line.variable ||
      !isGlobalVariableName(line.variable)
    ) {
      return [];
    }

    return [{
      lineNumber: line.lineNumber,
      name: line.variable,
      normalizedName: normalizeName(line.variable)
    }];
  });
}

export function extractVariableAssignments(text: string): VariableAssignment[] {
  const sourceLines = normalizeLineEndings(text).split("\n");
  const functionScan = scanUserFunctions(sourceLines);
  const lines = sourceLines.map((source, lineNumber) =>
    parseDocumentLine(source, lineNumber, functionScan.lineNumbers)
  );
  let sectionTitle: string | undefined;
  const assignments: VariableAssignment[] = [];

  for (const line of lines) {
    if (isDividerLine(line.source)) {
      sectionTitle = undefined;
      continue;
    }
    if (line.kind === "title") {
      sectionTitle = sectionLabel(line.title ?? line.source);
      continue;
    }
    if (line.kind !== "equation" || !line.variable) continue;
    assignments.push({
      sectionTitle,
      source: line.source,
      lineNumber: line.lineNumber,
      name: line.variable,
      normalizedName: normalizeName(line.variable)
    });
  }

  return assignments;
}

function sectionLabel(source: string): string | undefined {
  const code = stripComment(source).trim();
  const colonIndex = code.indexOf(":");
  const label = (colonIndex >= 0 ? code.slice(0, colonIndex) : code).trim();
  return label || undefined;
}

export function evaluateAdvancedLooperText(
  source: string,
  loopCount: number,
  stockQuotes: StockQuoteMap = {},
  decimalPlaces = 2,
  options: AdvancedLooperEvaluatorOptions = {}
): LooperEvaluation {
  return new AdvancedLooperDocumentEvaluator(
    source,
    loopCount,
    stockQuotes,
    decimalPlaces,
    options
  ).evaluate();
}

export class AdvancedLooperDocumentEvaluator {
  private readonly sourceLines: string[];
  private readonly functionScan: FunctionScan;
  private readonly lines: ParsedLine[];
  private readonly functions: Map<string, UserFunction>;
  private readonly assignments = new Map<string, number[]>();
  private readonly sections: Map<number, number[]>;
  private readonly quotes = new Map<string, StockQuote>();
  private readonly expressionCache = new Map<string, ExpressionNode>();
  private readonly cellCache = new Map<string, EvaluationResult>();
  private readonly activeCells = new Set<string>();
  private readonly invalidGlobalDefinitionErrors: Map<number, string>;
  private readonly loopCount: number;
  private readonly decimalPlaces: number;

  constructor(
    private readonly source: string,
    loopCount: number,
    stockQuotes: StockQuoteMap,
    decimalPlaces: number,
    private readonly options: AdvancedLooperEvaluatorOptions = {}
  ) {
    this.loopCount = clampLoopCount(loopCount);
    this.decimalPlaces = clampDecimalPlaces(decimalPlaces);
    this.sourceLines = normalizeLineEndings(source).split("\n");
    this.functionScan = scanUserFunctions(this.sourceLines);
    this.functions = this.functionScan.definitions;
    this.lines = this.sourceLines.map((line, lineNumber) =>
      parseDocumentLine(line, lineNumber, this.functionScan.lineNumbers)
    );

    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      if (quote && Number.isFinite(quote.price)) {
        this.quotes.set(symbol.toUpperCase(), quote);
      }
    }

    for (const line of this.lines) {
      if (line.kind !== "equation" || !line.variable) continue;
      const variableName = normalizeName(line.variable);
      const definitions = this.assignments.get(variableName) ?? [];
      definitions.push(line.lineNumber);
      this.assignments.set(variableName, definitions);
    }

    this.invalidGlobalDefinitionErrors = new Map(
      options.invalidGlobalDefinitionErrors ?? []
    );
    for (const [name, definitions] of this.assignments) {
      if (isGlobalVariableName(name) && definitions.length > 1) {
        for (const lineNumber of definitions.slice(1)) {
          if (!this.invalidGlobalDefinitionErrors.has(lineNumber)) {
            this.invalidGlobalDefinitionErrors.set(
              lineNumber,
              `Cannot redefine a global variable; "${name}" was already defined earlier in this sheet`
            );
          }
        }
      }
    }

    this.markReservedLoopAssignments();
    this.markInvalidGlobalAssignments();
    this.sections = buildSections(this.lines);
  }

  evaluate(): LooperEvaluation {
    const maximumEvaluationCells = 1_000_000;
    if (this.lines.length * (this.loopCount + 1) > maximumEvaluationCells) {
      return this.evaluationTooLarge();
    }

    const variables = new Set<string>();

    for (const line of this.lines) {
      line.evaluations = [];
      line.dependsOnLoop = false;
      if (line.variable) variables.add(line.variable);

      for (let loop = 0; loop <= this.loopCount; loop += 1) {
        if (line.kind === "empty" || line.kind === "function") {
          line.evaluations.push({ loop, status: "empty" });
          continue;
        }

        if (line.kind === "title") {
          line.evaluations.push({ loop, status: "title" });
          continue;
        }

        const result = this.evaluateCell(line.lineNumber, loop);
        if (result.ok) {
          line.dependsOnLoop = line.dependsOnLoop || result.value.isLooped;
          line.evaluations.push({
            loop,
            status: "success",
            value: formatValue(result.value, this.decimalPlaces)
          });
        } else {
          line.evaluations.push({ loop, status: "error", error: result.error });
        }
      }
    }

    const errors = this.lines.reduce(
      (total, line) => total + line.evaluations.filter((item) => item.status === "error").length,
      0
    );

    return {
      text: this.source,
      loopCount: this.loopCount,
      lines: this.lines,
      variables: Array.from(variables).sort((left, right) => left.localeCompare(right)),
      errors
    };
  }

  private evaluationTooLarge(): LooperEvaluation {
    const variables = new Set<string>();
    let errors = 0;
    for (const line of this.lines) {
      line.dependsOnLoop = false;
      if (line.variable) variables.add(line.variable);
      if (line.kind === "empty" || line.kind === "function") {
        line.evaluations = [{ loop: 0, status: "empty" }];
      } else if (line.kind === "title") {
        line.evaluations = [{ loop: 0, status: "title" }];
      } else {
        line.evaluations = [{
          loop: 0,
          status: "error",
          error: "This sheet is too large to evaluate safely"
        }];
        errors += 1;
      }
    }
    return {
      text: this.source,
      loopCount: 0,
      lines: this.lines,
      variables: Array.from(variables).sort((left, right) => left.localeCompare(right)),
      errors
    };
  }

  private markReservedLoopAssignments(): void {
    const definitions = this.assignments.get("loop") ?? [];
    for (const lineNumber of definitions) {
      const line = this.lines[lineNumber];
      if (line) line.parseError = '"loop" is reserved and cannot be assigned in the sheet';
    }
  }

  private markInvalidGlobalAssignments(): void {
    for (const [lineNumber, error] of this.invalidGlobalDefinitionErrors) {
      const line = this.lines[lineNumber];
      if (line) {
        line.parseError = error;
      }
    }
  }

  private definitionsFor(name: string): number[] {
    const definitions = this.assignments.get(name) ?? [];
    return isGlobalVariableName(name)
      ? definitions.filter(
          (lineNumber) => !this.invalidGlobalDefinitionErrors.has(lineNumber)
        )
      : definitions;
  }

  evaluateLineValue(lineNumber: number, loop: number): ResolvedGlobalValue {
    const result = this.evaluateCell(lineNumber, Math.max(0, Math.trunc(loop)));
    if (!result.ok) throw new Error(result.error);
    return resolvedGlobalValue(result.value);
  }

  private evaluateCell(lineNumber: number, loop: number): EvaluationResult {
    const key = `${loop}:${lineNumber}`;
    const cached = this.cellCache.get(key);
    if (cached) return cached;

    if (this.activeCells.has(key)) {
      return { ok: false, error: "Circular dependency" };
    }

    const line = this.lines[lineNumber];
    if (!line || line.kind !== "equation") {
      return { ok: false, error: "Line does not contain an expression" };
    }

    this.activeCells.add(key);
    let result: EvaluationResult;
    try {
      if (line.parseError) throw new Error(line.parseError);
      const value = this.evaluateExpression(line.expression, {
        loop,
        lineNumber,
        callStack: []
      });
      result = { ok: true, value };
    } catch (error) {
      result = { ok: false, error: errorMessage(error) };
    }
    this.activeCells.delete(key);
    this.cellCache.set(key, result);
    return result;
  }

  private evaluateCellValue(lineNumber: number, loop: number): RawValue {
    const result = this.evaluateCell(lineNumber, loop);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  private evaluateExpression(expression: string, context: ExpressionContext): RawValue {
    if (!expression.trim()) throw new Error("Missing expression");
    let node = this.expressionCache.get(expression);
    if (!node) {
      node = new ExpressionParser(tokenize(expression)).parse();
      this.expressionCache.set(expression, node);
    }
    const result = normalizeZero(this.evaluateNode(node, context));
    if (!result.value.isFinite()) {
      throw new Error("Result is undefined or outside the supported numeric range");
    }
    return result;
  }

  private evaluateNode(node: ExpressionNode, context: ExpressionContext): RawValue {
    switch (node.type) {
      case "number":
        return { value: node.value, kind: node.kind, isLooped: false };
      case "identifier":
        return this.resolveIdentifier(node.name, context);
      case "stock":
        return this.resolveStock(node.symbol, node.modifier);
      case "section":
        return this.evaluateSection(node.reducer, context);
      case "unary": {
        const operand = this.evaluateNode(node.operand, context);
        return node.operator === "+" ? operand : { ...operand, value: operand.value.neg() };
      }
      case "binary": {
        const left = this.evaluateNode(node.left, context);
        const right = this.evaluateNode(node.right, context);
        const value = applyOperator(node.operator, left.value, right.value);
        return combineValues(left, right, value);
      }
      case "call":
        return this.evaluateCall(node, context);
    }
  }

  private evaluateCall(node: Extract<ExpressionNode, { type: "call" }>, context: ExpressionContext): RawValue {
    const name = normalizeName(node.name);
    const mathFunction = mathFunctions.get(name);
    if (mathFunction) {
      if (node.args.length !== 1) throw new Error(`${node.name} expects one argument`);
      const argument = this.evaluateNode(node.args[0], context);
      return {
        value: mathFunction(argument.value),
        kind: argument.kind === "currency" ? "currency" : "decimal",
        isLooped: argument.isLooped
      };
    }

    if (name.startsWith("loop.")) {
      return this.evaluateLoopFunction(name.slice(5), node.args, context);
    }

    const functionDefinition = this.functions.get(name);
    if (functionDefinition) {
      return this.evaluateUserFunction(functionDefinition, node.args, context);
    }

    const basicMathFunction = basicMathFunctions.get(name);
    if (basicMathFunction) {
      if (node.args.length !== 1) throw new Error(`${node.name} expects one argument`);
      const argument = this.evaluateNode(node.args[0], context);
      return {
        value: basicMathFunction(argument.value),
        kind: name === "sign"
          ? "integer"
          : argument.kind === "currency"
            ? "currency"
            : "decimal",
        isLooped: argument.isLooped
      };
    }

    throw new Error(`Unknown function "${node.name}"`);
  }

  private evaluateUserFunction(
    definition: UserFunction,
    argumentNodes: ExpressionNode[],
    context: ExpressionContext
  ): RawValue {
    if (argumentNodes.length !== definition.parameters.length) {
      throw new Error(
        `${definition.name} expects ${definition.parameters.length} argument${definition.parameters.length === 1 ? "" : "s"}`
      );
    }
    if (context.callStack.includes(definition.name)) {
      throw new Error(`Recursive function "${definition.name}" is not supported`);
    }

    const argumentValues = argumentNodes.map((argument) => this.evaluateNode(argument, context));
    const locals = new Map<string, RawValue>();
    definition.parameters.forEach((parameter, index) => {
      locals.set(parameter, argumentValues[index]);
    });

    const functionContext: ExpressionContext = {
      ...context,
      locals,
      callStack: [...context.callStack, definition.name]
    };
    let result: RawValue | undefined;

    for (const line of definition.body) {
      result = this.evaluateExpression(line.expression, functionContext);
      if (line.variable) {
        locals.set(normalizeName(line.variable), result);
      }
    }

    if (!result) throw new Error(`Function "${definition.name}" has no result`);
    return result;
  }

  private evaluateLoopFunction(
    functionName: string,
    args: ExpressionNode[],
    context: ExpressionContext
  ): RawValue {
    if (!loopFunctions.has(functionName)) {
      throw new Error(`Unknown loop function "loop.${functionName}"`);
    }
    if (args.length > 1) throw new Error(`loop.${functionName} expects at most one variable`);

    const argument = args[0];
    if (argument && argument.type !== "identifier") {
      throw new Error(`loop.${functionName} needs a variable name`);
    }

    let variableName = normalizeName(argument?.name ?? "loop");
    const localValue = context.locals?.get(variableName);
    if (localValue?.sourceName) variableName = normalizeName(localValue.sourceName);

    if (functionName === "previous") {
      if (context.loop === 0) {
        return { value: new Decimal(0), kind: "decimal", isLooped: true };
      }
      return this.resolveSeriesValue(variableName, context.loop - 1, context.lineNumber, true);
    }

    if (functionName === "first") {
      return this.resolveSeriesValue(variableName, 0, context.lineNumber, false);
    }

    if (functionName === "last") {
      return this.resolveSeriesValue(variableName, this.loopCount, context.lineNumber, false);
    }

    const values = Array.from({ length: this.loopCount + 1 }, (_, loop) =>
      this.resolveSeriesValue(variableName, loop, context.lineNumber, false)
    );
    if (values.length === 0) throw new Error(`No loop values for "${variableName}"`);

    if (functionName === "min") {
      const minimum = values.reduce((best, value) => (value.value.lt(best.value) ? value : best));
      return { ...minimum, isLooped: true };
    }
    if (functionName === "max") {
      const maximum = values.reduce((best, value) => (value.value.gt(best.value) ? value : best));
      return { ...maximum, isLooped: true };
    }

    return {
      value: averageValues(values),
      kind: combineKinds(values.map((value) => value.kind)),
      isLooped: true
    };
  }

  private resolveSeriesValue(
    variableName: string,
    loop: number,
    callerLine: number,
    allowCurrentDefinition: boolean
  ): RawValue {
    if (isLoopVariable(variableName)) return currentLoopValue(loop);

    const definitions = this.definitionsFor(variableName);
    const definition =
      allowCurrentDefinition && definitions.includes(callerLine)
        ? callerLine
        : definitions.filter((line) => line < callerLine).at(-1);
    if (definition === undefined) {
      if (isGlobalVariableName(variableName)) {
        return {
          ...this.resolveExternalGlobal(variableName, loop),
          isLooped: true,
          sourceName: variableName
        };
      }
      throw new Error(`Unresolved variable "${variableName}"`);
    }

    const value = this.evaluateCellValue(definition, loop);
    return { ...value, isLooped: true, sourceName: variableName };
  }

  private resolveIdentifier(name: string, context: ExpressionContext): RawValue {
    const variableName = normalizeName(name);
    if (variableName === "pi" || name === "π") {
      return { value: decimalPi, kind: "decimal", isLooped: false };
    }
    if (isLoopVariable(variableName)) return currentLoopValue(context.loop);

    const local = isGlobalVariableName(variableName)
      ? undefined
      : context.locals?.get(variableName);
    if (local) return { ...local, sourceName: local.sourceName ?? variableName };

    const definitions = this.definitionsFor(variableName);
    const priorDefinitions = definitions.filter((line) => line < context.lineNumber);
    const nearestPrior = priorDefinitions.at(-1);
    const isCurrentDefinition = definitions.includes(context.lineNumber);

    if (nearestPrior === undefined && isCurrentDefinition) {
      // A self-reference without an earlier binding is a static zero. Loop
      // lineage must come from an actual loop value or loop function.
      return {
        value: new Decimal(0),
        kind: "decimal",
        isLooped: false,
        sourceName: variableName
      };
    }

    if (context.loop === 0) {
      if (nearestPrior === undefined) {
        if (isGlobalVariableName(variableName)) {
          return this.resolveExternalGlobal(variableName, context.loop);
        }
        throw new Error(`Unresolved variable "${name}"`);
      }
      return {
        ...this.evaluateCellValue(nearestPrior, context.loop),
        sourceName: variableName
      };
    }

    if (nearestPrior !== undefined) {
      // A redefinition reads the nearest earlier binding at the current loop.
      const value = this.evaluateCellValue(nearestPrior, context.loop);
      return { ...value, sourceName: variableName };
    }

    if (isGlobalVariableName(variableName)) {
      return this.resolveExternalGlobal(variableName, context.loop);
    }

    throw new Error(`Unresolved variable "${name}"`);
  }

  private resolveExternalGlobal(name: string, loop: number): RawValue {
    if (!this.options.resolveGlobal) {
      throw new Error(`Unresolved global variable "${name}"`);
    }
    const resolved = this.options.resolveGlobal(name, loop);
    return {
      value: decimalFromResolvedValue(resolved),
      kind: resolved.kind,
      isLooped: resolved.isLooped,
      sourceName: normalizeName(name)
    };
  }

  private resolveStock(symbol: string, rawModifier?: string): RawValue {
    const quote = this.quotes.get(symbol.toUpperCase());
    if (!quote) throw new Error(`Stock symbol $${symbol.toUpperCase()} is loading or unavailable`);

    if (rawModifier) {
      throw new Error(
        `Live market data supports prices only; use $${symbol.toUpperCase()} without a modifier`
      );
    }

    return {
      value: new Decimal(String(quote.price)),
      kind: "currency",
      isLooped: false
    };
  }

  private evaluateSection(reducer: SectionReducer, context: ExpressionContext): RawValue {
    const sectionLines = this.sections.get(context.lineNumber) ?? [];
    const values: RawValue[] = [];

    for (const lineNumber of sectionLines) {
      if (lineNumber === context.lineNumber) continue;
      const result = this.evaluateCell(lineNumber, context.loop);
      if (!result.ok) {
        throw new Error(`${reducer} cannot include line ${lineNumber + 1}: ${result.error}`);
      }
      values.push(result.value);
    }

    if (values.length === 0) throw new Error(`${reducer} has no values in this section`);

    let value: Decimal;
    if (reducer === "sumsection") {
      value = values.reduce((total, item) => total.plus(item.value), new Decimal(0));
    } else if (reducer === "avgsection") {
      value = averageValues(values);
    } else if (reducer === "minsection") {
      value = Decimal.min(...values.map((item) => item.value));
    } else {
      value = Decimal.max(...values.map((item) => item.value));
    }

    return {
      value,
      kind: combineKinds(values.map((item) => item.kind)),
      isLooped: values.some((item) => item.isLooped)
    };
  }

}

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const expression = this.parseAdditive();
    if (this.peek().type !== "eof") throw new Error("Unexpected trailing expression");
    return expression;
  }

  private parseAdditive(): ExpressionNode {
    let left = this.parseMultiplicative();
    while (this.matchOperator("+") || this.matchOperator("-")) {
      const previous = this.previous();
      if (previous.type !== "operator") throw new Error("Expected additive operator");
      const operator = previous.value as "+" | "-";
      left = { type: "binary", operator, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): ExpressionNode {
    let left = this.parseUnary();
    while (this.matchOperator("*") || this.matchOperator("/")) {
      const previous = this.previous();
      if (previous.type !== "operator") throw new Error("Expected multiplicative operator");
      const operator = previous.value as "*" | "/";
      left = { type: "binary", operator, left, right: this.parseUnary() };
    }
    return left;
  }

  private parsePower(): ExpressionNode {
    const left = this.parsePrimary();
    if (!this.matchOperator("^")) return left;
    return { type: "binary", operator: "^", left, right: this.parseUnary() };
  }

  private parseUnary(): ExpressionNode {
    if (this.matchOperator("+")) return { type: "unary", operator: "+", operand: this.parseUnary() };
    if (this.matchOperator("-")) return { type: "unary", operator: "-", operand: this.parseUnary() };
    return this.parsePower();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.advance();
    if (token.type === "number") return { ...token, type: "number" };
    if (token.type === "stock") return { ...token, type: "stock" };

    if (token.type === "identifier") {
      const normalizedName = normalizeName(token.value);
      if (this.matchParen("(")) {
        return { type: "call", name: token.value, args: this.parseArguments() };
      }
      if (sectionReducers.has(normalizedName as SectionReducer)) {
        return { type: "section", reducer: normalizedName as SectionReducer };
      }
      if (normalizedName.startsWith("loop.") && loopFunctions.has(normalizedName.slice(5))) {
        return { type: "call", name: token.value, args: [] };
      }
      return { type: "identifier", name: token.value };
    }

    if (token.type === "paren" && token.value === "(") {
      const expression = this.parseAdditive();
      this.consumeParen(")", "Expected closing parenthesis");
      return expression;
    }

    throw new Error("Expected expression");
  }

  private parseArguments(): ExpressionNode[] {
    const args: ExpressionNode[] = [];
    if (this.matchParen(")")) return args;
    do {
      args.push(this.parseAdditive());
    } while (this.matchComma());
    this.consumeParen(")", "Expected closing parenthesis");
    return args;
  }

  private matchOperator(value: OperatorValue): boolean {
    const token = this.peek();
    if (token.type !== "operator" || token.value !== value) return false;
    this.advance();
    return true;
  }

  private matchParen(value: "(" | ")"): boolean {
    const token = this.peek();
    if (token.type !== "paren" || token.value !== value) return false;
    this.advance();
    return true;
  }

  private matchComma(): boolean {
    if (this.peek().type !== "comma") return false;
    this.advance();
    return true;
  }

  private consumeParen(value: "(" | ")", message: string): void {
    if (!this.matchParen(value)) throw new Error(message);
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "$" && /[A-Za-z_]/.test(expression[index + 1] ?? "")) {
      const match = expression
        .slice(index + 1)
        .match(/^([_A-Za-z][_A-Za-z0-9]*)(?:\.([_A-Za-z][_A-Za-z0-9]*))?/);
      if (!match) throw new Error("Invalid stock symbol");
      tokens.push({ type: "stock", symbol: match[1].toUpperCase(), modifier: match[2] });
      index += match[0].length + 1;
      continue;
    }

    if (char === "$" || /[\d.]/.test(char)) {
      const start = index;
      const isCurrency = char === "$";
      if (isCurrency) index += 1;
      const numberMatch = expression
        .slice(index)
        .match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)/);
      if (!numberMatch) throw new Error(isCurrency ? "Invalid currency literal" : "Invalid number");

      index += numberMatch[0].length;
      const suffixMatch = expression.slice(index).match(/^(da|[YZEPTGMkhdcmunpfazy])/);
      const suffix = suffixMatch?.[0];
      if (suffix) index += suffix.length;
      const isPercent = expression[index] === "%";
      if (isPercent) index += 1;

      const numericValue = new Decimal(numberMatch[0].replace(/,/g, ""));
      const value = numericValue
        .times(suffix ? siMultipliers[suffix] ?? "1" : "1")
        .div(isPercent ? 100 : 1);
      tokens.push({
        type: "number",
        value,
        kind: isCurrency ? "currency" : isPercent ? "percent" : value.isInteger() ? "integer" : "decimal"
      });
      if (index === start) throw new Error("Invalid number");
      continue;
    }

    if (
      char === "x" &&
      isStandaloneCharacter(expression, index) &&
      canEndExpression(tokens[tokens.length - 1])
    ) {
      tokens.push({ type: "operator", value: "*" });
      index += 1;
      continue;
    }

    if (char === "@") {
      const match = expression.slice(index).match(/^@[_A-Za-z][_A-Za-z0-9]*/);
      if (!match) throw new Error("Invalid global variable");
      tokens.push({ type: "identifier", value: match[0] });
      index += match[0].length;
      continue;
    }

    if (/[A-Za-z_π]/.test(char)) {
      const match = expression.slice(index).match(/^[_A-Za-zπ][_A-Za-z0-9]*(?:\.[_A-Za-z][_A-Za-z0-9]*)?/);
      if (!match) throw new Error("Invalid identifier");
      tokens.push({ type: "identifier", value: match[0] });
      index += match[0].length;
      continue;
    }

    if (char === "+" || char === "-" || char === "^" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char as OperatorValue });
      index += 1;
      continue;
    }
    if (char === "×" || char === "÷") {
      tokens.push({ type: "operator", value: char === "×" ? "*" : "/" });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: "," });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected token "${char}"`);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function isStandaloneCharacter(source: string, index: number): boolean {
  const identifierCharacter = /[_A-Za-z0-9]/;
  return (
    !identifierCharacter.test(source[index - 1] ?? "") &&
    !identifierCharacter.test(source[index + 1] ?? "")
  );
}

function canEndExpression(token: Token | undefined): boolean {
  return (
    token?.type === "number" ||
    token?.type === "identifier" ||
    token?.type === "stock" ||
    (token?.type === "paren" && token.value === ")")
  );
}

function scanUserFunctions(lines: string[]): FunctionScan {
  const definitions = new Map<string, UserFunction>();
  const lineNumbers = new Set<number>();

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const code = stripComment(lines[lineNumber]);
    const match = code.match(/^\s*([_A-Za-z][_A-Za-z0-9]*)\s*\(([^)]*)\)\s*\{/);
    if (!match) continue;

    const rawParameters = match[2].trim();
    const parameters = rawParameters
      ? rawParameters.split(",").map((parameter) => normalizeName(parameter.trim()))
      : [];
    if (parameters.some((parameter) => !isLocalIdentifier(parameter))) continue;

    const body: FunctionBodyLine[] = [];
    const startLine = lineNumber;
    let endLine = lineNumber;
    let remainder = code.slice((match.index ?? 0) + match[0].length);
    let closed = false;

    while (true) {
      lineNumbers.add(endLine);
      const closingIndex = remainder.indexOf("}");
      const bodySource = closingIndex >= 0 ? remainder.slice(0, closingIndex) : remainder;
      const bodyLine = parseFunctionBodyLine(bodySource, endLine);
      if (bodyLine) body.push(bodyLine);

      if (closingIndex >= 0) {
        closed = true;
        break;
      }
      endLine += 1;
      if (endLine >= lines.length) break;
      remainder = stripComment(lines[endLine]);
    }

    if (!closed) endLine = Math.min(endLine, lines.length - 1);
    definitions.set(normalizeName(match[1]), {
      name: normalizeName(match[1]),
      parameters,
      body,
      startLine,
      endLine
    });
    lineNumber = endLine;
  }

  return { definitions, lineNumbers };
}

function parseFunctionBodyLine(source: string, lineNumber: number): FunctionBodyLine | undefined {
  const code = stripComment(source).trim();
  if (!code || code.includes(":")) return undefined;
  const equalsIndex = findTopLevelEquals(code);
  if (equalsIndex < 0) return { lineNumber, source, expression: code };

  const variable = code.slice(0, equalsIndex).trim();
  return {
    lineNumber,
    source,
    expression: code.slice(equalsIndex + 1).trim(),
    variable: isLocalIdentifier(variable) ? variable : undefined
  };
}

function parseDocumentLine(source: string, lineNumber: number, functionLines: Set<number>): ParsedLine {
  if (functionLines.has(lineNumber)) {
    return baseParsedLine(source, lineNumber, "function");
  }

  if (isDividerLine(source)) return baseParsedLine(source, lineNumber, "empty");

  const code = stripComment(source).trim();
  if (!code) return baseParsedLine(source, lineNumber, "empty");
  if (code.includes(":")) {
    return { ...baseParsedLine(source, lineNumber, "title"), title: code };
  }

  const equalsIndex = findTopLevelEquals(code);
  if (equalsIndex >= 0) {
    const variable = code.slice(0, equalsIndex).trim();
    return {
      ...baseParsedLine(source, lineNumber, "equation"),
      variable: isIdentifier(variable) ? variable : undefined,
      expression: code.slice(equalsIndex + 1).trim(),
      parseError: isIdentifier(variable) ? undefined : `Invalid variable name "${variable}"`
    };
  }

  return { ...baseParsedLine(source, lineNumber, "equation"), expression: code };
}

function baseParsedLine(
  source: string,
  lineNumber: number,
  kind: ParsedLine["kind"]
): ParsedLine {
  return {
    lineNumber,
    source,
    expression: "",
    kind,
    dependsOnLoop: false,
    evaluations: []
  };
}

function buildSections(lines: ParsedLine[]): Map<number, number[]> {
  const result = new Map<number, number[]>();
  let section: number[] = [];
  let previousEquationLine: number | undefined;

  const closeSection = (): void => {
    for (const lineNumber of section) result.set(lineNumber, section);
    section = [];
  };

  for (const line of lines) {
    if (line.kind !== "equation") continue;
    if (
      previousEquationLine !== undefined &&
      line.lineNumber > previousEquationLine + 1
    ) {
      closeSection();
    }
    section.push(line.lineNumber);
    if (/\b(?:sumsection|avgsection|minsection|maxsection)\b/i.test(line.expression)) {
      closeSection();
    }
    previousEquationLine = line.lineNumber;
  }
  closeSection();
  return result;
}

function applyOperator(operator: OperatorValue, left: Decimal, right: Decimal): Decimal {
  if (operator === "+") return left.plus(right);
  if (operator === "-") return left.minus(right);
  if (operator === "*") return left.times(right);
  if (operator === "/") {
    if (right.isZero()) throw new Error("Division by zero");
    return left.div(right);
  }
  return left.pow(right);
}

function combineValues(left: RawValue, right: RawValue, value: Decimal): RawValue {
  return {
    value,
    kind: combineKinds([left.kind, right.kind]),
    isLooped: left.isLooped || right.isLooped
  };
}

function combineKinds(kinds: ValueKind[]): ValueKind {
  if (kinds.includes("currency")) return "currency";
  if (kinds.length > 0 && kinds.every((kind) => kind === "integer")) return "integer";
  return "decimal";
}

function averageValues(values: RawValue[]): Decimal {
  return values.reduce(
    (average, item, index) => average.plus(item.value.minus(average).div(index + 1)),
    new Decimal(0)
  );
}

function currentLoopValue(loop: number): RawValue {
  return { value: new Decimal(loop), kind: "loop", isLooped: true, sourceName: "loop" };
}

function formatValue(value: RawValue, decimalPlaces: number): EvaluatedValue {
  const normalized = normalizeZero(value);
  return {
    value: normalized.value.toNumber(),
    exactValue: normalized.value.toString(),
    kind: normalized.kind,
    formatted: formatNumber(normalized.value, normalized.kind, decimalPlaces),
    isLooped: normalized.isLooped
  };
}

function formatNumber(value: Decimal, kind: ValueKind, decimalPlaces: number): string {
  if (!value.isFinite()) return value.toString();
  const absoluteValue = value.abs();
  if (absoluteValue.gte(1e3)) {
    if (value.e >= 27) {
      const formatted = value.toExponential(4, Decimal.ROUND_HALF_UP);
      return kind === "currency" ? `$${formatted}` : formatted;
    }

    let exponent = Math.max(-24, Math.min(24, Math.floor(value.e / 3) * 3));
    let scaled = value.div(new Decimal(10).pow(exponent));

    // Avoid displaying values such as 999,999 as 1,000K after rounding.
    if (
      exponent >= 3 &&
      exponent < 24 &&
      scaled.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).abs().gte(1000)
    ) {
      exponent += 3;
      scaled = value.div(new Decimal(10).pow(exponent));
    }

    const suffix = displaySuffixes.get(exponent);
    if (suffix !== undefined) {
      const rounded = scaled.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
      const formatted = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: decimalPlaces
      }).format(rounded.isZero() ? 0 : rounded.toNumber());
      return `${kind === "currency" ? "$" : ""}${formatted}${suffix}`;
    }
    return value.toExponential(4, Decimal.ROUND_HALF_UP);
  }

  const rounded = value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value.isInteger() ? 0 : decimalPlaces,
    minimumFractionDigits:
      kind === "currency" && !value.isInteger() ? decimalPlaces : 0
  }).format(rounded.isZero() ? 0 : rounded.toNumber());
  return kind === "currency" ? `$${formatted}` : formatted;
}

function normalizeZero(value: RawValue): RawValue {
  return value.value.isZero() ? { ...value, value: new Decimal(0) } : value;
}

function resolvedGlobalValue(value: RawValue): ResolvedGlobalValue {
  const normalized = normalizeZero(value);
  return {
    value: normalized.value.toNumber(),
    exactValue: normalized.value.toString(),
    kind: normalized.kind,
    isLooped: normalized.isLooped,
    sourceName: normalized.sourceName
  };
}

function decimalFromResolvedValue(value: ResolvedGlobalValue): Decimal {
  return new Decimal(value.exactValue ?? String(value.value));
}

function clampDecimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(3, Math.trunc(value)));
}

function clampLoopCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1000, Math.trunc(value)));
}

function normalizeName(value: string): string {
  return value.toLowerCase();
}

function isLoopVariable(value: string): boolean {
  return value === "loop";
}

function isGlobalVariableName(value: string): boolean {
  return value.startsWith("@");
}

function isIdentifier(value: string): boolean {
  return isLocalIdentifier(value) || /^@[_A-Za-z][_A-Za-z0-9]*$/.test(value);
}

function isLocalIdentifier(value: string): boolean {
  return /^[_A-Za-z][_A-Za-z0-9]*$/.test(value);
}

function stripComment(source: string): string {
  const commentIndex = source.indexOf("//");
  return commentIndex >= 0 ? source.slice(0, commentIndex) : source;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function findTopLevelEquals(source: string): number {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (source[index] === "=" && depth === 0) return index;
  }
  return -1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to evaluate";
}
