import { visibleLooperText, type LooperDocumentData } from "./looperEngine.ts";

export const LEGACY_GETTING_STARTED_DOCUMENT_ID = "builtin-getting-started";
export const GETTING_STARTED_TEMPLATE_REVISION = 52;
export const GETTING_STARTED_TEMPLATE_REVISION_STORAGE_KEY =
  "looper.gettingStartedTemplateRevision";

const legacyTemplateFingerprints = new Map<string, string>([
  ["1", "f65744cb"],
  ["2", "11d72944"]
]);

const legacyPublishedVariableNames = [
  "loop",
  "balance",
  "growth_this_year",
  "weekly_miles",
  "miles_to_date",
  "monthly_bills"
] as const;

export type GettingStartedExampleDefinition = {
  id: string;
  section: "learn" | "template";
  title: string;
  subtitle: string;
  text: string;
  loopCount: number;
  loopPeriod: string;
  isLoopEnabled: boolean;
  isLoopVariablePublished?: boolean;
  isSidebarOpenByDefault: boolean;
  publishedVariableNames: readonly string[];
  introducedRevision: number;
};

export const gettingStartedExamples = [
  {
    id: "builtin-example-using-loops",
    section: "learn",
    title: "The Loop Keyword",
    subtitle: "Do simple math across five months",
    loopCount: 4,
    loopPeriod: "Month",
    isLoopEnabled: true,
    isSidebarOpenByDefault: true,
    publishedVariableNames: ["balance"],
    introducedRevision: 26,
    text: `The loop keyword:
starting_balance = $1,000
monthly_savings = $250
balance = starting_balance + monthly_savings * loop
// loop is the magic word that repeats a calculation.
// It starts at 0 and increases by 1 each time.
// When a value turns purple, it holds multiple values—one for each loop.`
  },
  {
    id: "builtin-example-math-with-variables",
    section: "learn",
    title: "Math with Variables",
    subtitle: "Use variables and loop to total a year",
    loopCount: 11,
    loopPeriod: "Month",
    isLoopEnabled: true,
    isSidebarOpenByDefault: true,
    publishedVariableNames: ["monthly_bills", "year_to_date"],
    introducedRevision: 26,
    text: `A year of bills:
rent = $1,800
utilities = $200
internet = $75
monthly_bills = rent + utilities + internet
year_to_date = monthly_bills * (loop + 1)`
  },
  {
    id: "builtin-example-global-variables",
    section: "learn",
    title: "Global Variables",
    subtitle: "Share one named value across your sheets",
    loopCount: 0,
    loopPeriod: "None",
    isLoopEnabled: false,
    isLoopVariablePublished: false,
    isSidebarOpenByDefault: false,
    publishedVariableNames: ["@example_budget"],
    introducedRevision: 49,
    text: `A budget shared across sheets:
construction = $8M
design = $500k
contingency = 10%
@example_budget = (construction + design) * (1 + contingency)

// Start a name with @ to make it global.
// Use @example_budget in any of your other sheets.
// A global can be defined only once across your sheets.
// Click a global reference to jump back to its definition.`
  },
  {
    id: "builtin-example-market-details",
    section: "learn",
    title: "Live Stock Prices",
    subtitle: "Use current prices in simple calculations",
    loopCount: 0,
    loopPeriod: "None",
    isLoopEnabled: false,
    isSidebarOpenByDefault: false,
    publishedVariableNames: ["apple", "microsoft", "difference"],
    introducedRevision: 26,
    text: `Price comparison:
apple = $AAPL
microsoft = $MSFT
difference = microsoft - apple

// You can query any ticker symbol to get its current stock price.
// Type $ before the ticker, like $AAPL or $MSFT.`
  },
  {
    id: "builtin-example-section-total",
    section: "learn",
    title: "Sum Section",
    subtitle: "Add or average values in separate sections",
    loopCount: 0,
    loopPeriod: "None",
    isLoopEnabled: false,
    isSidebarOpenByDefault: false,
    publishedVariableNames: ["total", "average"],
    introducedRevision: 26,
    text: `Weekend trip:
hotel = $600
train = $180
tickets = $120
total = sumsection

Daily temperatures:
friday = 72
saturday = 78
sunday = 75
average = avgsection

// sumsection adds the values above it, stopping at a blank row.
// avgsection follows the same rule, but returns their average.`
  },
  {
    id: "builtin-example-functions",
    section: "learn",
    title: "Functions",
    subtitle: "Compare five years of interest costs",
    loopCount: 59,
    loopPeriod: "Month",
    isLoopEnabled: true,
    isLoopVariablePublished: false,
    isSidebarOpenByDefault: true,
    publishedVariableNames: [
      "loan_a_lifetime_paid",
      "loan_b_lifetime_paid",
      "lifetime_delta"
    ],
    introducedRevision: 26,
    text: `Monthly interest:
monthlyInterest(rate, loan) { loan * (rate / 12) }
loan_a_monthly = monthlyInterest(2.75%, $3M)
loan_b_monthly = monthlyInterest(3%, $2.5M)
loan_a_lifetime_paid = loan_a_monthly * (loop + 1)
loan_b_lifetime_paid = loan_b_monthly * (loop + 1)
lifetime_delta = loan_a_lifetime_paid - loan_b_lifetime_paid`
  },
  {
    id: "builtin-example-advanced-loops",
    section: "learn",
    title: "Advanced Loops",
    subtitle: "Summarize values across every loop",
    loopCount: 4,
    loopPeriod: "Year",
    isLoopEnabled: true,
    isSidebarOpenByDefault: true,
    publishedVariableNames: [
      "balance",
      "previous",
      "starting",
      "ending",
      "minimum",
      "maximum",
      "average"
    ],
    introducedRevision: 26,
    text: `Advanced loops:
balance = $10k * 1.1 ^ loop
previous = loop.previous(balance)
starting = loop.first(balance)
ending = loop.last(balance)
minimum = loop.min(balance)
maximum = loop.max(balance)
average = loop.avg(balance)`
  },
  {
    id: "builtin-example-syntax",
    section: "learn",
    title: "Fancy Math",
    subtitle: "Try powers, pi, roots, and trig",
    loopCount: 0,
    loopPeriod: "None",
    isLoopEnabled: false,
    isLoopVariablePublished: false,
    isSidebarOpenByDefault: false,
    publishedVariableNames: [],
    introducedRevision: 37,
    text: `Fancy math:
grouped = (2 + 3) * 4 / 2
power = 3 ^ 2
pi_value = pi
absolute = abs(-42)
root = sqrt(81)
rounded = round(3.7)
truncated = trunc(3.7)
direction = sign(-42)
rounded_down = floor(3.9)
rounded_up = ceil(3.1)
logarithm = log(1M)
sine = sin(pi / 2)
cosine = cos(pi)
tangent = tan(pi / 4)`
  },
  {
    id: "builtin-example-retirement-growth",
    section: "template",
    title: "Compound Interest",
    subtitle: "See savings compound year by year",
    loopCount: 20,
    loopPeriod: "Year",
    isLoopEnabled: true,
    isSidebarOpenByDefault: true,
    publishedVariableNames: ["balance", "annual_interest"],
    introducedRevision: 3,
    text: `Compound interest:
principal = $5M
return = 7%
balance = principal * (1 + return) ^ loop
prior_balance = loop.previous(balance)
annual_interest = prior_balance * return`
  },
  {
    id: "builtin-example-startup-runway",
    section: "template",
    title: "Startup Runway",
    subtitle: "Follow cash month by month for one year",
    loopCount: 11,
    loopPeriod: "Month",
    isLoopEnabled: true,
    isSidebarOpenByDefault: true,
    publishedVariableNames: [
      "starting_balance",
      "revenue",
      "expenses",
      "ending_balance"
    ],
    introducedRevision: 3,
    text: `Startup runway:
cash_in_bank = $600k
monthly_revenue = $25k
monthly_expenses = $75k
monthly_burn = monthly_expenses - monthly_revenue

Cash by month:
starting_balance = cash_in_bank - monthly_burn * loop
revenue = monthly_revenue
expenses = monthly_expenses
ending_balance = starting_balance + revenue - expenses`
  },
  {
    id: "builtin-example-amortization-schedule",
    section: "template",
    title: "Amortization Schedule",
    subtitle: "See 30 years of mortgage payments at a glance",
    loopCount: 29,
    loopPeriod: "Year",
    isLoopEnabled: true,
    isLoopVariablePublished: false,
    isSidebarOpenByDefault: true,
    publishedVariableNames: [
      "annual_payment",
      "interest_paid",
      "principal_paid",
      "remaining_balance",
      "total_interest_paid"
    ],
    introducedRevision: 44,
    text: `Mortgage amortization:
loan = $400k
annual_rate = 6.5%
years = 30
monthly_rate = annual_rate / 12
payment_count = years * 12
growth = (1 + monthly_rate) ^ payment_count
monthly_payment = loan * monthly_rate * growth / (growth - 1)

balanceAfterMonths(principal, rate, payment, months) {
	month_growth = (1 + rate) ^ months
	principal * month_growth - payment * (month_growth - 1) / rate
}

Yearly schedule:
month_start = loop * 12
month_end = (loop + 1) * 12
balance_before = balanceAfterMonths(loan, monthly_rate, monthly_payment, month_start)
remaining_balance = balanceAfterMonths(loan, monthly_rate, monthly_payment, month_end)
annual_payment = monthly_payment * 12
principal_paid = balance_before - remaining_balance
interest_paid = annual_payment - principal_paid
total_interest_paid = monthly_payment * month_end - loan + remaining_balance`
  },
  {
    id: "builtin-example-construction-budget",
    section: "template",
    title: "Construction Budget",
    subtitle: "Total a home from lot to landscaping",
    loopCount: 0,
    loopPeriod: "None",
    isLoopEnabled: false,
    isLoopVariablePublished: false,
    isSidebarOpenByDefault: false,
    publishedVariableNames: ["LOT", "HARD", "SOFT", "FFE", "CONTINGENCY", "TOTAL"],
    introducedRevision: 29,
    text: `Construction:
---
LOT = 3.5M

Hard Costs: // build costs
house = 5000 * $1100 //$1,125 ppsf * 5000 sf
garage = 500 * $600 //$400 ppsf * 400 sf
demo = $200k
retaiingwall = $300k
pool = $200k
landscaping = $300k
HARD = sumsection

Soft Costs: // fees
architect = HARD * 6%
interior = $300k
structural = $50k
civil = $20k
expeditor = $20k
survey = $10k
soils = $10k
SOFT = sumsection

FFE Costs: // furniture, fixtures, equipment
furniture = $1.75M
appliances = $30k
security = $15k
av = $10k
FFE = sumsection

Contingency:
CONTINGENCY = (SOFT + HARD + FFE) * 15%
---
TOTAL = LOT + SOFT + HARD + FFE + CONTINGENCY`
  }
] as const satisfies readonly GettingStartedExampleDefinition[];

