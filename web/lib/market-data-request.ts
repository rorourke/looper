import { ApiError } from "./api-response.ts";

const maximumRequestBytes = 8 * 1024;
const maximumSymbols = 32;
const stockSymbolPattern = /^[_A-Z][_A-Z0-9]*$/;

export type MarketDataRequest = {
  symbols: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function parseMarketDataRequest(request: Request): Promise<MarketDataRequest> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumRequestBytes) {
    throw new ApiError(413, "payload_too_large", "The request body is too large.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }

  const text = await readBoundedRequestText(request);
  if (!text) {
    throw new ApiError(
      400,
      "invalid_json",
      "A JSON request body is required."
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must contain valid JSON.");
  }
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "symbols")) {
    throw new ApiError(422, "validation_failed", "The market data request is invalid.");
  }
  if (
    !Array.isArray(value.symbols) ||
    value.symbols.length < 1 ||
    value.symbols.length > maximumSymbols
  ) {
    throw new ApiError(422, "validation_failed", "Supply between 1 and 32 market symbols.");
  }

  const symbols = [...new Set(value.symbols.map((symbol) =>
    typeof symbol === "string" ? symbol.trim().toUpperCase() : ""
  ))];
  if (
    symbols.length < 1 ||
    symbols.length > maximumSymbols ||
    symbols.some((symbol) => symbol.length > 64 || !stockSymbolPattern.test(symbol))
  ) {
    throw new ApiError(422, "validation_failed", "One or more market symbols are invalid.");
  }
  return { symbols };
}

async function readBoundedRequestText(request: Request): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumRequestBytes) {
        await reader.cancel();
        throw new ApiError(413, "payload_too_large", "The request body is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
