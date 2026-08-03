import type { StockQuoteMap } from "./looperEngine.ts";

export type LibraryConceptDefinition = {
  description: string;
  id: string;
  loopCount: number;
  loopValues?: Readonly<Partial<Record<number, readonly string[]>>>;
  source: string;
  stockQuotes?: StockQuoteMap;
  title: string;
};

const exampleStockQuotes: StockQuoteMap = {
  AAPL: {
    symbol: "AAPL",
    price: 220
  },
  BTC: {
    symbol: "BTC",
    price: 101_660
  },
  TSLA: {
    symbol: "TSLA",
    price: 403
  }
};

export const libraryConcepts = [
  {
    id: "loop-keyword",
    title: "The Magic Word",
    description: "loop counts each step from zero.",
    loopCount: 4,
    loopValues: {
      0: ["0", "1", "2", "3", "4"],
      2: ["1", "2", "3", "4", "5"],
      3: ["$1.2K", "$2.4K", "$3.6K", "$4.8K", "$6K"]
    },
    source: `loop
cost = $1,200
month = loop + 1
spent = cost * month`
  },
  {
    id: "variables",
    title: "Math with Variables",
    description: "Name values, then calculate with them.",
    loopCount: 0,
    source: `rent = $900
car = $600
groceries = $450
bills = rent + car + groceries`
  },
  {
    id: "live-prices",
    title: "Live Market Prices",
    description: "Use $ plus a ticker for a live price.",
    loopCount: 0,
    stockQuotes: exampleStockQuotes,
    source: `apple = $AAPL
tesla = $TSLA
bitcoin = $BTC
ten_apple = apple * 10`
  },
  {
    id: "market-details",
    title: "Compare Market Prices",
    description: "Use live prices together in a formula.",
    loopCount: 0,
    stockQuotes: exampleStockQuotes,
    source: `apple = $AAPL
tesla = $TSLA
difference = tesla - apple
combined = apple + tesla`
  },
  {
    id: "custom-functions",
    title: "Reusable Functions",
    description: "Define a calculation once, then reuse it.",
    loopCount: 0,
    source: `fee(rate, loan) { loan * rate / 12 }
a = fee(2.75%, $3M)
b = fee(3%, $2.5M)
difference = b - a`
  },
  {
    id: "section-math",
    title: "Instant Totals",
    description: "Add every value in the section above.",
    loopCount: 0,
    source: `rent = $900
car = $600
groceries = $450
bills = sumsection`
  },
  {
    id: "section-average",
    title: "Section Averages",
    description: "Average every value in the section above.",
    loopCount: 0,
    source: `monday = 72
tuesday = 84
wednesday = 93
average = avgsection`
  },
  {
    id: "section-minimum",
    title: "Section Minimums",
    description: "Choose the smallest value in a section.",
    loopCount: 0,
    source: `basic = $18
pro = $32
team = $27
lowest = minsection`
  },
  {
    id: "section-maximum",
    title: "Section Maximums",
    description: "Choose the largest value in a section.",
    loopCount: 0,
    source: `january = $42k
february = $55k
march = $49k
best_month = maxsection`
  },
  {
    id: "loop-helpers",
    title: "Loop Helpers",
    description: "Read the first, last, or previous loop value.",
    loopCount: 3,
    loopValues: {
      0: ["$10K", "$11K", "$12.1K", "$13.31K"],
      1: ["$10K", "$10K", "$10K", "$10K"],
      2: ["$13.31K", "$13.31K", "$13.31K", "$13.31K"],
      3: ["0", "$10K", "$11K", "$12.1K"]
    },
    source: `value = $10k * 1.1 ^ loop
first = loop.first(value)
last = loop.last(value)
prior = loop.previous(value)`
  }
] as const satisfies readonly LibraryConceptDefinition[];
