import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assignmentLineNumbers,
  createGettingStartedDocuments,
  GETTING_STARTED_TEMPLATE_REVISION,
  gettingStartedExamples,
  isGettingStartedExampleDocumentId,
  isPristinePreviousGettingStartedExampleDocument,
  LEGACY_GETTING_STARTED_DOCUMENT_ID,
  retiredGettingStartedExampleIds,
  restoreGettingStartedExampleDocuments,
  seedGettingStartedDocuments
} from "./gettingStartedDocument.ts";
import {
  evaluateLooperText,
  extractStockSymbols,
  visibleLooperText,
  type LineEvaluation,
  type LooperEvaluation,
  type StockQuoteMap
} from "./looperEngine.ts";

const exampleStockQuotes: StockQuoteMap = {
  AAPL: { price: 215 },
  BTC: { price: 65_000 },
  AMZN: { price: 190 },
  ETH: { price: 3_500 },
  GOOGL: { price: 180 },
  JPM: { price: 210 },
  META: { price: 520 },
  MSFT: { price: 450 },
  NFLX: { price: 700 },
  NVDA: { price: 140 },
  TSLA: { price: 240 },
  V: { price: 290 }
};

const previousExampleTitleIds = new Map<string, string>([
  ["Retirement Growth", "builtin-example-retirement-growth"],
  ["Mortgage Comparison", "builtin-example-mortgage-comparison"],
  ["Startup Runway", "builtin-example-startup-runway"],
  ["Burn Rate", "builtin-example-startup-runway"],
  ["Household Budget", "builtin-example-household-budget"],
  ["Product Launch Profit", "builtin-example-product-launch-profit"],
  ["Stock Research Snapshot", "builtin-example-stock-research"],
  ["My Portfolio", "builtin-example-stock-research"]
]);

const retiredExampleDefinitions = [
  {
    id: "builtin-example-stock-research",
    title: "Portfolio",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: ["apple", "microsoft", "total"],
    text: `Portfolio:
apple = $AAPL * 10
microsoft = $MSFT * 5
total = sumsection`
  },
  {
    id: "builtin-example-household-budget",
    title: "Monthly Spending",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: ["monthly_spend", "year_to_date"],
    text: `Fixed monthly costs:
rent = $2,250
car_payment = $475
insurance = $190
phone = $85
subscriptions = $45
fixed_spend = rent + car_payment + insurance + phone + subscriptions

Variable monthly costs:
groceries = $650
credit_card = $500 + $150 * cos(loop * π / 3)
eating_out = $250 + $75 * sin(loop * π / 6)
utilities = $180 + $60 * cos(loop * π / 6)
variable_spend = groceries + credit_card + eating_out + utilities

Spending through the year:
monthly_spend = fixed_spend + variable_spend
year_to_date = loop.previous(year_to_date) + monthly_spend
`
  },
  {
    id: "builtin-example-mortgage-comparison",
    title: "Mortgage Comparison",
    loopCount: 359,
    loopPeriod: "Month",
    publishedVariableNames: ["pay_1", "pay_2", "spent_1", "spent_2", "saved"],
    text: `Mortgage payment function:
mortgagePayment(principal, annual_rate, years) {
\tmonthly_rate = annual_rate / 12
\tpayments = years * 12
\tgrowth_factor = (1 + monthly_rate) ^ payments
\tprincipal * monthly_rate * growth_factor / (growth_factor - 1)
}

Compare two loans:
loan = $750k
pay_1 = mortgagePayment(loan, 6.25%, 30)
pay_2 = mortgagePayment(loan, 5.75%, 30)

Cost by month:
spent_1 = pay_1 * (loop + 1)
spent_2 = pay_2 * (loop + 1)
saved = spent_1 - spent_2
`
  },
  {
    id: "builtin-example-product-launch-profit",
    title: "Seasonal Electricity",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: [
      "bill",
      "previous_bill",
      "last_bill",
      "lowest_bill",
      "highest_bill",
      "average_bill"
    ],
    text: `Seasonal electricity costs:
base_bill = $140
seasonal_swing = $60
bill = base_bill + seasonal_swing * cos(loop * π / 6)
previous_bill = loop.previous(bill)

Annual bill summary:
last_bill = loop.last(bill)
lowest_bill = loop.min(bill)
highest_bill = loop.max(bill)
average_bill = loop.avg(bill)
`
  }
] as const;

function createRetiredExampleDocuments(updatedAt = "2026-07-18T00:00:00.000Z") {
  return retiredExampleDefinitions.map((definition) => ({
    id: definition.id,
    title: definition.title,
    updatedAt,
    data: {
      title: definition.title,
      text: definition.text,
      fontScale: 0,
      decimalPlaces: 2,
      loopCount: definition.loopCount,
      loopPeriod: definition.loopPeriod,
      loopedLines: assignmentLineNumbers(
        definition.text,
        definition.publishedVariableNames
      ),
      isLoopVariablePublished: true,
      isLoopEnabled: true,
      isResultsHidden: false,
      resultSortMode: "manual" as const,
      stockSymbols: []
    }
  }));
}

function allHistoricalExampleDocuments() {
  return [
    ...createGettingStartedDocuments("2026-07-18T00:00:00.000Z").map(
      (document) => ({
        ...document,
        data: { ...document.data, isResultsHidden: false }
      })
    ),
    ...createRetiredExampleDocuments()
  ];
}

function exampleDocument(title: string) {
  const documents = allHistoricalExampleDocuments();
  const document = documents.find(
    (candidate) => candidate.title === title
  );
  if (document) return document;

  const previousDocument = documents.find(
    (candidate) => candidate.id === previousExampleTitleIds.get(title)
  );
  assert.ok(previousDocument, `Expected a bundled example titled ${title}`);
  return {
    ...previousDocument,
    title,
    data: {
      ...previousDocument.data,
      title,
      loopPeriod:
        title === "Stock Research Snapshot" ||
        title === "Live Stock Prices" ||
        title === "My Portfolio"
          ? "Day"
          : previousDocument.data.loopPeriod
    }
  };
}

function historicalExampleDocument(id: string, title: string) {
  const document = allHistoricalExampleDocuments().find(
    (candidate) => candidate.id === id
  );
  assert.ok(document, `Expected a bundled example with id ${id}`);
  return {
    ...document,
    title,
    data: { ...document.data, title }
  };
}

function evaluationFor(title: string): LooperEvaluation {
  const data = exampleDocument(title).data;
  return evaluateLooperText(data.text, data.loopCount, exampleStockQuotes);
}

function evaluations(result: LooperEvaluation, variable: string): LineEvaluation[] {
  const matchingLine = result.lines.find(
    (line) => line.variable?.toLowerCase() === variable.toLowerCase()
  );
  assert.ok(matchingLine, `Expected a line assigning ${variable}`);
  return matchingLine.evaluations;
}

function values(result: LooperEvaluation, variable: string): number[] {
  return evaluations(result, variable).map((evaluation) => {
    assert.equal(
      evaluation.status,
      "success",
      evaluation.error ?? `Expected ${variable} to evaluate successfully`
    );
    assert.ok(evaluation.value);
    return evaluation.value.value;
  });
}

function approximately(actual: number, expected: number, epsilon = 1e-8): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

const revisionFourteenRunwayText = `loop = 12

Startup runway:
start_cash = $900k
revenue = $45k * (1 + 4%) ^ loop
expenses = $95k * (1 + 1.5%) ^ loop
burn = expenses - revenue
total_burn = 0
total_burn = total_burn + burn
cash = start_cash - total_burn

Cash summary:
prior_cash = loop.previous(cash)
end_cash = loop.last(cash)
low_cash = loop.min(cash)
high_cash = loop.max(cash)
avg_cash = loop.avg(cash)
months_left = loop.last - loop
`;

const revisionSixteenBurnRateText = `loop = 12

Burn rate:
starting_cash = $600k
monthly_revenue = $25k
monthly_expenses = $75k
monthly_burn = monthly_expenses - monthly_revenue

Bank balance by month:
bank_balance = starting_cash - monthly_burn * loop
months_left = floor(starting_cash / monthly_burn) - loop

Burn summary:
months_of_cash = floor(starting_cash / monthly_burn)
ending_balance = loop.last(bank_balance)
`;

const revisionTwentyTwoBurnRateText = `Burn rate:
starting_cash = $600k
monthly_revenue = $25k
monthly_expenses = $75k
monthly_burn = monthly_expenses - monthly_revenue

Bank balance by month:
bank_balance = starting_cash - monthly_burn * loop
months_left = floor(starting_cash / monthly_burn) - loop

Burn summary:
months_of_cash = floor(starting_cash / monthly_burn)
`;

const revisionSixteenAdvancedLoopsText = `loop = 12

Product launch:
orders = floor(2050 * (1 + 5%) ^ loop)
price = $49
unit_cost = $12.50
ads = $35k
profit = orders × (price - unit_cost) - ads
agents = ceil(orders / 400)
orders_each = orders ÷ agents

Advanced loop calculations:
prior_profit = loop.previous(profit)
profit_change = profit - prior_profit
first_profit = loop.first(profit)
last_profit = loop.last(profit)
low_profit = loop.min(profit)
high_profit = loop.max(profit)
avg_profit = loop.avg(profit)
`;

const revisionSeventeenMonthlySpendingText = `loop = 0

Fixed monthly spending:
rent = $2,250
car = $475
groceries = $650
trombone_oil = $12
cable = $85
dog_walker = $280
total = sumsection

Weekly groceries:
week_1 = $146
week_2 = $159
week_3 = $138
week_4 = $171
average = avgsection

Commute options:
transit = $81
driving = $240
rideshare = $410
cheapest = minsection

Unexpected expenses:
vet = $320
car_repair = $875
phone = $699
largest = maxsection
`;

const revisionEighteenMortgageText = `loop = 0

Mortgage payment function:
payment(loan, rate, years) {
  monthly_rate = rate / 12
  months = years * 12
  factor = (1 + monthly_rate) ^ months
  loan * monthly_rate * factor / (factor - 1)
}

high_payment = payment($750k, 6.25%, 30)
low_payment = payment($750k, 5.75%, 30)
monthly_savings = high_payment - low_payment
total_savings = monthly_savings * 30 * 12
`;

const revisionTwentyThreeFunctionsText = `Mortgage payment function:
pay(p, apr, yrs) {
  r = apr / 12
  n = yrs * 12
  f = (1 + r) ^ n
  p * r * f / (f - 1)
}

Compare two loans:
loan = $750k
pay_1 = pay(loan, 6.25%, 30)
pay_2 = pay(loan, 5.75%, 30)

Cost by month:
spent_1 = pay_1 * (loop + 1)
spent_2 = pay_2 * (loop + 1)
saved = spent_1 - spent_2
`;