export type GettingStartedExampleId = (typeof gettingStartedExamples)[number]["id"];

export const retiredGettingStartedExampleIds = [
  "builtin-example-household-budget",
  "builtin-example-mortgage-comparison",
  "builtin-example-product-launch-profit",
  "builtin-example-stock-research",
  "builtin-example-section-average",
  "builtin-example-section-minimum",
  "builtin-example-section-maximum"
] as const;

type HistoricalGettingStartedExampleId =
  | GettingStartedExampleId
  | (typeof retiredGettingStartedExampleIds)[number];

const retiredGettingStartedExampleIdSet = new Set<string>(
  retiredGettingStartedExampleIds
);

type PreviousExampleTemplate = {
  fingerprint: string;
  isLoopEnabled?: boolean;
  isLoopVariablePublished?: boolean;
  isResultsHidden?: boolean;
  loopCount?: number;
  loopedLines: readonly number[];
  loopPeriod: string;
  title: string;
};

const sharedPreviousExampleTemplates: ReadonlyArray<
  readonly [HistoricalGettingStartedExampleId, PreviousExampleTemplate]
> = [
  [
    "builtin-example-retirement-growth",
    {
      fingerprint: "b8797890",
      loopedLines: [8, 10, 14],
      loopPeriod: "Year",
      title: "Retirement Growth"
    }
  ],
  [
    "builtin-example-mortgage-comparison",
    {
      fingerprint: "827f4b31",
      loopedLines: [10, 11, 12, 13],
      loopPeriod: "Scenario",
      title: "Mortgage Comparison"
    }
  ],
  [
    "builtin-example-household-budget",
    {
      fingerprint: "8f0e8558",
      loopedLines: [8, 15, 21, 27],
      loopPeriod: "Month",
      title: "Household Budget"
    }
  ],
  [
    "builtin-example-product-launch-profit",
    {
      fingerprint: "fa38ccab",
      loopedLines: [7, 9, 13, 14],
      loopPeriod: "Month",
      title: "Product Launch Profit"
    }
  ],
  [
    "builtin-example-stock-research",
    {
      fingerprint: "97bc3b9e",
      loopedLines: [3, 8, 9, 10],
      loopPeriod: "Day",
      title: "Stock Research Snapshot"
    }
  ]
];

