import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createMarketDataClient,
  normalizeYahooFinanceChart
} from "./marketData.ts";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

function yahooChart(price: number): unknown {
  return {
    chart: {
      result: [
        {
          meta: { regularMarketPrice: price },
          indicators: { quote: [{}] }
        }
      ]
    }
  };
}

describe("Yahoo Finance price data", () => {
  test("normalizes the current price and falls back to the latest chart close", () => {
    assert.deepEqual(
      normalizeYahooFinanceChart(yahooChart(380.84)),
      { price: 380.84 }
    );
    assert.deepEqual(
      normalizeYahooFinanceChart({
        chart: {
          result: [
            {
              meta: {},
              indicators: { quote: [{ close: [379, null, "380.5"] }] }
            }
          ]
        }
      }),
      { price: 380.5 }
    );
    assert.equal(normalizeYahooFinanceChart({ chart: { result: [] } }), null);
  });

  test("fetches every valid ticker from Yahoo, maps crypto aliases, and caches prices", async () => {
    const requestedSymbols: string[] = [];
    const prices = new Map([
      ["AAPL", 215],
      ["BTC-USD", 65_000],
      ["TSLA", 380.84]
    ]);
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const symbol = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      requestedSymbols.push(symbol);
      assert.equal(url.hostname, "query2.finance.yahoo.com");
      assert.equal(url.searchParams.get("range"), "5d");
      assert.equal(url.searchParams.get("interval"), "1d");
      assert.match(new Headers(init?.headers).get("User-Agent") ?? "", /Looper/);
      return jsonResponse(yahooChart(prices.get(symbol) ?? 100));
    };
    const client = createMarketDataClient({ fetch: fakeFetch, now: () => 1_000 });

    const first = await client.fetchStockQuotes([
      "aapl",
      "BTC",
      "TSLA",
      "bad-symbol",
      "AAPL"
    ]);
    assert.deepEqual(first, {
      AAPL: { price: 215 },
      BTC: { price: 65_000 },
      TSLA: { price: 380.84 }
    });
    assert.deepEqual(new Set(requestedSymbols), new Set(["AAPL", "BTC-USD", "TSLA"]));

    const second = await client.fetchStockQuotes(["AAPL", "BTC", "TSLA"]);
    assert.deepEqual(second, first);
    assert.equal(requestedSymbols.length, 3);
  });

  test("returns successful symbols when another Yahoo quote is unavailable", async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      return url.pathname.endsWith("/MISSING")
        ? jsonResponse({ chart: { result: null } })
        : jsonResponse(yahooChart(125));
    };
    const client = createMarketDataClient({ fetch: fakeFetch });

    assert.deepEqual(
      await client.fetchStockQuotes(["AAPL", "MISSING"]),
      { AAPL: { price: 125 } }
    );
  });

  test("bounds Yahoo concurrency and coalesces overlapping in-flight requests", async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    let requestCount = 0;
    const fakeFetch: typeof fetch = async () => {
      requestCount += 1;
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeRequests -= 1;
      return jsonResponse(yahooChart(100));
    };
    const client = createMarketDataClient({ fetch: fakeFetch, now: () => 1_000 });
    const firstSymbols = ["MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"];
    const secondSymbols = ["MSFT", "NVDA", "JPM", "V", "NFLX", "ETH"];

    const [firstQuotes, secondQuotes] = await Promise.all([
      client.fetchStockQuotes(firstSymbols),
      client.fetchStockQuotes(secondSymbols)
    ]);

    assert.equal(requestCount, new Set([...firstSymbols, ...secondSymbols]).size);
    assert.equal(Object.keys(firstQuotes).length, firstSymbols.length);
    assert.equal(Object.keys(secondQuotes).length, secondSymbols.length);
    assert.equal(maximumActiveRequests, 4);
  });

  test("caps one request at 32 distinct symbols", async () => {
    let requestCount = 0;
    const client = createMarketDataClient({
      fetch: async () => {
        requestCount += 1;
        return jsonResponse(yahooChart(100));
      }
    });

    const symbols = Array.from({ length: 100 }, (_, index) => `S${index}`);
    const quotes = await client.fetchStockQuotes(symbols);

    assert.equal(requestCount, 32);
    assert.equal(Object.keys(quotes).length, 32);
  });

  test("rejects an oversized Yahoo response before JSON parsing", async () => {
    const client = createMarketDataClient({
      fetch: async () =>
        new Response("x".repeat(300 * 1024), {
          headers: { "Content-Type": "application/json" }
        })
    });

    assert.deepEqual(await client.fetchStockQuotes(["AAPL"]), {});
  });
});
