import { ApiError } from "./api-response.ts";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type InMemoryRateLimiter = {
  consume: (clientIdentifier: string) => RateLimitDecision;
  trackedClientCount: () => number;
};

type RateLimitBucket = {
  count: number;
  resetsAt: number;
};

export function createInMemoryRateLimiter(options: {
  maximumClients: number;
  maximumRequests: number;
  now?: () => number;
  windowMs: number;
}): InMemoryRateLimiter {
  const buckets = new Map<string, RateLimitBucket>();
  const now = options.now ?? Date.now;

  function pruneExpiredBuckets(requestTime: number): void {
    for (const [clientIdentifier, bucket] of buckets) {
      if (bucket.resetsAt <= requestTime) buckets.delete(clientIdentifier);
    }
  }

  function makeRoomForNewClient(): void {
    while (buckets.size >= options.maximumClients) {
      const oldestClient = buckets.keys().next().value;
      if (typeof oldestClient !== "string") break;
      buckets.delete(oldestClient);
    }
  }

  function consume(clientIdentifier: string): RateLimitDecision {
    const requestTime = now();
    let bucket = buckets.get(clientIdentifier);
    if (bucket?.resetsAt !== undefined && bucket.resetsAt <= requestTime) {
      buckets.delete(clientIdentifier);
      bucket = undefined;
    }

    if (!bucket) {
      pruneExpiredBuckets(requestTime);
      makeRoomForNewClient();
      buckets.set(clientIdentifier, {
        count: 1,
        resetsAt: requestTime + options.windowMs
      });
      return {
        allowed: true,
        retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1_000))
      };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetsAt - requestTime) / 1_000)
    );
    if (bucket.count >= options.maximumRequests) {
      return { allowed: false, retryAfterSeconds };
    }

    bucket.count += 1;
    buckets.delete(clientIdentifier);
    buckets.set(clientIdentifier, bucket);
    return { allowed: true, retryAfterSeconds };
  }

  return {
    consume,
    trackedClientCount: () => buckets.size
  };
}

export function marketDataClientIdentifier(request: Request): string {
  for (const headerName of [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "x-real-ip"
  ]) {
    const value = request.headers.get(headerName)?.split(",", 1)[0]?.trim();
    if (value && value.length <= 128) return value;
  }
  return "unknown";
}

export class MarketDataRateLimitError extends ApiError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      429,
      "rate_limited",
      "Too many market data requests. Try again shortly.",
      { retryAfterSeconds }
    );
    this.name = "MarketDataRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