function previousExampleTemplateMap(
  startupRunwayTemplate: PreviousExampleTemplate
): Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate> {
  const entries: Array<[HistoricalGettingStartedExampleId, PreviousExampleTemplate]> =
    sharedPreviousExampleTemplates.map(([id, template]) => [id, template]);
  entries.push(["builtin-example-startup-runway", startupRunwayTemplate]);
  return new Map(entries);
}

const previousExampleTemplates = new Map<
  string,
  Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>
>([
  [
    "3",
    previousExampleTemplateMap({
      fingerprint: "c782ad6e",
      loopedLines: [6, 7, 8, 23],
      loopPeriod: "Month",
      title: "Startup Runway"
    })
  ],
  [
    "4",
    previousExampleTemplateMap({
      fingerprint: "afe71a8d",
      loopedLines: [6, 10, 11, 26],
      loopPeriod: "Month",
      title: "Startup Runway"
    })
  ],
  [
    "5",
    previousExampleTemplateMap({
      fingerprint: "0fc40b97",
      loopedLines: [6, 10, 11, 26],
      loopPeriod: "Month",
      title: "Startup Runway"
    })
  ],
  [
    "6",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "8175541d",
          loopedLines: [5, 7, 11],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "a6ffa94e",
          loopedLines: [10, 11, 12, 13],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "bd555f7f",
          loopedLines: [6, 10, 14, 18],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "bf7fab9c",
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "1e5a08db",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "4dc49029",
          loopedLines: [3, 7, 8, 9],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "7",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "8175541d",
          loopedLines: [5, 7, 11],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "d8848376",
          loopedLines: [10, 11, 12, 13],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "bd555f7f",
          loopedLines: [6, 10, 14, 18],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "bf7fab9c",
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "1e5a08db",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "4dc49029",
          loopedLines: [3, 7, 8, 9],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "8",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "8175541d",
          loopedLines: [5, 7, 11],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "d8848376",
          loopedLines: [10, 11, 12, 13],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "bd555f7f",
          loopedLines: [6, 10, 14, 18],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "bf7fab9c",
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "1e5a08db",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "0e4d34b5",
          loopedLines: [3, 4, 5, 10],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "9",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "2c28ff9e",
          loopedLines: [5, 7, 11],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "4a0ebca3",
          loopedLines: [10, 11, 12, 13],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "6e82dfbb",
          loopedLines: [6, 10, 14, 18],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "3e3d266b",
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "f3153bb8",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "f4e06142",
          loopedLines: [3, 4, 5, 10],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "10",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "83bdc011",
          loopedLines: [4, 6, 10],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "cbabcaad",
          loopedLines: [5, 8, 12, 16],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ]
    ])
  ],
  [
    "11",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "cbabcaad",
          loopedLines: [5, 8, 12, 16],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ]
    ])
  ],
  [
    "12",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "83bdc011",
          loopedLines: [4, 6],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "172cce27",
          loopedLines: [9, 10, 11, 12],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "cbabcaad",
          loopedLines: [5, 8, 16],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "3e3d266b",
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "af835c0b",
          loopedLines: [4, 6, 10, 11],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "d6ac278d",
          loopedLines: [2, 3, 4, 9],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "13",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "63e0c1bb",
          loopedLines: [5, 7],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "de0821b9",
          loopedLines: [10, 11, 12, 13],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "3345131d",
          loopedLines: [6, 9, 17],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "c949da95",
          loopedLines: [9, 16, 22, 28],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "27fd2a5b",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "c0d959ef",
          loopedLines: [3, 4, 5, 10],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "14",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "3345131d",
          loopedLines: [6, 9, 17],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ]
    ])
  ],
  [
    "15",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "63e0c1bb",
          loopedLines: [5, 7],
          loopPeriod: "Year",
          title: "Retirement Growth"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "de0821b9",
          isLoopEnabled: false,
          loopedLines: [9, 10, 11, 12],
          loopPeriod: "Scenario",
          title: "Mortgage Comparison"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "d9a8f594",
          loopedLines: [6, 9, 10],
          loopPeriod: "Month",
          title: "Startup Runway"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "c949da95",
          isLoopEnabled: false,
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Household Budget"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "27fd2a5b",
          loopedLines: [5, 7, 11, 12],
          loopPeriod: "Month",
          title: "Product Launch Profit"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "c0d959ef",
          isLoopEnabled: false,
          loopedLines: [2, 3, 4, 9],
          loopPeriod: "Day",
          title: "Stock Research Snapshot"
        }
      ]
    ])
  ],
  [
    "16",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-household-budget",
        {
          fingerprint: "ebe3463f",
          isLoopEnabled: false,
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Monthly Spending"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "2bd53684",
          loopedLines: [6, 9, 10],
          loopPeriod: "Month",
          title: "Burn Rate"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "dc489999",
          loopedLines: [7, 13, 15, 18],
          loopPeriod: "Month",
          title: "Advanced Loops"
        }
      ]
    ])
  ],
  [
    "17",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-household-budget",
        {
          fingerprint: "ebe3463f",
          isLoopEnabled: false,
          loopedLines: [8, 15, 21, 27],
          loopPeriod: "Month",
          title: "Monthly Spending"
        }
      ]
    ])
  ],
  [
    "18",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "659caefe",
          isLoopEnabled: false,
          loopedLines: [9, 10, 11, 12],
          loopPeriod: "Scenario",
          title: "Functions"
        }
      ]
    ])
  ],
  [
    "20",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "0f42073e",
          isLoopVariablePublished: true,
          loopCount: 3,
          loopedLines: [22, 23, 24, 25],
          loopPeriod: "Step",
          title: "Syntax"
        }
      ],
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "3d3f093a",
          isLoopVariablePublished: true,
          loopCount: 20,
          loopedLines: [3, 5],
          loopPeriod: "Year",
          title: "Compound Interest"
        }
      ],
      [
        "builtin-example-household-budget",
        {
          fingerprint: "391d4cde",
          isLoopVariablePublished: true,
          loopCount: 11,
          loopedLines: [16, 17, 18],
          loopPeriod: "Month",
          title: "Monthly Spending"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "926fef2f",
          isLoopVariablePublished: true,
          loopCount: 12,
          loopedLines: [4, 7, 8],
          loopPeriod: "Month",
          title: "Burn Rate"
        }
      ],
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "f84163b7",
          isLoopVariablePublished: true,
          loopCount: 359,
          loopedLines: [10, 11, 14, 15, 16, 17],
          loopPeriod: "Month",
          title: "Functions"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "95a1ef0b",
          isLoopVariablePublished: true,
          loopCount: 11,
          loopedLines: [3, 4, 7, 8, 9, 10],
          loopPeriod: "Month",
          title: "Advanced Loops"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "972853e4",
          isLoopVariablePublished: true,
          loopCount: 0,
          loopedLines: [1, 2, 3, 8],
          loopPeriod: "Day",
          title: "Live Stock Prices"
        }
      ]
    ])
  ],
  [
    "21",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "81cf06f0",
          isLoopVariablePublished: true,
          loopCount: 359,
          loopedLines: [10, 11, 14, 15, 16],
          loopPeriod: "Month",
          title: "Functions"
        }
      ]
    ])
  ],
  [
    "22",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "7f377cc0",
          isLoopVariablePublished: true,
          loopCount: 359,
          loopedLines: [10, 11, 14, 15, 16],
          loopPeriod: "Month",
          title: "Functions"
        }
      ],
      [
        "builtin-example-startup-runway",
        {
          fingerprint: "926fef2f",
          isLoopVariablePublished: true,
          loopCount: 12,
          loopedLines: [4, 7, 8],
          loopPeriod: "Month",
          title: "Burn Rate"
        }
      ]
    ])
  ],
  [
    "23",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "7f377cc0",
          isLoopVariablePublished: true,
          loopCount: 359,
          loopedLines: [10, 11, 14, 15, 16],
          loopPeriod: "Month",
          title: "Functions"
        }
      ]
    ])
  ],
  [
    "24",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-stock-research",
        {
          fingerprint: "972853e4",
          isLoopVariablePublished: true,
          loopCount: 0,
          loopedLines: [1, 2, 3, 8],
          loopPeriod: "Day",
          title: "Live Stock Prices"
        }
      ]
    ])
  ],
  [
    "25",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-mortgage-comparison",
        {
          fingerprint: "41595e85",
          isLoopVariablePublished: true,
          loopCount: 359,
          loopedLines: [10, 11, 14, 15, 16],
          loopPeriod: "Month",
          title: "Functions"
        }
      ],
      [
        "builtin-example-product-launch-profit",
        {
          fingerprint: "95a1ef0b",
          isLoopVariablePublished: true,
          loopCount: 11,
          loopedLines: [3, 4, 7, 8, 9, 10],
          loopPeriod: "Month",
          title: "Advanced Loops"
        }
      ],
      [
        "builtin-example-stock-research",
        {
          fingerprint: "145b3fde",
          isLoopVariablePublished: true,
          loopCount: 0,
          loopedLines: [],
          loopPeriod: "Day",
          title: "My Portfolio"
        }
      ]
    ])
  ],
  [
    "29",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-retirement-growth",
        {
          fingerprint: "3d3f093a",
          isLoopVariablePublished: true,
          loopCount: 20,
          loopedLines: [3, 5],
          loopPeriod: "Year",
          title: "Compound Interest"
        }
      ]
    ])
  ],
  [
    "30",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-using-loops",
        {
          fingerprint: "433e4084",
          isLoopVariablePublished: true,
          loopCount: 4,
          loopedLines: [3],
          loopPeriod: "Month",
          title: "Using Loops"
        }
      ]
    ])
  ],
  [
    "31",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-functions",
        {
          fingerprint: "ee20123b",
          isLoopEnabled: false,
          isLoopVariablePublished: true,
          loopCount: 0,
          loopedLines: [2, 3, 4],
          loopPeriod: "Iteration",
          title: "Functions"
        }
      ]
    ])
  ],
  [
    "33",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-functions",
        {
          fingerprint: "6f7e2c05",
          isLoopEnabled: true,
          isLoopVariablePublished: true,
          loopCount: 59,
          loopedLines: [2, 3, 4, 5, 6],
          loopPeriod: "Month",
          title: "Functions"
        }
      ]
    ])
  ],
  [
    "37",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "3f4167e4",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [10, 11, 12, 13, 14, 15, 19, 23, 27],
          loopPeriod: "None",
          title: "Syntax"
        }
      ]
    ])
  ],
  [
    "38",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "41845d45",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 28, 32],
          loopPeriod: "None",
          title: "Syntax"
        }
      ]
    ])
  ],
  [
    "39",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "61e177fa",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17],
          loopPeriod: "None",
          title: "Fancy Math"
        }
      ]
    ])
  ],
  [
    "40",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "e85a1713",
          isLoopVariablePublished: true,
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
          loopPeriod: "None",
          title: "Fancy Math"
        }
      ],
      [
        "builtin-example-construction-budget",
        {
          fingerprint: "5e792995",
          isLoopVariablePublished: true,
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [9, 15, 22, 27, 29],
          loopPeriod: "None",
          title: "Construction Budget"
        }
      ]
    ])
  ],
  [
    "41",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-construction-budget",
        {
          fingerprint: "5e792995",
          isLoopVariablePublished: true,
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [9, 15, 22, 27, 29],
          loopPeriod: "None",
          title: "Construction Budget"
        }
      ]
    ])
  ],
  [
    "42",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-math-with-variables",
        {
          fingerprint: "25e08e86",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [3],
          loopPeriod: "None",
          title: "Math with Variables"
        }
      ],
      [
        "builtin-example-section-total",
        {
          fingerprint: "915ba1b8",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [4],
          loopPeriod: "None",
          title: "Sum Section"
        }
      ]
    ])
  ],
  [
    "44",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-amortization-schedule",
        {
          fingerprint: "2e9e4f12",
          isLoopVariablePublished: false,
          loopCount: 359,
          loopedLines: [7, 10, 12, 13, 14, 15],
          loopPeriod: "Month",
          title: "Amortization Schedule"
        }
      ]
    ])
  ],
  [
    "45",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-amortization-schedule",
        {
          fingerprint: "26f5bf9c",
          isLoopVariablePublished: false,
          loopCount: 29,
          loopedLines: [13, 14, 15, 16, 17],
          loopPeriod: "Year",
          title: "Amortization Schedule"
        }
      ]
    ])
  ],
  [
    "46",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-section-total",
        {
          fingerprint: "7eecd6de",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [4],
          loopPeriod: "None",
          title: "Sum Section"
        }
      ]
    ])
  ],
  [
    "47",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-market-details",
        {
          fingerprint: "6edb5914",
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [1, 2, 3],
          loopPeriod: "None",
          title: "Live Prices"
        }
      ]
    ])
  ],
  [
    "51",
    new Map<HistoricalGettingStartedExampleId, PreviousExampleTemplate>([
      [
        "builtin-example-syntax",
        {
          fingerprint: "e85a1713",
          isLoopVariablePublished: false,
          isResultsHidden: true,
          loopCount: 0,
          loopedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
          loopPeriod: "None",
          title: "Fancy Math"
        }
      ]
    ])
  ]
]);

