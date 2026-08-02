# Live market prices

Looper retrieves current stock and cryptocurrency prices from Yahoo Finance's chart service.
There are no API keys, provider accounts, or market-data settings for users to configure.

## Supported expressions

- `$AAPL` returns Apple's latest available market price.
- `$MSFT * 5` values a five-share holding at Microsoft's latest available price.
- Crypto aliases such as `$BTC` and `$ETH` map to Yahoo Finance pairs such as `BTC-USD`
  and `ETH-USD`.

Live market data is intentionally price-only. Quote modifiers such as `.dayhigh`, `.marketcap`,
`.pe`, and `.volume` are not supported. Older sheets that use a modifier receive a clear
evaluation error directing the user back to the plain `$SYMBOL` expression.

Prices refresh once per minute while their sheet is open. Looper caches successful prices for
one minute, coalesces simultaneous requests for the same symbol, limits Yahoo requests to four
at a time, and preserves successful symbols when another symbol is unavailable.

The packaged desktop app contacts Yahoo from each user's computer. The public website also hosts
a rate-limited `/api/v1/market-data` proxy for browser clients that cannot depend on direct
cross-origin access to the chart service. Neither path stores or transmits a market-data credential.

Market prices are informational and are not investment advice. Availability, timeliness, and
exchange delays depend on Yahoo Finance and the underlying market.
