export type StockQuote = {
  price: number;
};

export type StockQuoteMap = Record<string, StockQuote>;

type CachedValue<T> = {
  expiresAt: number;
  value: T;
};

export type MarketDataClientOptions = {
  fetch?: typeof fetch;
  now?: () => number;
};

const yahooFinanceChartBaseUrl = "https://query2.finance.yahoo.com/v8/finance/chart";
const requestTimeoutMs = 6_000;
const quoteCacheLifetimeMs = 60_000;
const cacheMaximumSize = 512;
const yahooFinanceMaximumConcurrency = 4;
const maximumStockSymbolsPerRequest = 32;
const maximumYahooFinanceResponseBytes = 256 * 1024;
const stockSymbolPattern = /^[_A-Z][_A-Z0-9]*$/;

const yahooFinanceSymbolMappings: Readonly<Record<string, string>> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  BNB: "BNB-USD",
  ADA: "ADA-USD",
  USDT: "USDT-USD",
  XRP: "XRP-USD",
  LTC: "LTC-USD",
  LINK: "LINK-USD",
  BCH: "BCH-USD",
  XLM: "XLM-USD",
  DOGE: "DOGE-USD",
  EOS: "EOS-USD",
  XEM: "XEM-USD",
  TRX: "TRX-USD",
  NEO: "NEO-USD"
};

function normalizeStockSymbols(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const symbols = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const symbol = candidate.trim().toUpperCase();
    if (symbol.length === 0 || symbol.length > 64 || !stockSymbolPattern.test(symbol)) continue;
    symbols.add(symbol);
    if (symbols.size >= maximumStockSymbolsPerRequest) break;
  }
  return [...symbols];
}

function yahooFinanceSymbolFor(symbol: string): string {
  return yahooFinanceSymbolMappings[symbol] ?? symbol;
}

function isStringKeyedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function childRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return isStringKeyedRecord(value) ? value : {};
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lastFiniteValue(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const parsed = parseFiniteNumber(value[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function normalizeYahooFinanceChart(value: unknown): StockQuote | null {
  if (!isStringKeyedRecord(value)) return null;
  const chart = childRecord(value, "chart");
  const results = chart.result;
  if (!Array.isArray(results) || !isStringKeyedRecord(results[0])) return null;

  const result = results[0];
  const meta = childRecord(result, "meta");
  const indicators = childRecord(result, "indicators");
  const quoteSeries = indicators.quote;
  const quote = Array.isArray(quoteSeries) && isStringKeyedRecord(quoteSeries[0])
    ? quoteSeries[0]
    : {};
  const price = parseFiniteNumber(meta.regularMarketPrice) ?? lastFiniteValue(quote.close);
  return price === null ? null : { price };
}

function cachedValue<T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
  now: number
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }

  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
  value: T,
  expiresAt: number
): void {
  cache.delete(key);
  cache.set(key, { expiresAt, value });

  while (cache.size > cacheMaximumSize) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    cache.delete(oldestKey);
  }
}

async function fetchYahooFinanceQuote(
  fetchImplementation: typeof fetch,
  symbol: string
): Promise<StockQuote | null> {
  const providerSymbol = yahooFinanceSymbolFor(symbol);
  const url = new URL(`${yahooFinanceChartBaseUrl}/${encodeURIComponent(providerSymbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetchImplementation(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Looper/0.1"
      },
      signal: abortController.signal
    });
    if (!response.ok) return null;
    const value = await readBoundedJsonResponse(
      response,
      maximumYahooFinanceResponseBytes
    );
    return value === null ? null : normalizeYahooFinanceChart(value);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedJsonResponse(
  response: Response,
  maximumBytes: number
): Promise<unknown | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function createConcurrencyLimiter(maximumConcurrency: number): <T>(
  task: () => Promise<T>
) => Promise<T> {
  let activeTasks = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (activeTasks < maximumConcurrency) {
      activeTasks += 1;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
  }

  function release(): void {
    const next = waiters.shift();
    if (next) {
      next();
    } else {
      activeTasks -= 1;
    }
  }

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}

export function createMarketDataClient(options: MarketDataClientOptions = {}): {
  clearCache: () => void;
  fetchStockQuotes: (symbols: unknown) => Promise<StockQuoteMap>;
} {
  const fetchImplementation = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const quoteCache = new Map<string, CachedValue<StockQuote>>();
  const inFlightQuotes = new Map<string, Promise<StockQuote | null>>();
  const limitYahooFinanceRequest = createConcurrencyLimiter(
    yahooFinanceMaximumConcurrency
  );

  function clearCache(): void {
    quoteCache.clear();
  }

  async function quoteForSymbol(symbol: string): Promise<StockQuote | null> {
    const cached = cachedValue(quoteCache, symbol, now());
    if (cached) return cached;

    const existingRequest = inFlightQuotes.get(symbol);
    if (existingRequest) return existingRequest;

    const request = limitYahooFinanceRequest(() =>
      fetchYahooFinanceQuote(fetchImplementation, symbol)
    ).then((quote) => {
      if (quote) {
        setCachedValue(quoteCache, symbol, quote, now() + quoteCacheLifetimeMs);
      }
      return quote;
    }).finally(() => {
      inFlightQuotes.delete(symbol);
    });
    inFlightQuotes.set(symbol, request);
    return request;
  }

  async function fetchStockQuotes(symbolsValue: unknown): Promise<StockQuoteMap> {
    const requestedSymbols = normalizeStockSymbols(symbolsValue);
    const entries = await Promise.all(
      requestedSymbols.map(async (symbol) => [symbol, await quoteForSymbol(symbol)] as const)
    );

    const results: StockQuoteMap = {};
    for (const [symbol, quote] of entries) {
      if (quote) results[symbol] = quote;
    }
    return results;
  }

  return { clearCache, fetchStockQuotes };
}