const revisionTwentyFourStockText = `Live stock prices:
apple = $AAPL
apple_range = $AAPL.dayhigh - $AAPL.daylow
apple_cap = $AAPL.marketcap
apple_avg = $AAPL.priceavg50
apple_pe = $AAPL.pe

Bitcoin:
bitcoin = $BTC
bitcoin_range = $BTC.dayhigh - $BTC.daylow
`;

const revisionTwentyFivePortfolioText = `My portfolio:
$AAPL * 600
$MSFT * 250
$NVDA * 180
$AMZN * 120
$GOOGL * 90
$META * 75
$TSLA * 100
$JPM * 200
$V * 150
$NFLX * 40
$BTC * 3.25
$ETH * 18
`;

function revisionTwentyDocuments() {
  return createGettingStartedDocuments("2026-07-18T00:00:00.000Z")
    .map((document) => ({ ...document, id: document.id as string }))
    .filter((document) =>
      (gettingStartedExamples.find((example) => example.id === document.id)?.introducedRevision ?? 0) <= 20
    )
    .map((document) => {
    let text = document.data.text;
    let publishedVariableNames: readonly string[] = gettingStartedExamples.find(
      (example) => example.id === document.id
    )?.publishedVariableNames ?? [];

    if (document.id === "builtin-example-syntax") {
      text = text.replace(
        `value = (loop + 1) * 10
previous = loop.previous(value)
minimum = loop.min(value)
maximum = loop.max(value)`,
        `period = loop + 1
previous = loop.previous(period)
minimum = loop.min(period)
maximum = loop.max(period)`
      );
      publishedVariableNames = ["period", "previous", "minimum", "maximum"];
    } else if (document.id === "builtin-example-household-budget") {
      text = text.replace(
        "Spending through the year:\n",
        "Spending through the year:\nmonth = loop + 1\n"
      );
      publishedVariableNames = ["month", "monthly_spend", "year_to_date"];
    } else if (document.id === "builtin-example-startup-runway") {
      text = revisionTwentyTwoBurnRateText;
      publishedVariableNames = ["monthly_burn", "bank_balance", "months_left"];
    } else if (document.id === "builtin-example-mortgage-comparison") {
      text = revisionTwentyThreeFunctionsText.replace(
        `Cost by month:
spent_1 = pay_1 * (loop + 1)
spent_2 = pay_2 * (loop + 1)`,
        `Cost by month:
month = loop + 1
spent_1 = pay_1 * month
spent_2 = pay_2 * month`
      );
      publishedVariableNames = [
        "month",
        "pay_1",
        "pay_2",
        "spent_1",
        "spent_2",
        "saved"
      ];
    } else if (document.id === "builtin-example-retirement-growth") {
      text = `Compound interest:
principal = $50,000
return = 7%
balance = principal * (1 + return) ^ loop
prior_balance = loop.previous(balance)
interest = prior_balance * return

Interest summary:
start_balance = loop.first(balance)
end_balance = loop.last(balance)
`;
      publishedVariableNames = ["balance", "interest"];
    } else if (document.id === "builtin-example-stock-research") {
      text = revisionTwentyFourStockText;
      publishedVariableNames = ["apple", "apple_range", "apple_cap", "bitcoin"];
    }

    const title = document.id === "builtin-example-startup-runway"
      ? "Burn Rate"
      : document.id === "builtin-example-stock-research"
        ? "Live Stock Prices"
        : document.id === "builtin-example-mortgage-comparison"
          ? "Functions"
          : document.id === "builtin-example-product-launch-profit"
            ? "Advanced Loops"
            : document.title;
    return {
      ...document,
      title,
      data: {
        ...document.data,
        title,
        text,
        loopCount: document.id === "builtin-example-startup-runway"
          ? 12
          : document.data.loopCount,
        loopPeriod: document.id === "builtin-example-stock-research"
          ? "Day"
          : document.data.loopPeriod,
        loopedLines: assignmentLineNumbers(text, publishedVariableNames),
        isResultsHidden: false
      }
    };
    });
}

const revisionFifteenExampleTemplates = [
  {
    title: "Retirement Growth",
    text: `loop = 20

Retirement growth:
savings = $50,000
return = 7%
balance = savings * (1 + return) ^ loop
prior_balance = loop.previous(balance)
interest = prior_balance * return

Plan summary:
start_balance = loop.first(balance)
end_balance = loop.last(balance)
`,
    publishedVariableNames: ["balance", "interest"],
    isLoopEnabled: true
  },
  {
    title: "Mortgage Comparison",
    text: `loop = 0

Mortgage comparison:
payment(loan, rate, years) {
  monthly_rate = rate / 12
  months = years * 12
  factor = (1 + monthly_rate) ^ months
  loan * monthly_rate * factor / (factor - 1)
}

high_payment = payment($750k, 6.25%, 30)
low_payment = payment($750k, 5.75%, 30)
monthly_savings = high_payment - low_payment
total_savings = monthly_savings * 30 * 12
`,
    publishedVariableNames: [
      "high_payment",
      "low_payment",
      "monthly_savings",
      "total_savings"
    ],
    isLoopEnabled: false
  },
  {
    title: "Startup Runway",
    text: `loop = 12

Startup runway:
starting_cash = $600k
monthly_revenue = $25k
monthly_expenses = $75k
monthly_burn = monthly_expenses - monthly_revenue

Bank balance by month:
bank_balance = starting_cash - monthly_burn * loop
months_left = floor(starting_cash / monthly_burn) - loop

Runway summary:
runway_months = floor(starting_cash / monthly_burn)
ending_balance = loop.last(bank_balance)
`,
    publishedVariableNames: ["monthly_burn", "bank_balance", "months_left"],
    isLoopEnabled: true
  },
  {
    title: "Household Budget",
    text: `loop = 0

Fixed monthly costs:
rent = $2,250
car = $475
groceries = $650
trombone_oil = $12
cable = $85
dog_walker = $280
total = sumsection

Weekly grocery spending:
week_1 = $146
week_2 = $159
week_3 = $138
week_4 = $171
average = avgsection

Commute options:
transit = $81
driving = $240
rideshare = $410
cheapest = minsection

Unexpected expenses:
vet = $320
car_repair = $875
phone = $699
largest = maxsection
`,
    publishedVariableNames: ["total", "average", "cheapest", "largest"],
    isLoopEnabled: false
  },
  {
    title: "Product Launch Profit",
    text: `loop = 12

Product launch profit:
reach = 82k * (1 + 5%) ^ loop
conversion = 2.5%
orders = floor(reach * conversion)
price = $49
revenue = orders × price
cost = $12.50
gross_profit = revenue - orders × cost
ads = $35k
profit = gross_profit - ads
agents = ceil(orders / 400)
orders_each = orders ÷ agents
break_even = ceil(ads / (price - cost))
`,
    publishedVariableNames: ["orders", "revenue", "profit", "agents"],
    isLoopEnabled: true
  },
  {
    title: "Stock Research Snapshot",
    text: `loop = 0

Live market data:
apple = $AAPL
apple_range = $AAPL.dayhigh - $AAPL.daylow
apple_cap = $AAPL.marketcap
apple_avg = $AAPL.priceavg50
apple_pe = $AAPL.pe

Bitcoin:
bitcoin = $BTC
bitcoin_range = $BTC.dayhigh - $BTC.daylow
`,
    publishedVariableNames: ["apple", "apple_range", "apple_cap", "bitcoin"],
    isLoopEnabled: false
  }
] as const;

function revisionFifteenDocuments() {
  return revisionFifteenExampleTemplates.map((template) => {
    const document = exampleDocument(template.title);
    const legacyVisibleText = template.isLoopEnabled
      ? template.text
      : template.text.split("\n").slice(1).join("\n");
    return {
      ...document,
      data: {
        ...document.data,
        text: template.text,
        loopedLines: assignmentLineNumbers(
          legacyVisibleText,
          template.publishedVariableNames
        ),
        loopPeriod: template.title === "Mortgage Comparison"
          ? "Scenario"
          : document.data.loopPeriod,
        isLoopEnabled: template.isLoopEnabled
      }
    };
  });
}

