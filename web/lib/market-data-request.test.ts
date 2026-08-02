import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createInMemoryRateLimiter,
  marketDataClientIdentifier,
  MarketDataRateLimitError
} from "./market-data-policy.ts";
import { parseMarketDataRequest } from "./market-data-request.ts";

function request(body: unknown, contentType = "application/json"): Request {
  return new Request("https://looper.app/api/v1/market-data", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body)
  });
}

describe("market data request validation", () => {
  test("normalizes and deduplicates any valid market symbols", async () => {
    assert.deepEqual(
      await parseMarketDataRequest(request({ symbols: ["aapl", "BTC", "AAPL", "msft"] })),
      { symbols: ["AAPL", "BTC", "MSFT"] }
    );
  });

  test("rejects API keys, unknown fields, and malformed symbols", async () => {
    await assert.rejects(
      parseMarketDataRequest(request({ apiKey: "no-longer-supported", symbols: ["MSFT"] })),
      /invalid/i
    );
    await assert.rejects(
      parseMarketDataRequest(request({ symbols: ["bad-symbol"], extra: true })),
      /invalid/i
    );
  });

  test("requires JSON", async () => {
    await assert.rejects(
      parseMarketDataRequest(request({ symbols: ["AAPL"] }, "text/plain")),
      /Content-Type/
    );
  });

  test("stops reading a chunked body at the byte limit", async () => {
    const oversized = new Request("https://looper.app/api/v1/market-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(9 * 1024)));
          controller.close();
        }
      }),
      duplex: "half"
    } as RequestInit & { duplex: "half" });

    await assert.rejects(parseMarketDataRequest(oversized), /too large/i);
  });
});

describe("market data rate limiting", () => {
  test("limits each client in a fixed window and resets after the window", () => {
    let time = 1_000;
    const limiter = createInMemoryRateLimiter({
      maximumClients: 2,
      maximumRequests: 2,
      now: () => time,
      windowMs: 10_000
    });

    assert.equal(limiter.consume("client-a").allowed, true);
    assert.equal(limiter.consume("client-a").allowed, true);
    const denied = limiter.consume("client-a");
    assert.deepEqual(denied, { allowed: false, retryAfterSeconds: 10 });
    assert.equal(new MarketDataRateLimitError(denied.retryAfterSeconds).status, 429);

    time += 10_000;
    assert.equal(limiter.consume("client-a").allowed, true);
  });

  test("bounds tracked clients and uses Vercel's non-spoofable forwarding header", () => {
    const limiter = createInMemoryRateLimiter({
      maximumClients: 2,
      maximumRequests: 1,
      windowMs: 10_000
    });
    limiter.consume("client-a");
    limiter.consume("client-b");
    limiter.consume("client-c");
    assert.equal(limiter.trackedClientCount(), 2);

    const forwardedRequest = new Request("https://looper.app", {
      headers: {
        "x-forwarded-for": "198.51.100.2",
        "x-vercel-forwarded-for": "203.0.113.4"
      }
    });
    assert.equal(marketDataClientIdentifier(forwardedRequest), "203.0.113.4");
  });
});