const revisionFortyTwoThroughFiftyConstructionBudget: PreviousExampleTemplate = {
  fingerprint: "2346ebef",
  isLoopVariablePublished: false,
  isResultsHidden: true,
  loopCount: 0,
  loopedLines: [6, 14, 17, 26, 28],
  loopPeriod: "None",
  title: "Construction Budget"
};

for (let revision = 42; revision <= 50; revision += 1) {
  const revisionKey = String(revision);
  const templates = previousExampleTemplates.get(revisionKey);
  if (templates) {
    templates.set(
      "builtin-example-construction-budget",
      revisionFortyTwoThroughFiftyConstructionBudget
    );
  } else {
    previousExampleTemplates.set(
      revisionKey,
      new Map([
        [
          "builtin-example-construction-budget",
          revisionFortyTwoThroughFiftyConstructionBudget
        ]
      ])
    );
  }
}

export type GettingStartedLibraryDocument = {
  id: GettingStartedExampleId;
  title: string;
  updatedAt: string;
  data: LooperDocumentData;
};

export type GettingStartedSeedResult<T> = {
  documents: T[];
  addedDocumentIds: string[];
  upgradedDocumentIds: string[];
  removedLegacyDocument: boolean;
  preferredActiveDocumentId?: string;
  templateRevisionToPersist?: string;
};