describe("Getting Started example gallery", () => {
  test("bundles the numbered learning path before the five templates", () => {
    const documents = createGettingStartedDocuments("2026-07-18T00:00:00.000Z");
    const expectedTitles = [
      "The Loop Keyword",
      "Math with Variables",
      "Global Variables",
      "Live Stock Prices",
      "Sum Section",
      "Functions",
      "Advanced Loops",
      "Fancy Math",
      "Compound Interest",
      "Stock Portfolio",
      "Startup Runway",
      "Amortization Schedule",
      "Construction Budget"
    ];

    assert.equal(documents.length, expectedTitles.length);
    assert.deepEqual(documents.map((document) => document.title), expectedTitles);
    assert.equal(new Set(documents.map((document) => document.id)).size, documents.length);
    assert.equal(new Set(documents.map((document) => document.title)).size, documents.length);
    const loops = exampleDocument("The Loop Keyword");
    assert.equal(loops.data.loopCount, 4);
    assert.deepEqual(loops.data.loopedLines, [3]);

    const mathWithVariables = exampleDocument("Math with Variables");
    assert.equal(mathWithVariables.data.loopCount, 11);
    assert.deepEqual(mathWithVariables.data.loopedLines, [4, 5]);

    const globalVariables = exampleDocument("Global Variables");
    assert.deepEqual(globalVariables.data.loopedLines, [4]);
    assert.equal(globalVariables.data.isLoopVariablePublished, false);
    assert.match(globalVariables.data.text, /Start a name with @ to make it global/);
    assert.match(globalVariables.data.text, /defined only once across your sheets/);
    assert.match(globalVariables.data.text, /jump back to its definition/);

    const liveStockPrices = exampleDocument("Live Stock Prices");
    assert.deepEqual(liveStockPrices.data.loopedLines, [1, 2, 3]);
    assert.match(
      liveStockPrices.data.text,
      /query any ticker symbol to get its current stock price/
    );
    assert.match(liveStockPrices.data.text, /Type \$ before the ticker/);

    const functions = exampleDocument("Functions");
    assert.equal(functions.data.text.trimEnd().split("\n").length, 7);
    assert.match(functions.data.text, /monthlyInterest\(rate, loan\)/);
    assert.deepEqual(functions.data.loopedLines, [4, 5, 6]);
    assert.equal(functions.data.isLoopVariablePublished, false);

    const amortization = exampleDocument("Amortization Schedule");
    assert.equal(amortization.data.loopCount, 29);
    assert.deepEqual(amortization.data.loopedLines, [18, 19, 20, 21, 22]);
    assert.equal(amortization.data.isLoopVariablePublished, false);

    const fancyMath = exampleDocument("Fancy Math");
    assert.equal(fancyMath.data.isLoopVariablePublished, false);
    assert.deepEqual(fancyMath.data.loopedLines, []);
    assert.deepEqual(
      fancyMath.data.text
        .split("\n")
        .filter((line) => line.trimEnd().endsWith(":")),
      ["Fancy math:"]
    );
    assert.ok(
      fancyMath.data.text
        .split("\n")
        .slice(1)
        .every((line) => /^[_A-Za-z][_A-Za-z0-9]*\s*=/.test(line))
    );

    const conciseTitles = new Set(expectedTitles.slice(0, 7));

    documents.forEach((document, index) => {
      const definition = gettingStartedExamples[index];
      const visibleText = visibleLooperText(document.data.text, document.data.isLoopEnabled);
      const result = evaluateLooperText(document.data.text, document.data.loopCount, exampleStockQuotes);

      assert.equal(document.id, definition.id);
      assert.equal(document.updatedAt, "2026-07-18T00:00:00.000Z");
      assert.equal(document.data.title, definition.title);
      assert.equal(document.data.loopPeriod, definition.loopPeriod);
      assert.equal(/^\s*loop\s*=/im.test(document.data.text), false);
      assert.equal(document.data.loopCount, definition.loopCount);
      assert.equal(
        document.data.loopPeriod === "None",
        document.data.loopCount === 0,
        `${document.title} should only omit its iteration label when its loop count is zero`
      );
      assert.equal(
        definition.isSidebarOpenByDefault,
        definition.loopCount > 0,
        `${document.title} should only open the sidebar when it has loops`
      );
      assert.equal(
        document.data.isResultsHidden,
        !definition.isSidebarOpenByDefault,
        `${document.title} should use its configured default sidebar state`
      );
      assert.equal(result.errors, 0, `${document.title} should evaluate without errors`);
      assert.deepEqual(
        document.data.loopedLines,
        assignmentLineNumbers(visibleText, definition.publishedVariableNames)
      );
      assert.equal(document.data.loopedLines.length, definition.publishedVariableNames.length);
      assert.deepEqual(
        extractStockSymbols(document.data.text),
        document.title === "Live Stock Prices"
          ? ["AAPL", "MSFT"]
          : document.title === "Stock Portfolio"
            ? ["AAPL", "AMZN", "MSFT", "NVDA"]
            : []
      );
      assert.equal(isGettingStartedExampleDocumentId(document.id), true);
      assert.equal(document.data.isLoopEnabled, true);
      assert.doesNotMatch(
        document.data.text,
        /\r?\n$/,
        `${document.title} should not render a trailing blank line`
      );
      assert.equal(
        document.data.text.includes("//"),
        document.title === "The Loop Keyword" ||
          document.title === "Global Variables" ||
          document.title === "Live Stock Prices" ||
          document.title === "Sum Section" ||
          document.title === "Construction Budget"
      );

      const headingLines = document.data.text
        .split("\n")
        .filter((line) => line.trimEnd().endsWith(":"));
      assert.ok(headingLines.length > 0);
      assert.ok(
        headingLines.every((line) => line !== line.toUpperCase()),
        `${document.title} should use sentence-case headings`
      );
      if (conciseTitles.has(document.title)) {
        const lineLimit = document.title === "Sum Section"
          ? 14
          : document.title === "Global Variables"
            ? 10
            : 8;
        assert.ok(
          document.data.text.trimEnd().split("\n").length <= lineLimit,
          `${document.title} should demonstrate one concept briefly`
        );
      }
      const assignedNames = document.data.text
        .split("\n")
        .map((line) => line.match(/^\s*((?:@)?[_A-Za-z][_A-Za-z0-9]*)\s*=/)?.[1])
        .filter((name): name is string => name !== undefined);
      assert.ok(
        assignedNames.every((name) => name.length <= 20),
        `${document.title} should use concise variable names`
      );
      assert.equal(
        assignedNames.some(
          (name) => name.toLowerCase() === document.data.loopPeriod.toLowerCase()
        ),
        false,
        `${document.title} should keep its iteration label in the app chrome`
      );
    });

    assert.ok(documents.every((document) => document.data.isLoopEnabled));
    assert.ok(documents.every((document) => !/^\s*loop\s*=/im.test(document.data.text)));
    assert.equal(documents.at(-1)?.title, "Construction Budget");

    assert.equal(isGettingStartedExampleDocumentId(LEGACY_GETTING_STARTED_DOCUMENT_ID), false);
    assert.equal(isGettingStartedExampleDocumentId("doc-user-created"), false);
  });

  test("produces useful representative calculations in every example", () => {
    const usingLoops = evaluationFor("The Loop Keyword");
    assert.deepEqual(values(usingLoops, "balance"), [1_000, 1_250, 1_500, 1_750, 2_000]);

    const mathWithVariables = evaluationFor("Math with Variables");
    assert.deepEqual(
      values(mathWithVariables, "monthly_bills"),
      Array(12).fill(2_075)
    );
    assert.deepEqual(
      values(mathWithVariables, "year_to_date"),
      Array.from({ length: 12 }, (_, index) => 2_075 * (index + 1))
    );

    const marketDetails = evaluationFor("Live Stock Prices");
    assert.deepEqual(values(marketDetails, "apple"), [215]);
    assert.deepEqual(values(marketDetails, "microsoft"), [450]);
    assert.deepEqual(values(marketDetails, "difference"), [235]);

    const functions = evaluationFor("Functions");
    assert.deepEqual(values(functions, "loan_a_monthly"), Array(60).fill(6_875));
    assert.deepEqual(values(functions, "loan_b_monthly"), Array(60).fill(6_250));
    assert.equal(values(functions, "loan_a_lifetime_paid").at(-1), 412_500);
    assert.equal(values(functions, "loan_b_lifetime_paid").at(-1), 375_000);
    assert.equal(values(functions, "lifetime_delta").at(-1), 37_500);

    const sections = evaluationFor("Sum Section");
    assert.deepEqual(values(sections, "total"), [900]);
    assert.deepEqual(values(sections, "average"), [75]);

    const fancyMath = evaluationFor("Fancy Math");
    assert.deepEqual(values(fancyMath, "grouped"), [10]);
    assert.deepEqual(values(fancyMath, "power"), [9]);
    approximately(values(fancyMath, "pi_value")[0], Math.PI);
    assert.deepEqual(values(fancyMath, "absolute"), [42]);
    assert.deepEqual(values(fancyMath, "root"), [9]);
    assert.deepEqual(values(fancyMath, "rounded"), [4]);
    assert.deepEqual(values(fancyMath, "truncated"), [3]);
    assert.deepEqual(values(fancyMath, "direction"), [-1]);
    assert.deepEqual(values(fancyMath, "rounded_down"), [3]);
    assert.deepEqual(values(fancyMath, "rounded_up"), [4]);
    assert.deepEqual(values(fancyMath, "logarithm"), [6]);
    approximately(values(fancyMath, "sine")[0], 1);
    approximately(values(fancyMath, "cosine")[0], -1);
    approximately(values(fancyMath, "tangent")[0], 1);

    const advancedLoops = evaluationFor("Advanced Loops");
    [10_000, 11_000, 12_100, 13_310, 14_641].forEach((expected, index) =>
      approximately(values(advancedLoops, "balance")[index], expected)
    );
    [0, 10_000, 11_000, 12_100, 13_310].forEach((expected, index) =>
      approximately(values(advancedLoops, "previous")[index], expected)
    );
    assert.ok(values(advancedLoops, "starting").every((value) => value === 10_000));
    values(advancedLoops, "ending").forEach((value) => approximately(value, 14_641));
    assert.ok(values(advancedLoops, "minimum").every((value) => value === 10_000));
    values(advancedLoops, "maximum").forEach((value) => approximately(value, 14_641));
    values(advancedLoops, "average").forEach((value) => approximately(value, 12_210.2));

    const compoundInterest = evaluationFor("Compound Interest");
    const balance = values(compoundInterest, "balance");
    assert.equal(balance.length, 21);
    approximately(balance[0], 5_000_000);
    approximately(balance[20], 19_348_422.312430896);
    assert.equal(
      evaluations(compoundInterest, "balance")[20].value?.exactValue,
      "19348422.3124308954161827015692436884990005"
    );
    approximately(values(compoundInterest, "annual_interest")[0], 0);
    approximately(
      values(compoundInterest, "annual_interest")[20],
      balance[19] * 0.07
    );

    const portfolio = evaluationFor("Stock Portfolio");
    assert.deepEqual(values(portfolio, "apple"), Array(21).fill(4_300));
    assert.deepEqual(values(portfolio, "microsoft"), Array(21).fill(5_400));
    assert.deepEqual(values(portfolio, "nvidia"), Array(21).fill(4_200));
    assert.deepEqual(values(portfolio, "amazon"), Array(21).fill(1_520));
    assert.deepEqual(values(portfolio, "portfolio_value"), Array(21).fill(15_420));
    const projectedValue = values(portfolio, "projected_value");
    assert.equal(projectedValue.length, 21);
    approximately(projectedValue[0], 15_420);
    approximately(projectedValue[20], 15_420 * 1.07 ** 20);
    approximately(values(portfolio, "annual_growth")[0], 0);
    approximately(
      values(portfolio, "annual_growth")[20],
      projectedValue[19] * 0.07
    );

    const runway = evaluationFor("Startup Runway");
    assert.deepEqual(values(runway, "monthly_revenue"), Array(12).fill(25_000));
    assert.deepEqual(values(runway, "monthly_expenses"), Array(12).fill(75_000));
    assert.deepEqual(values(runway, "monthly_burn"), Array(12).fill(50_000));
    assert.deepEqual(values(runway, "starting_balance"), [
      600_000, 550_000, 500_000, 450_000, 400_000, 350_000,
      300_000, 250_000, 200_000, 150_000, 100_000, 50_000
    ]);
    assert.deepEqual(values(runway, "revenue"), Array(12).fill(25_000));
    assert.deepEqual(values(runway, "expenses"), Array(12).fill(75_000));
    assert.deepEqual(values(runway, "ending_balance"), [
      550_000, 500_000, 450_000, 400_000, 350_000, 300_000,
      250_000, 200_000, 150_000, 100_000, 50_000, 0
    ]);

    const amortization = evaluationFor("Amortization Schedule");
    assert.equal(values(amortization, "annual_payment").length, 30);
    approximately(values(amortization, "annual_payment")[0], 30_339.265127662333);
    approximately(values(amortization, "interest_paid")[0], 25_868.363251822357);
    approximately(values(amortization, "principal_paid")[0], 4_470.901875839976);
    approximately(values(amortization, "remaining_balance")[0], 395_529.09812416);
    approximately(values(amortization, "interest_paid").at(-1) ?? Number.NaN, 1_041.732471868625);
    approximately(values(amortization, "principal_paid").at(-1) ?? Number.NaN, 29_297.532655793708);
    approximately(values(amortization, "remaining_balance").at(-1) ?? Number.NaN, 0);
    approximately(values(amortization, "total_interest_paid").at(-1) ?? Number.NaN, 510_177.9538298705);

    const construction = evaluationFor("Construction Budget");
    assert.deepEqual(values(construction, "LOT"), [3_500_000]);
    assert.deepEqual(values(construction, "HARD"), [6_800_000]);
    assert.deepEqual(values(construction, "SOFT"), [818_000]);
    assert.deepEqual(values(construction, "FFE"), [1_805_000]);
    assert.deepEqual(values(construction, "CONTINGENCY"), [1_413_450]);
    assert.deepEqual(values(construction, "TOTAL"), [14_336_450]);
  });

  test("keeps each example focused while covering the core teaching features", () => {
    const source = gettingStartedExamples.map((example) => example.text).join("\n");

    assert.match(source, /^balance = starting_balance \+ monthly_savings \* loop$/m);
    assert.match(source, /^monthly_bills = rent \+ utilities \+ internet$/m);
    assert.match(source, /^year_to_date = monthly_bills \* \(loop \+ 1\)$/m);
    assert.match(source, /monthlyInterest\(rate, loan\) \{ loan \* \(rate \/ 12\) \}/);
    assert.match(source, /^loan_a_lifetime_paid = loan_a_monthly \* \(loop \+ 1\)$/m);
    assert.match(source, /^loan_b_lifetime_paid = loan_b_monthly \* \(loop \+ 1\)$/m);
    assert.match(
      source,
      /^lifetime_delta = loan_a_lifetime_paid - loan_b_lifetime_paid$/m
    );
    assert.match(source, /^total = sumsection$/m);
    assert.match(source, /^average = avgsection$/m);
    assert.match(
      source,
      /^\/\/ sumsection adds the values above it, stopping at a blank row\.$/m
    );
    assert.match(source, /^grouped = \(2 \+ 3\) \* 4 \/ 2$/m);
    assert.match(source, /^power = 3 \^ 2$/m);
    assert.match(source, /^pi_value = pi$/m);
    assert.match(source, /^logarithm = log\(1M\)$/m);
    assert.match(source, /^sine = sin\(pi \/ 2\)$/m);
    assert.match(source, /^cosine = cos\(pi\)$/m);
    assert.match(source, /^tangent = tan\(pi \/ 4\)$/m);
    assert.match(source, /^monthly_burn = monthly_expenses - monthly_revenue$/m);
    assert.match(source, /^starting_balance = cash_in_bank - monthly_burn \* loop$/m);
    assert.match(source, /^ending_balance = starting_balance \+ revenue - expenses$/m);
    assert.match(source, /^month_end = \(loop \+ 1\) \* 12$/m);
    assert.match(source, /^monthly_payment = loan \* monthly_rate \* growth \/ \(growth - 1\)$/m);
    assert.match(source, /balanceAfterMonths\(principal, rate, payment, months\) \{/);
    assert.match(source, /^\tmonth_growth = \(1 \+ rate\) \^ months$/m);
    assert.match(source, /^balance_before = balanceAfterMonths\(loan, monthly_rate, monthly_payment, month_start\)$/m);
    assert.match(source, /^remaining_balance = balanceAfterMonths\(loan, monthly_rate, monthly_payment, month_end\)$/m);
    assert.match(source, /^annual_payment = monthly_payment \* 12$/m);
    assert.match(source, /^principal_paid = balance_before - remaining_balance$/m);
    assert.match(source, /^interest_paid = annual_payment - principal_paid$/m);
    assert.match(source, /^total_interest_paid = monthly_payment \* month_end - loan \+ remaining_balance$/m);
    assert.match(source, /^HARD = sumsection$/m);
    assert.match(source, /^SOFT = sumsection$/m);
    assert.match(source, /^FFE = sumsection$/m);
    assert.match(source, /^architect = HARD \* 6%$/m);
    assert.match(source, /^CONTINGENCY = \(SOFT \+ HARD \+ FFE\) \* 15%$/m);
    assert.match(source, /^TOTAL = LOT \+ SOFT \+ HARD \+ FFE \+ CONTINGENCY$/m);
    assert.doesNotMatch(source, /^Exterior Costs:$/m);
    assert.doesNotMatch(source, /^exterior\s*=/m);
    assert.match(source, /^absolute = abs\(-42\)$/m);
    assert.match(source, /^root = sqrt\(81\)$/m);
    assert.match(source, /^rounded = round\(3\.7\)$/m);
    assert.match(source, /^truncated = trunc\(3\.7\)$/m);
    assert.match(source, /^direction = sign\(-42\)$/m);

    assert.match(source, /loop\.first\(balance\)/);
    assert.match(source, /loop\.last\(balance\)/);
    assert.match(source, /loop\.previous\(balance\)/);
    const runway = gettingStartedExamples.find(
      (example) => example.id === "builtin-example-startup-runway"
    );
    assert.ok(runway);
    assert.equal(runway.loopCount, 11);
    assert.doesNotMatch(
      runway.text,
      /loop\.(?:previous|first|last|min|max|avg)/
    );

    assert.match(source, /7%/);
    assert.match(source, /\$AAPL(?:\s|$)/);
    assert.match(source, /^difference = microsoft - apple$/m);
    assert.match(source, /^portfolio_value = sumsection$/m);
    assert.match(
      source,
      /^projected_value = portfolio_value \* \(1 \+ expected_return\) \^ loop$/m
    );

    const functions = gettingStartedExamples.find(
      (example) => example.id === "builtin-example-functions"
    );
    assert.ok(functions);
    assert.equal(functions.loopCount, 59);
    assert.equal(functions.loopPeriod, "Month");
    assert.equal(functions.isLoopEnabled, true);

    const amortization = gettingStartedExamples.find(
      (example) => example.id === "builtin-example-amortization-schedule"
    );
    assert.ok(amortization);
    assert.equal(amortization.loopCount, 29);
    assert.equal(amortization.loopPeriod, "Year");
  });
});

describe("Getting Started gallery migration", () => {
  type DocumentStub = { id: string; content: string };
  const createStubs = (): DocumentStub[] =>
    gettingStartedExamples.map((example) => ({ id: example.id, content: "bundled" }));
  const stubsIntroducedAfter = (revision: number): DocumentStub[] =>
    gettingStartedExamples
      .filter((example) => example.introducedRevision > revision)
      .map((example) => ({ id: example.id, content: "bundled" }));
  const existing: DocumentStub = { id: "existing", content: "keep me" };

  test("adds every example on first install", () => {
    const result = seedGettingStartedDocuments<DocumentStub>([], null, createStubs);

    assert.deepEqual(result.documents, createStubs());
    assert.deepEqual(result.addedDocumentIds, gettingStartedExamples.map((example) => example.id));
    assert.deepEqual(result.upgradedDocumentIds, []);
    assert.equal(result.removedLegacyDocument, false);
    assert.equal(result.preferredActiveDocumentId, gettingStartedExamples[0].id);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });

  test("replaces a pristine revision-two monolith but preserves user sheets", () => {
    const legacy: DocumentStub = {
      id: LEGACY_GETTING_STARTED_DOCUMENT_ID,
      content: "pristine revision 2"
    };
    const result = seedGettingStartedDocuments<DocumentStub>(
      [existing, legacy],
      "2",
      createStubs,
      (document) => document === legacy
    );

    assert.strictEqual(result.documents[0], existing);
    assert.equal(result.documents.some((document) => document === legacy), false);
    assert.deepEqual(result.documents.slice(1), createStubs());
    assert.equal(result.removedLegacyDocument, true);
  });

  test("keeps an edited legacy tutorial as a user sheet while adding the gallery", () => {
    const editedLegacy: DocumentStub = {
      id: LEGACY_GETTING_STARTED_DOCUMENT_ID,
      content: "my edited tutorial"
    };
    const result = seedGettingStartedDocuments<DocumentStub>(
      [existing, editedLegacy],
      "2",
      createStubs,
      () => false
    );

    assert.strictEqual(result.documents[0], existing);
    assert.strictEqual(result.documents[1], editedLegacy);
    assert.deepEqual(result.documents.slice(2), createStubs());
    assert.equal(result.removedLegacyDocument, false);
  });

  test("never overwrites an edited new-ID example while filling missing siblings", () => {
    const editedExample: DocumentStub = {
      id: gettingStartedExamples[0].id,
      content: "my retirement assumptions"
    };
    const result = seedGettingStartedDocuments<DocumentStub>(
      [existing, editedExample],
      "2",
      createStubs
    );

    assert.strictEqual(result.documents[0], existing);
    assert.strictEqual(result.documents[1], editedExample);
    assert.equal(result.documents.length, gettingStartedExamples.length + 1);
    assert.equal(result.documents.filter((document) => document.id === editedExample.id).length, 1);
    assert.equal(result.addedDocumentIds.includes(editedExample.id), false);
  });

  test("upgrades pristine revision-five examples without resurrecting siblings", () => {
    const latestRetirement = exampleDocument("Retirement Growth");
    const previousRetirementText = `loop = 30
RETIREMENT GROWTH:
// Each column is a year. Change the return or contribution to explore a plan.
starting_savings = $50,000
annual_contribution = $6,000
annual_return = 7%
starting_growth = starting_savings * (1 + annual_return) ^ loop
contribution_growth = annual_contribution * ((1 + annual_return) ^ loop - 1) / annual_return
projected_balance = starting_growth + contribution_growth
prior_year_balance = loop.previous(projected_balance)
interest_this_year = prior_year_balance * annual_return

PLAN SUMMARY — LOOP HISTORY:
starting_balance = loop.first(projected_balance)
ending_balance = loop.last(projected_balance)
lowest_balance = loop.min(projected_balance)
highest_balance = loop.max(projected_balance)
average_balance = loop.avg(projected_balance)
`;
    const previousRetirement = {
      ...latestRetirement,
      data: {
        ...latestRetirement.data,
        text: previousRetirementText,
        loopedLines: [8, 10, 14]
      }
    };

    const latestRunway = exampleDocument("Startup Runway");
    const previousRunwayText = `loop = 18
STARTUP RUNWAY:
// Column 0 is the first modeled month. Later columns remember what came before.
starting_cash = $900k
monthly_revenue = $45k * (1 + 4%) ^ loop
monthly_expenses = $95k * (1 + 1.5%) ^ loop
net_burn = monthly_expenses - monthly_revenue
// Repeating a variable carries its previous column forward.
cumulative_burn = 0
cumulative_burn = cumulative_burn + net_burn
cash_remaining = starting_cash - cumulative_burn
three_month_cash_cushion = cash_remaining - net_burn * 3

RUNWAY SUMMARY — ADVANCED LOOPS:
prior_month_cash = loop.previous(cash_remaining)
first_projected_cash = loop.first(cash_remaining)
ending_cash = loop.last(cash_remaining)
lowest_cash = loop.min(cash_remaining)
highest_cash = loop.max(cash_remaining)
average_cash = loop.avg(cash_remaining)
first_month = loop.first
final_month = loop.last()
previous_month = loop.previous()
earliest_month = loop.min
latest_month = loop.max()
midpoint_month = loop.avg
months_left_in_forecast = loop.last - loop
`;
    const previousRunway = {
      ...latestRunway,
      data: {
        ...latestRunway.data,
        text: previousRunwayText,
        loopedLines: [6, 10, 11, 26]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousRetirement, "5"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousRunway, "5"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previousRetirement,
          data: { ...previousRetirement.data, text: `${previousRetirementText}// edited` }
        },
        "5"
      ),
      false
    );

    const oldRetirementStub: DocumentStub = {
      id: previousRetirement.id,
      content: "pristine retirement revision 5"
    };
    const oldRunwayStub: DocumentStub = {
      id: previousRunway.id,
      content: "pristine runway revision 5"
    };
    const upgradedRetirementStub = {
      ...oldRetirementStub,
      content: "bundled retirement revision 6"
    };
    const upgradedRunwayStub = {
      ...oldRunwayStub,
      content: "bundled runway revision 6"
    };
    const result = seedGettingStartedDocuments<DocumentStub>(
      [existing, oldRetirementStub, oldRunwayStub],
      "5",
      createStubs,
      undefined,
      (document) => {
        if (document === oldRetirementStub) return upgradedRetirementStub;
        if (document === oldRunwayStub) return upgradedRunwayStub;
        return document;
      }
    );

    assert.deepEqual(result.documents, [
      existing,
      upgradedRetirementStub,
      upgradedRunwayStub,
      ...stubsIntroducedAfter(5)
    ]);
    assert.deepEqual(
      result.addedDocumentIds,
      stubsIntroducedAfter(5).map((document) => document.id)
    );
    assert.deepEqual(result.upgradedDocumentIds, [
      oldRetirementStub.id,
      oldRunwayStub.id
    ]);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });

  test("upgrades the pristine revision-six mortgage example to indented function bodies", () => {
    const latestMortgage = exampleDocument("Mortgage Comparison");
    const revisionSixText = `loop = 0
Mortgage comparison:
// Define it once, then compare two loans.
mortgagePayment(principal, annual_rate, years) {
monthly_rate = annual_rate / 12
payments = years * 12
growth_factor = (1 + monthly_rate) ^ payments
principal * monthly_rate * growth_factor / (growth_factor - 1)
}

higher_rate_payment = mortgagePayment($750k, 6.25%, 30)
lower_rate_payment = mortgagePayment($750k, 5.75%, 30)
monthly_savings = higher_rate_payment - lower_rate_payment
savings_over_30_years = monthly_savings * 30 * 12
`;
    const revisionSixMortgage = {
      ...latestMortgage,
      data: {
        ...latestMortgage.data,
        text: revisionSixText,
        loopedLines: [10, 11, 12, 13],
        loopPeriod: "Scenario",
        isLoopEnabled: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(revisionSixMortgage, "6"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...revisionSixMortgage,
          data: { ...revisionSixMortgage.data, text: `${revisionSixText}// edited` }
        },
        "6"
      ),
      false
    );

    const oldMortgageStub: DocumentStub = {
      id: revisionSixMortgage.id,
      content: "pristine mortgage revision 6"
    };
    const upgradedMortgageStub: DocumentStub = {
      id: revisionSixMortgage.id,
      content: "bundled mortgage revision 7"
    };
    const result = seedGettingStartedDocuments<DocumentStub>(
      [existing, oldMortgageStub],
      "6",
      createStubs,
      undefined,
      (document) => document === oldMortgageStub ? upgradedMortgageStub : document
    );

    assert.deepEqual(result.documents, [
      existing,
      upgradedMortgageStub,
      ...stubsIntroducedAfter(6)
    ]);
    assert.deepEqual(
      result.addedDocumentIds,
      stubsIntroducedAfter(6).map((document) => document.id)
    );
    assert.deepEqual(result.upgradedDocumentIds, [oldMortgageStub.id]);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });

  test("recognizes the pristine revision-21 Functions sheet for the indentation upgrade", () => {
    const latestFunctions = historicalExampleDocument(
      "builtin-example-mortgage-comparison",
      "Functions"
    );
    const unindentedFunctionText = revisionTwentyThreeFunctionsText.replace(/^  /gm, "");
    const revisionTwentyOneFunctions = {
      ...latestFunctions,
      data: {
        ...latestFunctions.data,
        text: unindentedFunctionText,
        loopedLines: assignmentLineNumbers(
          unindentedFunctionText,
          ["pay_1", "pay_2", "spent_1", "spent_2", "saved"]
        )
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        revisionTwentyOneFunctions,
        "21"
      ),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...revisionTwentyOneFunctions,
          data: {
            ...revisionTwentyOneFunctions.data,
            text: `${unindentedFunctionText}// edited`
          }
        },
        "21"
      ),
      false
    );
  });

  test("recognizes the revision-23 two-space Functions sheet for the tab upgrade", () => {
    const latestFunctions = historicalExampleDocument(
      "builtin-example-mortgage-comparison",
      "Functions"
    );
    const revisionTwentyThreeFunctions = {
      ...latestFunctions,
      data: {
        ...latestFunctions.data,
        text: revisionTwentyThreeFunctionsText,
        loopedLines: assignmentLineNumbers(
          revisionTwentyThreeFunctionsText,
          ["pay_1", "pay_2", "spent_1", "spent_2", "saved"]
        )
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        revisionTwentyThreeFunctions,
        "23"
      ),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...revisionTwentyThreeFunctions,
          data: {
            ...revisionTwentyThreeFunctions.data,
            text: `${revisionTwentyThreeFunctionsText}// edited`
          }
        },
        "23"
      ),
      false
    );
  });

  test("recognizes the pristine revision-seven stock sheet for the live-data upgrade", () => {
    const latestStocks = exampleDocument("Stock Research Snapshot");
    const revisionSevenText = `loop = 0
Practice data:
// These illustrative values work without an internet connection.
sample_price = $215
sample_day_low = $210
sample_day_high = $218
sample_pe = 30.2
sample_market_cap = $3.2T
sample_day_range = sample_day_high - sample_day_low
sample_earnings_yield_percent = 100 / sample_pe

Try live Apple data:
// Uncomment these lines when online.
// live_price = $AAPL
// live_day_range = $AAPL.dayhigh - $AAPL.daylow
// live_market_cap = $AAPL.marketcap
// live_50_day_average = $AAPL.priceavg50
// live_pe = $AAPL.pe
`;
    const revisionSevenStocks = {
      ...latestStocks,
      data: {
        ...latestStocks.data,
        text: revisionSevenText,
        loopedLines: [3, 7, 8, 9],
        isLoopEnabled: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(revisionSevenStocks, "7"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...revisionSevenStocks,
          data: { ...revisionSevenStocks.data, text: `${revisionSevenText}// edited` }
        },
        "7"
      ),
      false
    );
  });

  test("recognizes pristine revision-eight sheets before the concise-name upgrade", () => {
    const previousExamples = [
      {
        title: "Retirement Growth",
        text: `loop = 20
Retirement growth:
// Year 0 is today. Later columns show future years.
starting_savings = $50,000
annual_return = 7%
balance = starting_savings * (1 + annual_return) ^ loop
previous_balance = loop.previous(balance)
interest_this_year = previous_balance * annual_return

Plan summary:
starting_balance = loop.first(balance)
ending_balance = loop.last(balance)
`,
        loopedLines: [5, 7, 11]
      },
      {
        title: "Stock Research Snapshot",
        text: `loop = 0
Live market data:
// Quotes refresh every minute while this sheet is open.
apple_price = $AAPL
apple_day_range = $AAPL.dayhigh - $AAPL.daylow
apple_market_cap = $AAPL.marketcap
apple_50_day_average = $AAPL.priceavg50
apple_pe = $AAPL.pe

Bitcoin:
bitcoin_price = $BTC
bitcoin_day_range = $BTC.dayhigh - $BTC.daylow
`,
        loopedLines: [3, 4, 5, 10]
      }
    ] as const;

    for (const previous of previousExamples) {
      const latest = exampleDocument(previous.title);
      const pristine = {
        ...latest,
        data: {
          ...latest.data,
          text: previous.text,
          loopedLines: [...previous.loopedLines],
          isLoopEnabled: true
        }
      };

      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(pristine, "8"),
        true
      );
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(
          {
            ...pristine,
            data: { ...pristine.data, text: `${previous.text}// edited` }
          },
          "8"
        ),
        false
      );
    }
  });

  test("recognizes pristine revision-nine sheets before comments are removed", () => {
    const previousExamples = [
      {
        title: "Retirement Growth",
        text: `loop = 20
Retirement growth:
// Year 0 is today. Later columns show future years.
savings = $50,000
return = 7%
balance = savings * (1 + return) ^ loop
prior_balance = loop.previous(balance)
interest = prior_balance * return

Plan summary:
start_balance = loop.first(balance)
end_balance = loop.last(balance)
`,
        loopedLines: [5, 7, 11]
      },
      {
        title: "Startup Runway",
        text: `loop = 12
Startup runway:
// The first column is month 0.
start_cash = $900k
revenue = $45k * (1 + 4%) ^ loop
expenses = $95k * (1 + 1.5%) ^ loop
burn = expenses - revenue
// Reusing a name carries the previous month forward.
total_burn = 0
total_burn = total_burn + burn
cash = start_cash - total_burn

Cash summary:
prior_cash = loop.previous(cash)
end_cash = loop.last(cash)
low_cash = loop.min(cash)
high_cash = loop.max(cash)
avg_cash = loop.avg(cash)
months_left = loop.last - loop
`,
        loopedLines: [6, 10, 14, 18]
      },
      {
        title: "Stock Research Snapshot",
        text: `loop = 0
Live market data:
// Quotes refresh every minute while this sheet is open.
apple = $AAPL
apple_range = $AAPL.dayhigh - $AAPL.daylow
apple_cap = $AAPL.marketcap
apple_avg = $AAPL.priceavg50
apple_pe = $AAPL.pe

Bitcoin:
bitcoin = $BTC
bitcoin_range = $BTC.dayhigh - $BTC.daylow
`,
        loopedLines: [3, 4, 5, 10]
      }
    ] as const;

    for (const previous of previousExamples) {
      const latest = exampleDocument(previous.title);
      const pristine = {
        ...latest,
        data: {
          ...latest.data,
          text: previous.text,
          loopedLines: [...previous.loopedLines],
          isLoopEnabled: true
        }
      };

      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(pristine, "9"),
        true
      );
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(
          {
            ...pristine,
            data: { ...pristine.data, text: `${previous.text}// edited` }
          },
          "9"
        ),
        false
      );
    }
  });

  test("removes the constant final balance from a pristine revision-ten sidebar", () => {
    const latest = revisionFifteenDocuments().find(
      (document) => document.title === "Retirement Growth"
    );
    assert.ok(latest);
    const revisionTenText = latest.data.text.replace(/^loop = 20\n\n/, "loop = 20\n");
    const revisionTen = {
      ...latest,
      data: {
        ...latest.data,
        text: revisionTenText,
        loopedLines: [4, 6, 10]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(revisionTen, "10"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...revisionTen,
          data: { ...revisionTen.data, loopedLines: [4, 10] }
        },
        "10"
      ),
      false
    );
  });

  test("removes the constant ending cash from pristine Startup sidebars", () => {
    const latest = exampleDocument("Startup Runway");
    const previousText = revisionFourteenRunwayText.replace(
      /^loop = 12\n\n/,
      "loop = 12\n"
    );
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [5, 8, 12, 16]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "10"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "11"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: { ...previous.data, loopedLines: [5, 12, 16] }
        },
        "11"
      ),
      false
    );
  });

  test("recognizes every pristine revision-twelve example for the spacing upgrade", () => {
    for (const latest of revisionFifteenDocuments()) {
      const template = revisionFifteenExampleTemplates.find(
        (candidate) => candidate.title === latest.title
      );
      assert.ok(template);
      const currentAtRevisionTwelve = latest.title === "Startup Runway"
        ? revisionFourteenRunwayText
        : latest.data.text;
      const previousText = currentAtRevisionTwelve.replace(/^(loop = \d+)\n\n/, "$1\n");
      const publishedVariableNames = latest.title === "Startup Runway"
        ? ["burn", "cash", "months_left"]
        : template.publishedVariableNames;
      const previous = {
        ...latest,
        data: {
          ...latest.data,
          text: previousText,
          loopedLines: assignmentLineNumbers(
            previousText,
            publishedVariableNames
          ),
          isLoopEnabled: true
        }
      };

      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(previous, "12"),
        true,
        `${latest.title} should be upgraded from revision twelve`
      );
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(
          {
            ...previous,
            data: { ...previous.data, text: `${previousText}// edited` }
          },
          "12"
        ),
        false
      );
    }
  });

  test("recognizes pristine revision-thirteen examples before loop-row visibility defaults", () => {
    for (const latest of revisionFifteenDocuments()) {
      const template = revisionFifteenExampleTemplates.find(
        (candidate) => candidate.title === latest.title
      );
      assert.ok(template);
      const previousText = latest.title === "Startup Runway"
        ? revisionFourteenRunwayText
        : latest.data.text;
      const publishedVariableNames = latest.title === "Startup Runway"
        ? ["burn", "cash", "months_left"]
        : template.publishedVariableNames;
      const previous = {
        ...latest,
        data: {
          ...latest.data,
          text: previousText,
          isLoopEnabled: true,
          loopedLines: assignmentLineNumbers(
            previousText,
            publishedVariableNames
          )
        }
      };

      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(previous, "13"),
        true,
        `${latest.title} should be upgraded from revision thirteen`
      );
    }
  });

  test("recognizes the pristine revision-fourteen runway before its cash model is simplified", () => {
    const latest = exampleDocument("Startup Runway");
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: revisionFourteenRunwayText,
        loopedLines: [6, 9, 17],
        isLoopEnabled: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "14"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: {
            ...previous.data,
            text: `${revisionFourteenRunwayText}// edited`
          }
        },
        "14"
      ),
      false
    );
  });

  test("recognizes every pristine revision-fifteen example for the feature-led gallery", () => {
    for (const previous of revisionFifteenDocuments()) {
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(previous, "15"),
        true,
        `${previous.title} should be upgraded from revision fifteen`
      );
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(
          {
            ...previous,
            data: { ...previous.data, text: `${previous.data.text}// edited` }
          },
          "15"
        ),
        false
      );
    }
  });

  test("recognizes pristine revision-sixteen examples before their responsibilities separate", () => {
    const latestMonthlySpending = exampleDocument("Monthly Spending");
    const previousMonthlySpending = {
      ...latestMonthlySpending,
      data: {
        ...latestMonthlySpending.data,
        text: revisionSeventeenMonthlySpendingText,
        loopedLines: [8, 15, 21, 27],
        isLoopEnabled: false
      }
    };
    const latestBurnRate = exampleDocument("Burn Rate");
    const previousBurnRate = {
      ...latestBurnRate,
      data: {
        ...latestBurnRate.data,
        text: revisionSixteenBurnRateText,
        loopedLines: [6, 9, 10]
      }
    };
    const latestAdvancedLoops = historicalExampleDocument(
      "builtin-example-product-launch-profit",
      "Advanced Loops"
    );
    const previousAdvancedLoops = {
      ...latestAdvancedLoops,
      data: {
        ...latestAdvancedLoops.data,
        text: revisionSixteenAdvancedLoopsText,
        loopedLines: [7, 13, 15, 18]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousMonthlySpending, "16"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousBurnRate, "16"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousAdvancedLoops, "16"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previousAdvancedLoops,
          data: {
            ...previousAdvancedLoops.data,
            text: `${revisionSixteenAdvancedLoopsText}// edited`
          }
        },
        "16"
      ),
      false
    );
  });

  test("does not mistake an edited revision-sixteen burn-rate sheet for the template", () => {
    const latest = exampleDocument("Burn Rate");
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: `${revisionSixteenBurnRateText}// edited`,
        loopedLines: [6, 9, 10]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "16"),
      false
    );
  });

  test("recognizes pristine revision-seventeen monthly spending for the loop upgrade", () => {
    const latest = exampleDocument("Monthly Spending");
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: revisionSeventeenMonthlySpendingText,
        loopedLines: [8, 15, 21, 27],
        isLoopEnabled: false
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "17"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: {
            ...previous.data,
            text: `${revisionSeventeenMonthlySpendingText}// edited`
          }
        },
        "17"
      ),
      false
    );
  });

  test("recognizes pristine revision-eighteen mortgage comparison for the monthly loop upgrade", () => {
    const latest = historicalExampleDocument(
      "builtin-example-mortgage-comparison",
      "Functions"
    );
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: revisionEighteenMortgageText,
        loopedLines: [9, 10, 11, 12],
        loopPeriod: "Scenario",
        isLoopEnabled: false
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "18"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: {
            ...previous.data,
            text: `${revisionEighteenMortgageText}// edited`
          }
        },
        "18"
      ),
      false
    );
  });

  test("moves pristine revision-twenty labels out of every example document", () => {
    const previousDocuments = revisionTwentyDocuments();
    const latestDocuments = createGettingStartedDocuments("2026-07-18T00:00:00.000Z");
    const latestById = new Map<string, (typeof latestDocuments)[number]>(
      latestDocuments.map((document) => [document.id, document])
    );

    for (const previous of previousDocuments) {
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(previous, "20"),
        true,
        `${previous.title} should be upgraded from revision twenty`
      );
    }

    const result = seedGettingStartedDocuments(
      previousDocuments,
      "20",
      () => latestDocuments,
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latestById.get(document.id) ?? document
          : document
    );

    assert.deepEqual(
      result.upgradedDocumentIds,
      previousDocuments.map((document) => document.id)
    );
    assert.ok(result.documents.every((document) => !/^\s*loop\s*=/im.test(document.data.text)));
    assert.equal(
      result.documents.some((document) => /^\s*(?:period|month)\s*=/im.test(document.data.text)),
      false
    );

    const editedChromeSettings = {
      ...previousDocuments[0],
      data: {
        ...previousDocuments[0].data,
        loopCount: previousDocuments[0].data.loopCount + 1
      }
    };
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(editedChromeSettings, "20"),
      false
    );
  });

  test("adds examples introduced after a revision-nineteen gallery", () => {
    const revisionNineteenIds = new Set<string>(
      gettingStartedExamples
        .filter((example) => example.introducedRevision <= 19)
        .map((example) => example.id)
    );
    const revisionNineteenDocuments = createStubs().filter((document) =>
      revisionNineteenIds.has(document.id)
    );
    const additions = stubsIntroducedAfter(19);

    const result = seedGettingStartedDocuments<DocumentStub>(
      revisionNineteenDocuments,
      "19",
      createStubs
    );

    assert.deepEqual(result.documents, [...revisionNineteenDocuments, ...additions]);
    assert.deepEqual(result.addedDocumentIds, additions.map((document) => document.id));
    assert.deepEqual(result.upgradedDocumentIds, []);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });

  test("upgrades the pristine revision-twenty-two burn-rate sheet to the 12-month runway", () => {
    const latest = exampleDocument("Startup Runway");
    const previous = {
      ...latest,
      title: "Burn Rate",
      data: {
        ...latest.data,
        title: "Burn Rate",
        text: revisionTwentyTwoBurnRateText,
        loopCount: 12,
        loopedLines: [4, 7, 8]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "22"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "22",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.deepEqual(result.documents, [latest]);
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: { ...previous.data, text: `${revisionTwentyTwoBurnRateText}// edited` }
        },
        "22"
      ),
      false
    );
  });

  test("upgrades the pristine revision-twenty-four stock sheet to My Portfolio", () => {
    const latest = exampleDocument("My Portfolio");
    const previous = {
      ...latest,
      title: "Live Stock Prices",
      data: {
        ...latest.data,
        title: "Live Stock Prices",
        text: revisionTwentyFourStockText,
        loopedLines: [1, 2, 3, 8]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "24"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "24",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.deepEqual(result.documents, [latest]);
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: { ...previous.data, text: `${revisionTwentyFourStockText}// edited` }
        },
        "24"
      ),
      false
    );
  });

  test("upgrades pristine revision-twenty-five sheets for the concept-first gallery", () => {
    const latestDocuments = allHistoricalExampleDocuments();
    const latestById = new Map(latestDocuments.map((document) => [document.id, document]));
    const previous = [
      {
        ...latestById.get("builtin-example-mortgage-comparison")!,
        title: "Functions",
        data: {
          ...latestById.get("builtin-example-mortgage-comparison")!.data,
          title: "Functions"
        }
      },
      {
        ...latestById.get("builtin-example-product-launch-profit")!,
        title: "Advanced Loops",
        data: {
          ...latestById.get("builtin-example-product-launch-profit")!.data,
          title: "Advanced Loops"
        }
      },
      {
        ...latestById.get("builtin-example-stock-research")!,
        title: "My Portfolio",
        data: {
          ...latestById.get("builtin-example-stock-research")!.data,
          title: "My Portfolio",
          text: revisionTwentyFivePortfolioText,
          loopPeriod: "Day",
          loopedLines: []
        }
      }
    ];

    for (const document of previous) {
      assert.equal(
        isPristinePreviousGettingStartedExampleDocument(document, "25"),
        true,
        `${document.title} should be upgraded from revision twenty-five`
      );
    }

    const result = seedGettingStartedDocuments(
      previous,
      "25",
      () => latestDocuments,
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latestById.get(document.id) ?? document
          : document
    );

    assert.deepEqual(
      result.upgradedDocumentIds,
      previous.map((document) => document.id)
    );
    assert.deepEqual(
      result.addedDocumentIds,
      gettingStartedExamples
        .filter((example) => example.introducedRevision > 25)
        .map((example) => example.id)
    );
  });

  test("restores Fancy Math over the historical Syntax sheet id", () => {
    const historicalSyntax: DocumentStub = {
      id: "builtin-example-syntax",
      content: "retired syntax guide"
    };
    const construction = createStubs().find(
      (document) => document.id === "builtin-example-construction-budget"
    );
    assert.ok(construction);

    const seeded = seedGettingStartedDocuments<DocumentStub>(
      [existing, historicalSyntax],
      "28",
      createStubs
    );
    assert.deepEqual(
      seeded.addedDocumentIds,
      stubsIntroducedAfter(28)
        .filter((document) => document.id !== historicalSyntax.id)
        .map((document) => document.id)
    );

    const restored = restoreGettingStartedExampleDocuments(
      seeded.documents,
      createStubs()
    );
    assert.equal(
      restored.some((document) => document.id === historicalSyntax.id),
      true
    );
    assert.equal(restored.some((document) => document.id === construction.id), true);
  });

  test("upgrades the pristine revision-twenty-nine compound-interest example", () => {
    const latest = exampleDocument("Compound Interest");
    const previousText = `Compound interest:
principal = $50,000
return = 7%
balance = principal * (1 + return) ^ loop
prior_balance = loop.previous(balance)
interest = prior_balance * return

Interest summary:
start_balance = loop.first(balance)
end_balance = loop.last(balance)
`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [3, 5]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "29"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "29",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
  });

  test("upgrades the pristine revision-thirty loops example with guidance", () => {
    const latest = exampleDocument("The Loop Keyword");
    const previousText = `Using loops:
starting_balance = $1,000
monthly_savings = $250
balance = starting_balance + monthly_savings * loop
`;
    const previous = {
      ...latest,
      title: "Using Loops",
      data: {
        ...latest.data,
        title: "Using Loops",
        text: previousText,
        loopedLines: [3]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "30"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "30",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.match(latest.data.text, /loop is the magic word/);
    assert.match(latest.data.text, /value turns purple/);
  });

  test("upgrades the pristine revision-thirty-one monthly-interest example", () => {
    const latest = exampleDocument("Functions");
    const previousText = `Monthly interest:
monthlyInterest(rate, loan) { loan * (rate / 12) }
loan_a = monthlyInterest(2.75%, $3M)
loan_b = monthlyInterest(3%, $2.5M)
difference = loan_b - loan_a
`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopCount: 0,
        loopPeriod: "Iteration",
        loopedLines: [2, 3, 4],
        isLoopEnabled: false,
        isLoopVariablePublished: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "31"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "31",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.data.loopCount, 59);
    assert.equal(latest.data.loopPeriod, "Month");
  });

  test("upgrades the pristine revision-thirty-three Functions sidebar labels", () => {
    const latest = exampleDocument("Functions");
    const previousText = `Monthly interest:
monthlyInterest(rate, loan) { loan * (rate / 12) }
loan_a_monthly = monthlyInterest(2.75%, $3M)
loan_b_monthly = monthlyInterest(3%, $2.5M)
loan_a_paid = loan_a_monthly * (loop + 1)
loan_b_paid = loan_b_monthly * (loop + 1)
difference = loan_a_paid - loan_b_paid
`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [2, 3, 4, 5, 6],
        isLoopVariablePublished: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "33"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "33",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.deepEqual(latest.data.loopedLines, [4, 5, 6]);
    assert.equal(latest.data.isLoopVariablePublished, false);
  });

  test("upgrades the pristine revision-thirty-seven Syntax guide to Fancy Math", () => {
    const latest = exampleDocument("Fancy Math");
    const previousText = `Syntax:
Numbers:
currency = $24
percent = 20%
large_number = 2.5M
Arithmetic:
grouped = (2 + 3) * 4 / 2
power = 3 ^ 2
pi_value = pi
Built-in math:
rounded_down = floor(3.9)
rounded_up = ceil(3.1)
logarithm = log(1M)
sine = sin(pi / 2)
cosine = cos(0)
tangent = tan(0)
Section average:
low = 10
high = 20
average = avgsection
Section minimum:
small = 18
medium = 27
minimum = minsection
Section maximum:
medium = 27
large = 32
maximum = maxsection`;
    const previous = {
      ...latest,
      title: "Syntax",
      data: {
        ...latest.data,
        title: "Syntax",
        text: previousText,
        loopedLines: [10, 11, 12, 13, 14, 15, 19, 23, 27],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "37"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "37",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.match(latest.data.text, /^absolute = abs\(-42\)$/m);
    assert.match(latest.data.text, /^direction = sign\(-42\)$/m);
  });

  test("renames the pristine revision-thirty-eight Syntax guide to Fancy Math", () => {
    const latest = exampleDocument("Fancy Math");
    const previousText = `Syntax:
Numbers:
currency = $24
percent = 20%
large_number = 2.5M
Arithmetic:
grouped = (2 + 3) * 4 / 2
power = 3 ^ 2
pi_value = pi
Built-in math:
absolute = abs(-42)
root = sqrt(81)
rounded = round(3.7)
truncated = trunc(3.7)
direction = sign(-42)
rounded_down = floor(3.9)
rounded_up = ceil(3.1)
logarithm = log(1M)
sine = sin(pi / 2)
cosine = cos(0)
tangent = tan(0)
Section average:
low = 10
high = 20
average = avgsection
Section minimum:
small = 18
medium = 27
minimum = minsection
Section maximum:
medium = 27
large = 32
maximum = maxsection`;
    const previous = {
      ...latest,
      title: "Syntax",
      data: {
        ...latest.data,
        title: "Syntax",
        text: previousText,
        loopedLines: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 28, 32],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "38"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "38",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.title, "Fancy Math");
    assert.doesNotMatch(latest.data.text, /Syntax:/);
    assert.match(latest.data.text, /^tangent = tan\(pi \/ 4\)$/m);
  });

  test("removes subheaders from the pristine revision-thirty-nine Fancy Math guide", () => {
    const latest = exampleDocument("Fancy Math");
    const previousText = `Fancy math:
Arithmetic:
grouped = (2 + 3) * 4 / 2
power = 3 ^ 2
pi_value = pi
Number functions:
absolute = abs(-42)
root = sqrt(81)
rounded = round(3.7)
truncated = trunc(3.7)
direction = sign(-42)
rounded_down = floor(3.9)
rounded_up = ceil(3.1)
logarithm = log(1M)
Trigonometry:
sine = sin(pi / 2)
cosine = cos(pi)
tangent = tan(pi / 4)`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "39"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "39",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.deepEqual(
      latest.data.text
        .split("\n")
        .filter((line) => line.endsWith(":")),
      ["Fancy math:"]
    );
  });

  test("stops publishing loop in the pristine revision-forty Fancy Math guide", () => {
    const latest = exampleDocument("Fancy Math");
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        isLoopVariablePublished: true,
        isResultsHidden: true,
        loopedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "40"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "40",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.data.isLoopVariablePublished, false);
  });

  test("unpublishes every result in the pristine revision-fifty-one Fancy Math guide", () => {
    const latest = exampleDocument("Fancy Math");
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        loopedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "51"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "51",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.deepEqual(latest.data.loopedLines, []);
  });

  test("upgrades the pristine revision-forty-one Construction Budget", () => {
    const latest = exampleDocument("Construction Budget");
    const previousText = `Construction:
---
Fees:
lot = 3.5M
interior_designer = 300k
architect = 200k
permits = 50k
engineering = 120k
furniture = 1.5M
fees = sumsection
---
Prep Costs:
demo = 250k
excavation = 150k
soils = 50k
prep = sumsection
---
Build Costs:
main_ppsf = $1100
secondary_ppsf = $400
main_house = 5000 * main_ppsf
garage = 500 * secondary_ppsf
build = sumsection
---
Exterior Costs:
landscaping = 500k
hardscaping = 500k
exterior = sumsection
---
total = fees + prep + build + exterior`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [9, 15, 22, 27, 29],
        isLoopVariablePublished: true,
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "41"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "41",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.data.isLoopVariablePublished, false);
    assert.match(latest.data.text, /^Hard Costs: \/\/ build costs$/m);
    assert.match(latest.data.text, /^HARD = sumsection$/m);
    assert.match(latest.data.text, /^TOTAL = LOT \+ SOFT \+ HARD \+ FFE \+ CONTINGENCY$/m);
  });

  test("upgrades the pristine revision-fifty Construction Budget", () => {
    const latest = exampleDocument("Construction Budget");
    const previousText = `Construction:
---
Prep Costs:
demo = 250k
excavation = 150k
soils = 50k
prep = sumsection
---
Build Costs:
main_ppsf = $1100
secondary_ppsf = $400
main_house = 5000 * main_ppsf
garage = 500 * secondary_ppsf
hardscaping = 500k
build = sumsection
---
Landscaping:
landscaping = 500k
---
Fees:
lot = 3.5M
interior_designer = 300k
architect = build * 7%
permits = 50k
engineering = 120k
furniture = 1.5M
fees = sumsection
---
total = prep + build + landscaping + fees`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [6, 14, 17, 26, 28],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "50"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(
        {
          ...previous,
          data: { ...previous.data, text: `${previousText}\n// edited` }
        },
        "50"
      ),
      false
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "50",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.deepEqual(latest.data.loopedLines, [2, 11, 21, 28, 31, 33]);
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("upgrades the pristine revision-forty-two introductory examples", () => {
    const latestDocuments = createGettingStartedDocuments();
    const latestMath = latestDocuments.find(
      (document) => document.id === "builtin-example-math-with-variables"
    );
    const latestSum = latestDocuments.find(
      (document) => document.id === "builtin-example-section-total"
    );
    assert.ok(latestMath);
    assert.ok(latestSum);

    const previousMath = {
      ...latestMath,
      data: {
        ...latestMath.data,
        text: `Math with variables:
price = $20
quantity = 3
total = price * quantity`,
        loopCount: 0,
        loopPeriod: "None",
        loopedLines: [3],
        isResultsHidden: true
      }
    };
    const previousSum = {
      ...latestSum,
      data: {
        ...latestSum.data,
        text: `Monthly bills:
rent = $900
car = $600
groceries = $450
total = sumsection`,
        loopedLines: [4],
        isResultsHidden: true
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousMath, "42"),
      true
    );
    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previousSum, "42"),
      true
    );

    const latestById = new Map(
      latestDocuments.map((document) => [document.id, document])
    );
    const result = seedGettingStartedDocuments(
      [previousMath, previousSum],
      "42",
      () => latestDocuments,
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? (latestById.get(document.id) ?? document)
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latestMath.id, latestSum.id]);
    assert.strictEqual(result.documents[0], latestMath);
    assert.strictEqual(result.documents[1], latestSum);
    assert.equal(latestMath.data.loopCount, 11);
    assert.match(latestMath.data.text, /^year_to_date = monthly_bills \* \(loop \+ 1\)$/m);
    assert.match(latestSum.data.text, /^Weekend trip:$/m);
  });

  test("adds the amortization template to a revision-forty-three gallery", () => {
    const amortization = createStubs().find(
      (document) => document.id === "builtin-example-amortization-schedule"
    );
    assert.ok(amortization);
    const previousDocuments = createStubs().filter(
      (document) => document.id !== amortization.id
    );

    const result = seedGettingStartedDocuments(
      previousDocuments,
      "43",
      createStubs
    );

    assert.deepEqual(result.addedDocumentIds, [amortization.id]);
    assert.deepEqual(result.documents.at(-1), amortization);
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("adds the stock portfolio template to a revision-fifty-two gallery", () => {
    const portfolio = createStubs().find(
      (document) => document.id === "builtin-example-stock-portfolio"
    );
    assert.ok(portfolio);
    const previousDocuments = createStubs().filter(
      (document) => document.id !== portfolio.id
    );

    const result = seedGettingStartedDocuments(
      previousDocuments,
      "52",
      createStubs
    );

    assert.deepEqual(result.addedDocumentIds, [portfolio.id]);
    assert.deepEqual(result.documents.at(-1), portfolio);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });

  test("upgrades the pristine monthly amortization template to yearly summaries", () => {
    const latest = exampleDocument("Amortization Schedule");
    const previousText = `Mortgage amortization:
loan = $400k
annual_rate = 6.5%
years = 30
monthly_rate = annual_rate / 12
payment_count = years * 12
growth = (1 + monthly_rate) ^ payment_count
payment = loan * monthly_rate * growth / (growth - 1)

Payment schedule:
payment_number = loop + 1
balance_before = loan * (1 + monthly_rate) ^ loop - payment * ((1 + monthly_rate) ^ loop - 1) / monthly_rate
interest = balance_before * monthly_rate
principal_paid = payment - interest
remaining_balance = balance_before - principal_paid
interest_paid = payment * (loop + 1) - loan + remaining_balance`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopCount: 359,
        loopPeriod: "Month",
        loopedLines: [7, 10, 12, 13, 14, 15]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "44"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "44",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.data.loopCount, 29);
    assert.equal(latest.data.loopPeriod, "Year");
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("upgrades the yearly amortization template to use a balance helper", () => {
    const latest = exampleDocument("Amortization Schedule");
    const previousText = `Mortgage amortization:
loan = $400k
annual_rate = 6.5%
years = 30
monthly_rate = annual_rate / 12
payment_count = years * 12
growth = (1 + monthly_rate) ^ payment_count
monthly_payment = loan * monthly_rate * growth / (growth - 1)

Yearly schedule:
month_start = loop * 12
month_end = (loop + 1) * 12
balance_before = loan * (1 + monthly_rate) ^ month_start - monthly_payment * ((1 + monthly_rate) ^ month_start - 1) / monthly_rate
remaining_balance = loan * (1 + monthly_rate) ^ month_end - monthly_payment * ((1 + monthly_rate) ^ month_end - 1) / monthly_rate
annual_payment = monthly_payment * 12
principal_paid = balance_before - remaining_balance
interest_paid = annual_payment - principal_paid
total_interest_paid = monthly_payment * month_end - loan + remaining_balance`;
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: previousText,
        loopedLines: [13, 14, 15, 16, 17]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "45"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "45",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.match(latest.data.text, /balanceAfterMonths\(principal, rate, payment, months\)/);
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("upgrades the pristine revision-forty-six Sum Section guide", () => {
    const latest = createGettingStartedDocuments().find(
      (document) => document.id === "builtin-example-section-total"
    );
    assert.ok(latest);
    const previous = {
      ...latest,
      data: {
        ...latest.data,
        text: `Weekend trip:
hotel = $600
train = $180
tickets = $120
total = sumsection`,
        loopedLines: [4]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "46"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "46",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.deepEqual(latest.data.loopedLines, [4, 10]);
    assert.match(latest.data.text, /^Daily temperatures:$/m);
    assert.match(latest.data.text, /^average = avgsection$/m);
    assert.match(latest.data.text, /stopping at a blank row/);
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("renames and expands the pristine revision-forty-seven live-prices guide", () => {
    const latest = createGettingStartedDocuments().find(
      (document) => document.id === "builtin-example-market-details"
    );
    assert.ok(latest);
    const previous = {
      ...latest,
      title: "Live Prices",
      data: {
        ...latest.data,
        title: "Live Prices",
        text: `Price comparison:
apple = $AAPL
microsoft = $MSFT
difference = microsoft - apple`,
        loopedLines: [1, 2, 3]
      }
    };

    assert.equal(
      isPristinePreviousGettingStartedExampleDocument(previous, "47"),
      true
    );

    const result = seedGettingStartedDocuments(
      [previous],
      "47",
      () => [latest],
      undefined,
      (document, revision) =>
        isPristinePreviousGettingStartedExampleDocument(document, revision)
          ? latest
          : document
    );

    assert.deepEqual(result.upgradedDocumentIds, [latest.id]);
    assert.strictEqual(result.documents[0], latest);
    assert.equal(latest.title, "Live Stock Prices");
    assert.match(latest.data.text, /query any ticker symbol/);
    assert.equal(result.templateRevisionToPersist, String(GETTING_STARTED_TEMPLATE_REVISION));
  });

  test("makes deletion sticky after revision three and never downgrades a future marker", () => {
    const afterDeletion = [existing];
    const current = seedGettingStartedDocuments<DocumentStub>(
      afterDeletion,
      String(GETTING_STARTED_TEMPLATE_REVISION),
      () => {
        throw new Error("Deleted examples must not be recreated");
      }
    );
    assert.strictEqual(current.documents, afterDeletion);
    assert.deepEqual(current.addedDocumentIds, []);
    assert.equal(current.templateRevisionToPersist, undefined);

    const future = seedGettingStartedDocuments<DocumentStub>(afterDeletion, "99", () => {
      throw new Error("A newer gallery must not be changed by an older app");
    });
    assert.strictEqual(future.documents, afterDeletion);
    assert.equal(future.templateRevisionToPersist, undefined);
  });

  test("restores edited and missing examples while preserving owned sheets", () => {
    const canonicalExamples = createStubs();
    const editedExample: DocumentStub = {
      id: canonicalExamples[4].id,
      content: "edited during this session"
    };
    const duplicate: DocumentStub = {
      id: "owned-functions-copy",
      content: editedExample.content
    };

    const restored = restoreGettingStartedExampleDocuments(
      [
        existing,
        editedExample,
        duplicate,
        { ...editedExample },
        ...retiredGettingStartedExampleIds.map((id) => ({
          id,
          content: "retired bundled example"
        }))
      ],
      canonicalExamples
    );

    assert.strictEqual(restored[0], existing);
    assert.strictEqual(restored.find((document) => document.id === duplicate.id), duplicate);
    assert.strictEqual(
      restored.find((document) => document.id === editedExample.id),
      canonicalExamples[4]
    );
    assert.equal(
      restored.filter((document) => document.id === editedExample.id).length,
      1
    );
    assert.equal(
      restored.some((document) =>
        retiredGettingStartedExampleIds.some((id) => id === document.id)
      ),
      false
    );
    assert.deepEqual(
      new Set(restored.map((document) => document.id)),
      new Set([existing.id, duplicate.id, ...canonicalExamples.map((document) => document.id)])
    );
  });

  test("restoring canonical examples is idempotent", () => {
    const canonicalExamples = createStubs();
    const firstRestore = restoreGettingStartedExampleDocuments(
      [existing],
      canonicalExamples
    );
    const secondRestore = restoreGettingStartedExampleDocuments(
      firstRestore,
      canonicalExamples
    );

    assert.deepEqual(secondRestore, firstRestore);
    assert.strictEqual(secondRestore[0], existing);
  });

  test("adds the new gallery after an old tutorial was previously deleted", () => {
    const result = seedGettingStartedDocuments<DocumentStub>([existing], "2", createStubs);

    assert.strictEqual(result.documents[0], existing);
    assert.deepEqual(result.documents.slice(1), createStubs());
    assert.equal(result.removedLegacyDocument, false);
    assert.equal(
      result.templateRevisionToPersist,
      String(GETTING_STARTED_TEMPLATE_REVISION)
    );
  });
});
