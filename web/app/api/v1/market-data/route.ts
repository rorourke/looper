import { ApiError, apiErrorResponse, privateJson } from "@/lib/api-response";
import {
  createInMemoryRateLimiter,
  marketDataClientIdentifier,
  MarketDataRateLimitError
} from "@/lib/market-data-policy";
import { parseMarketDataRequest } from "@/lib/market-data-request";
import { createMarketDataClient } from "../../../../../electron/src/main/marketData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const marketData = createMarketDataClient();
const marketDataRateLimiter = createInMemoryRateLimiter({
  maximumClients: 1_024,
  maximumRequests: 12,
  windowMs: 60_000
});

export async function POST(request: Request) {
  try {
    const rateLimit = marketDataRateLimiter.consume(marketDataClientIdentifier(request));
    if (!rateLimit.allowed) {
      throw new MarketDataRateLimitError(rateLimit.retryAfterSeconds);
    }
    const input = await parseMarketDataRequest(request);
    const quotes = await marketData.fetchStockQuotes(input.symbols);
    if (Object.keys(quotes).length === 0) {
      throw new ApiError(
        502,
        "market_data_unavailable",
        "The market data provider did not return a quote."
      );
    }
    return privateJson({ quotes });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (error instanceof MarketDataRateLimitError) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
}