export function gettingStartedTextFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function assignmentLineNumbers(text: string, variableNames: readonly string[]): number[] {
  const selectedNames = new Set(variableNames.map((name) => name.toLowerCase()));
  const result: number[] = [];

  text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").forEach((line, lineNumber) => {
    const code = line.replace(/\/\/.*$/, "");
    const match = code.match(/^\s*((?:@)?[_A-Za-z][_A-Za-z0-9]*)\s*=/);
    if (match && selectedNames.has(match[1].toLowerCase())) result.push(lineNumber);
  });

  return result;
}

function sameNumberArray(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function isPristineLegacyGettingStartedDocument(
  document: {
    id: string;
    title: string;
    path?: string;
    data: LooperDocumentData;
  },
  storedTemplateRevision: string | null
): boolean {
  const expectedFingerprint = storedTemplateRevision
    ? legacyTemplateFingerprints.get(storedTemplateRevision)
    : undefined;
  const expectedLoopedLines = assignmentLineNumbers(
    document.data.text,
    legacyPublishedVariableNames
  );

  return (
    document.id === LEGACY_GETTING_STARTED_DOCUMENT_ID &&
    expectedFingerprint !== undefined &&
    gettingStartedTextFingerprint(document.data.text) === expectedFingerprint &&
    document.title === "Getting Started" &&
    document.data.title === "Getting Started" &&
    document.path === undefined &&
    document.data.fontScale === 0 &&
    document.data.loopPeriod === "Year" &&
    document.data.isLoopEnabled === true &&
    document.data.isResultsHidden === false &&
    document.data.resultSortMode === "manual" &&
    (document.data.stockSymbols?.length ?? 0) === 0 &&
    sameNumberArray(document.data.loopedLines, expectedLoopedLines)
  );
}

export function isPristinePreviousGettingStartedExampleDocument(
  document: {
    id: string;
    title: string;
    path?: string;
    data: LooperDocumentData;
  },
  storedTemplateRevision: string | null
): boolean {
  if (
    !storedTemplateRevision ||
    !isHistoricalGettingStartedExampleDocumentId(document.id)
  ) {
    return false;
  }
  const previousTemplate = previousExampleTemplates
    .get(storedTemplateRevision)
    ?.get(document.id);
  if (!previousTemplate) return false;

  return (
    gettingStartedTextFingerprint(document.data.text) === previousTemplate.fingerprint &&
    document.title === previousTemplate.title &&
    document.data.title === previousTemplate.title &&
    document.path === undefined &&
    document.data.fontScale === 0 &&
    (previousTemplate.loopCount === undefined ||
      document.data.loopCount === previousTemplate.loopCount) &&
    document.data.loopPeriod === previousTemplate.loopPeriod &&
    (previousTemplate.isLoopVariablePublished === undefined ||
      document.data.isLoopVariablePublished ===
        previousTemplate.isLoopVariablePublished) &&
    document.data.isLoopEnabled === (previousTemplate.isLoopEnabled ?? true) &&
    document.data.isResultsHidden === (previousTemplate.isResultsHidden ?? false) &&
    document.data.resultSortMode === "manual" &&
    (document.data.stockSymbols?.length ?? 0) === 0 &&
    sameNumberArray(document.data.loopedLines, previousTemplate.loopedLines)
  );
}

export function isGettingStartedExampleDocumentId(
  id: string
): id is GettingStartedExampleId {
  return gettingStartedExamples.some((example) => example.id === id);
}

function isHistoricalGettingStartedExampleDocumentId(
  id: string
): id is HistoricalGettingStartedExampleId {
  return (
    isGettingStartedExampleDocumentId(id) ||
    retiredGettingStartedExampleIdSet.has(id)
  );
}

export function gettingStartedExampleOrder(id: string): number {
  const index = gettingStartedExamples.findIndex((example) => example.id === id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function gettingStartedExampleSection(
  id: string
): GettingStartedExampleDefinition["section"] | undefined {
  return gettingStartedExamples.find((example) => example.id === id)?.section;
}

export function gettingStartedExampleSubtitle(id: string): string | undefined {
  return gettingStartedExamples.find((example) => example.id === id)?.subtitle;
}

export function createGettingStartedDocuments(
  updatedAt = new Date().toISOString()
): GettingStartedLibraryDocument[] {
  return gettingStartedExamples.map((example) => ({
    id: example.id,
    title: example.title,
    updatedAt,
    data: {
      title: example.title,
      text: example.text,
      fontScale: 0,
      decimalPlaces: 2,
      loopCount: example.loopCount,
      loopPeriod: example.loopPeriod,
      loopedLines: assignmentLineNumbers(
        visibleLooperText(example.text, example.isLoopEnabled),
        example.publishedVariableNames
      ),
      isLoopVariablePublished:
        "isLoopVariablePublished" in example
          ? example.isLoopVariablePublished
          : true,
      isLoopEnabled: true,
      isResultsHidden: !example.isSidebarOpenByDefault,
      resultSortMode: "manual",
      stockSymbols: []
    }
  }));
}

export function restoreGettingStartedExampleDocuments<T extends { id: string }>(
  documents: readonly T[],
  canonicalExamples: readonly T[]
): T[] {
  const canonicalById = new Map(
    canonicalExamples.map((document) => [document.id, document])
  );
  const restoredIds = new Set<string>();
  const restoredDocuments: T[] = [];

  for (const document of documents) {
    if (retiredGettingStartedExampleIdSet.has(document.id)) continue;

    const canonical = canonicalById.get(document.id);
    if (!canonical) {
      restoredDocuments.push(document);
      continue;
    }
    if (restoredIds.has(document.id)) continue;

    restoredDocuments.push(canonical);
    restoredIds.add(document.id);
  }

  for (const canonical of canonicalExamples) {
    if (restoredIds.has(canonical.id)) continue;
    restoredDocuments.push(canonical);
    restoredIds.add(canonical.id);
  }

  return restoredDocuments;
}

function parsedTemplateRevision(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function seedGettingStartedDocuments<T extends { id: string }>(
  documents: T[],
  storedTemplateRevision: string | null,
  createDocuments: () => T[],
  isPristineLegacyDocument?: (
    document: T,
    storedTemplateRevision: string | null
  ) => boolean,
  upgradeExampleDocument?: (
    document: T,
    storedTemplateRevision: string | null
  ) => T
): GettingStartedSeedResult<T> {
  const currentRevision = GETTING_STARTED_TEMPLATE_REVISION;
  const storedRevision = parsedTemplateRevision(storedTemplateRevision);

  if (storedRevision >= currentRevision) {
    return {
      documents,
      addedDocumentIds: [],
      upgradedDocumentIds: [],
      removedLegacyDocument: false,
      preferredActiveDocumentId: gettingStartedExamples.find((example) =>
        documents.some((document) => document.id === example.id)
      )?.id,
      templateRevisionToPersist: undefined
    };
  }

  let removedLegacyDocument = false;
  const migratedDocuments = documents.filter((document) => {
    if (
      document.id !== LEGACY_GETTING_STARTED_DOCUMENT_ID ||
      !isPristineLegacyDocument?.(document, storedTemplateRevision)
    ) {
      return true;
    }
    removedLegacyDocument = true;
    return false;
  });

  const upgradedDocumentIds: string[] = [];
  const upgradedDocuments = upgradeExampleDocument
    ? migratedDocuments.map((document) => {
        const upgradedDocument = upgradeExampleDocument(
          document,
          storedTemplateRevision
        );
        if (upgradedDocument !== document) upgradedDocumentIds.push(document.id);
        return upgradedDocument;
      })
    : migratedDocuments;

  const existingIds = new Set(upgradedDocuments.map((document) => document.id));
  const eligibleIds = new Set(
    gettingStartedExamples
      .filter((example) => example.introducedRevision > storedRevision)
      .map((example) => example.id)
  );
  const additions = createDocuments().filter(
    (document) =>
      eligibleIds.has(document.id as GettingStartedExampleId) &&
      !existingIds.has(document.id)
  );
  const nextDocuments = additions.length > 0
    ? [...upgradedDocuments, ...additions]
    : upgradedDocuments;

  return {
    documents: nextDocuments,
    addedDocumentIds: additions.map((document) => document.id),
    upgradedDocumentIds,
    removedLegacyDocument,
    preferredActiveDocumentId: gettingStartedExamples.find((example) =>
      nextDocuments.some((document) => document.id === example.id)
    )?.id,
    templateRevisionToPersist: String(currentRevision)
  };
}
