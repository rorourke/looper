import {
  assignmentLineNumbers,
  createGettingStartedDocuments
} from "./gettingStartedDocument.ts";
import type { LooperDocumentData } from "./looperEngine.ts";

export const DEMO_ACCOUNT_EMAIL = "demo@looper.app";
export const DEMO_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

export type DemoSheetDocument = {
  demo: true;
  id: string;
  title: string;
  updatedAt: string;
  data: LooperDocumentData;
};

type DemoSheetDefinition = {
  id: string;
  title: string;
  text: string;
  loopCount: number;
  loopPeriod: string;
  publishedVariableNames: readonly string[];
  showLoopSidebar: boolean;
};

export const demoSheetDefinitions = [
  {
    id: "demo-net-worth",
    title: "Net Worth Snapshot",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: ["TOTAL_ASSETS", "TOTAL_DEBT", "NET_WORTH"],
    showLoopSidebar: false,
    text: `Net Worth Snapshot:
Cash:
checking = $18.5k
savings = $62k
emergency_fund = $35k
CASH = sumsection

Investments:
brokerage = $285k
retirement = $410k
company_equity = $95k
INVESTMENTS = sumsection

Real Estate:
home_value = $1.35M
mortgage_balance = $684k
HOME_EQUITY = home_value - mortgage_balance

Other Assets:
vehicles = $42k
collectibles = $18k
OTHER_ASSETS = sumsection

Other Liabilities:
student_loan = $24k
credit_cards = $3.2k
OTHER_DEBT = sumsection

TOTAL_ASSETS = CASH + INVESTMENTS + home_value + OTHER_ASSETS
TOTAL_DEBT = mortgage_balance + OTHER_DEBT
NET_WORTH = TOTAL_ASSETS - TOTAL_DEBT`
  },
  {
    id: "demo-mortgage-amortization",
    title: "Mortgage Amortization",
    loopCount: 29,
    loopPeriod: "Year",
    publishedVariableNames: [
      "annual_payment",
      "principal_paid",
      "interest_paid",
      "remaining_balance",
      "total_interest_paid"
    ],
    showLoopSidebar: true,
    text: `30-Year Mortgage:
home_price = $950k
down_payment = 20%
loan = home_price * (1 - down_payment)
annual_rate = 6.25%
years = 30
monthly_rate = annual_rate / 12
payment_count = years * 12
growth = (1 + monthly_rate) ^ payment_count
monthly_payment = loan * monthly_rate * growth / (growth - 1)

balanceAfterMonths(principal, rate, payment, months) {
	month_growth = (1 + rate) ^ months
	principal * month_growth - payment * (month_growth - 1) / rate
}

Annual Paydown:
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
    id: "demo-cedar-ridge-build",
    title: "Cedar Ridge Build",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: [
      "SITE",
      "HARD_COSTS",
      "SOFT_COSTS",
      "INTERIORS",
      "CONTINGENCY",
      "@cedar_ridge_budget",
      "cost_per_sqft"
    ],
    showLoopSidebar: false,
    text: `Cedar Ridge Build:
Site & Acquisition:
lot = $850k
demolition = $48k
site_work = $125k
permits = $32k
SITE = sumsection

Hard Costs:
living_area = 4200
house = living_area * $575
garage = 720 * $310
pool = $185k
landscaping = $140k
HARD_COSTS = sumsection

Design & Professional:
architect = HARD_COSTS * 7%
interiors_design = $95k
engineering = $68k
survey_and_soils = $22k
SOFT_COSTS = sumsection

Interiors & Equipment:
furniture = $280k
appliances = $72k
lighting = $48k
av_and_security = $36k
INTERIORS = sumsection

CONTINGENCY = (HARD_COSTS + SOFT_COSTS) * 12%
@cedar_ridge_budget = SITE + HARD_COSTS + SOFT_COSTS + INTERIORS + CONTINGENCY
cost_per_sqft = @cedar_ridge_budget / living_area`
  },
  {
    id: "demo-rental-pro-forma",
    title: "Rental Property Pro Forma",
    loopCount: 9,
    loopPeriod: "Year",
    publishedVariableNames: [
      "gross_rent",
      "net_operating_income",
      "cash_flow",
      "cash_on_cash",
      "property_value",
      "owner_equity"
    ],
    showLoopSidebar: true,
    text: `10-Year Rental Property:
purchase_price = $780k
down_payment = 25%
closing_and_repairs = $42k
cash_invested = purchase_price * down_payment + closing_and_repairs
loan = purchase_price * (1 - down_payment)
monthly_rent = $5.4k
rent_growth = 3%
vacancy_rate = 5%
operating_cost_rate = 32%
annual_debt_service = $47.4k
appreciation = 3.5%

Annual Pro Forma:
gross_rent = monthly_rent * 12 * (1 + rent_growth) ^ loop
vacancy = gross_rent * vacancy_rate
operating_costs = gross_rent * operating_cost_rate
net_operating_income = gross_rent - vacancy - operating_costs
cash_flow = net_operating_income - annual_debt_service
cash_on_cash = cash_flow / cash_invested
property_value = purchase_price * (1 + appreciation) ^ (loop + 1)
estimated_loan_balance = loan * (1 - (loop + 1) / 30)
owner_equity = property_value - estimated_loan_balance`
  },
  {
    id: "demo-retirement-plan",
    title: "Retirement Plan",
    loopCount: 30,
    loopPeriod: "Year",
    publishedVariableNames: [
      "age",
      "portfolio",
      "annual_growth",
      "retirement_target",
      "target_progress"
    ],
    showLoopSidebar: true,
    text: `Retirement Plan:
current_age = 36
current_savings = $310k
annual_contribution = $32k
expected_return = 6.5%
annual_spending_goal = $120k
withdrawal_rate = 4%

Future Value:
age = current_age + loop
contribution_growth = ((1 + expected_return) ^ loop - 1) / expected_return
portfolio = current_savings * (1 + expected_return) ^ loop + annual_contribution * contribution_growth
prior_portfolio = current_savings * (1 + expected_return) ^ (loop - 1) + annual_contribution * (((1 + expected_return) ^ (loop - 1) - 1) / expected_return)
annual_growth = portfolio - prior_portfolio
retirement_target = annual_spending_goal / withdrawal_rate
target_progress = portfolio / retirement_target`
  },
  {
    id: "demo-startup-runway",
    title: "Startup Runway",
    loopCount: 17,
    loopPeriod: "Month",
    publishedVariableNames: [
      "monthly_revenue",
      "monthly_expenses",
      "monthly_net",
      "ending_cash"
    ],
    showLoopSidebar: true,
    text: `18-Month Startup Runway:
cash_in_bank = $1.2M
starting_mrr = $72k
monthly_revenue_growth = 6%
starting_payroll = $118k
monthly_payroll_growth = 1.5%
other_monthly_costs = $34k

Cash Plan:
monthly_revenue = starting_mrr * (1 + monthly_revenue_growth) ^ loop
monthly_payroll = starting_payroll * (1 + monthly_payroll_growth) ^ loop
monthly_expenses = monthly_payroll + other_monthly_costs
monthly_net = monthly_revenue - monthly_expenses
revenue_to_date = starting_mrr * ((1 + monthly_revenue_growth) ^ (loop + 1) - 1) / monthly_revenue_growth
payroll_to_date = starting_payroll * ((1 + monthly_payroll_growth) ^ (loop + 1) - 1) / monthly_payroll_growth
expenses_to_date = payroll_to_date + other_monthly_costs * (loop + 1)
ending_cash = cash_in_bank + revenue_to_date - expenses_to_date`
  },
  {
    id: "demo-product-launch",
    title: "Product Launch Forecast",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: [
      "units_sold",
      "revenue",
      "gross_profit",
      "operating_profit",
      "cumulative_profit"
    ],
    showLoopSidebar: true,
    text: `12-Month Product Launch:
unit_price = $149
unit_cost = $46
first_month_units = 850
monthly_unit_growth = 8%
fixed_monthly_costs = $54k
launch_cost = $180k

Monthly Forecast:
units_sold = first_month_units * (1 + monthly_unit_growth) ^ loop
revenue = units_sold * unit_price
cost_of_goods = units_sold * unit_cost
gross_profit = revenue - cost_of_goods
operating_profit = gross_profit - fixed_monthly_costs
units_to_date = first_month_units * ((1 + monthly_unit_growth) ^ (loop + 1) - 1) / monthly_unit_growth
cumulative_profit = units_to_date * (unit_price - unit_cost) - fixed_monthly_costs * (loop + 1) - launch_cost`
  },
  {
    id: "demo-solar-payback",
    title: "Solar Payback",
    loopCount: 19,
    loopPeriod: "Year",
    publishedVariableNames: [
      "energy_produced",
      "utility_rate",
      "annual_savings",
      "cumulative_savings",
      "net_benefit"
    ],
    showLoopSidebar: true,
    text: `20-Year Solar Payback:
system_cost = $38k
tax_credit = 30%
net_cost = system_cost * (1 - tax_credit)
first_year_kwh = 14500
panel_degradation = 0.5%
current_utility_rate = $0.31
utility_inflation = 4%
annual_maintenance = $240

Annual Savings:
energy_produced = first_year_kwh * (1 - panel_degradation) ^ loop
utility_rate = current_utility_rate * (1 + utility_inflation) ^ loop
annual_savings = energy_produced * utility_rate - annual_maintenance
savings_growth = (1 - panel_degradation) * (1 + utility_inflation)
cumulative_savings = first_year_kwh * current_utility_rate * (savings_growth ^ (loop + 1) - 1) / (savings_growth - 1) - annual_maintenance * (loop + 1)
net_benefit = cumulative_savings - net_cost`
  },
  {
    id: "demo-consulting-capacity",
    title: "Consulting Capacity Plan",
    loopCount: 7,
    loopPeriod: "Quarter",
    publishedVariableNames: [
      "consultants",
      "billable_revenue",
      "total_cost",
      "operating_profit",
      "operating_margin"
    ],
    showLoopSidebar: true,
    text: `8-Quarter Capacity Plan:
starting_consultants = 8
quarterly_hires = 1
hours_per_quarter = 480
utilization = 72%
blended_rate = $245
loaded_cost_per_consultant = $78k
quarterly_overhead = $165k

Quarterly Plan:
consultants = starting_consultants + quarterly_hires * loop
billable_hours = consultants * hours_per_quarter * utilization
billable_revenue = billable_hours * blended_rate
delivery_cost = consultants * loaded_cost_per_consultant
total_cost = delivery_cost + quarterly_overhead
operating_profit = billable_revenue - total_cost
operating_margin = operating_profit / billable_revenue
project_budget_coverage = operating_profit / @cedar_ridge_budget`
  },
  {
    id: "demo-household-cash-flow",
    title: "Household Cash Flow",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: [
      "income_to_date",
      "expenses_to_date",
      "savings_to_date",
      "savings_rate"
    ],
    showLoopSidebar: true,
    text: `12-Month Household Cash Flow:
Monthly Income:
salary = $15.6k
side_income = $1.4k
rental_income = $1.2k
MONTHLY_INCOME = sumsection

Monthly Expenses:
housing = $4.8k
childcare = $2.4k
groceries = $1.3k
transportation = $950
utilities = $620
insurance = $780
discretionary = $1.6k
MONTHLY_EXPENSES = sumsection

Year-to-Date Plan:
income_to_date = MONTHLY_INCOME * (loop + 1)
expenses_to_date = MONTHLY_EXPENSES * (loop + 1)
savings_to_date = income_to_date - expenses_to_date
savings_rate = savings_to_date / income_to_date`
  },
  {
    id: "demo-college-savings",
    title: "College Savings Projection",
    loopCount: 17,
    loopPeriod: "Year",
    publishedVariableNames: [
      "child_age",
      "projected_balance",
      "projected_annual_cost",
      "four_year_cost",
      "funding_progress"
    ],
    showLoopSidebar: true,
    text: `College Savings Projection:
child_age_today = 4
current_balance = $45k
annual_contribution = $12k
expected_return = 6%
annual_cost_today = $55k
tuition_inflation = 4%

Annual Projection:
years_invested = loop + 1
child_age = child_age_today + years_invested
contribution_factor = ((1 + expected_return) ^ years_invested - 1) / expected_return
projected_balance = current_balance * (1 + expected_return) ^ years_invested + annual_contribution * contribution_factor
projected_annual_cost = annual_cost_today * (1 + tuition_inflation) ^ years_invested
four_year_cost = projected_annual_cost * 4
funding_progress = projected_balance / four_year_cost`
  },
  {
    id: "demo-saas-revenue",
    title: "SaaS Revenue Forecast",
    loopCount: 23,
    loopPeriod: "Month",
    publishedVariableNames: [
      "customers",
      "mrr",
      "annualized_revenue",
      "gross_profit",
      "operating_profit"
    ],
    showLoopSidebar: true,
    text: `24-Month SaaS Revenue Forecast:
starting_customers = 1250
monthly_customer_growth = 5%
monthly_churn = 2%
net_customer_growth = monthly_customer_growth - monthly_churn
average_revenue_per_account = $79
hosting_and_support_rate = 18%
starting_operating_cost = $118k
monthly_cost_growth = 1.5%

Monthly Forecast:
customers = starting_customers * (1 + net_customer_growth) ^ loop
mrr = customers * average_revenue_per_account
annualized_revenue = mrr * 12
gross_profit = mrr * (1 - hosting_and_support_rate)
operating_cost = starting_operating_cost * (1 + monthly_cost_growth) ^ loop
operating_profit = gross_profit - operating_cost`
  },
  {
    id: "demo-ecommerce-unit-economics",
    title: "E-Commerce Unit Economics",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: [
      "revenue",
      "gross_profit",
      "contribution_profit",
      "customer_acquisition_cost",
      "customer_lifetime_value",
      "ltv_to_cac"
    ],
    showLoopSidebar: false,
    text: `E-Commerce Unit Economics:
monthly_orders = 3200
average_order_value = $86
product_cost_rate = 31%
fulfillment_per_order = $8.5
payment_fee_rate = 2.9%
monthly_marketing = $72k
new_customers = 1450
repeat_purchase_rate = 28%

Monthly Economics:
revenue = monthly_orders * average_order_value
product_cost = revenue * product_cost_rate
fulfillment_cost = monthly_orders * fulfillment_per_order
payment_fees = revenue * payment_fee_rate
gross_profit = revenue - product_cost
contribution_profit = gross_profit - fulfillment_cost - payment_fees - monthly_marketing
contribution_margin = contribution_profit / revenue
customer_acquisition_cost = monthly_marketing / new_customers
customer_lifetime_value = average_order_value * (1 - product_cost_rate) / (1 - repeat_purchase_rate)
ltv_to_cac = customer_lifetime_value / customer_acquisition_cost`
  },
  {
    id: "demo-sales-team-plan",
    title: "Sales Team Hiring Plan",
    loopCount: 7,
    loopPeriod: "Quarter",
    publishedVariableNames: [
      "sales_reps",
      "quarterly_bookings",
      "team_cost",
      "gross_contribution",
      "return_on_team_cost"
    ],
    showLoopSidebar: true,
    text: `8-Quarter Sales Team Hiring Plan:
starting_reps = 6
quarterly_hires = 2
quarterly_quota_per_rep = $180k
average_productivity = 72%
gross_margin = 78%
loaded_quarterly_cost_per_rep = $42k
sales_operations_cost = $85k

Quarterly Plan:
sales_reps = starting_reps + quarterly_hires * loop
quarterly_bookings = sales_reps * quarterly_quota_per_rep * average_productivity
team_cost = sales_reps * loaded_quarterly_cost_per_rep + sales_operations_cost
gross_contribution = quarterly_bookings * gross_margin - team_cost
return_on_team_cost = gross_contribution / team_cost`
  },
  {
    id: "demo-restaurant-break-even",
    title: "Restaurant Break-Even",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: [
      "monthly_revenue",
      "contribution_margin",
      "FIXED_COSTS",
      "break_even_revenue",
      "operating_profit"
    ],
    showLoopSidebar: false,
    text: `Restaurant Break-Even:
seats = 84
turns_per_day = 2.2
average_check = $52
open_days_per_month = 26
guest_capacity = seats * turns_per_day * open_days_per_month
monthly_revenue = guest_capacity * average_check
food_cost_rate = 29%
hourly_labor_rate = 18%
card_fee_rate = 3%
contribution_margin = 1 - food_cost_rate - hourly_labor_rate - card_fee_rate

Monthly Fixed Costs:
management_payroll = $48k
rent = $22k
utilities = $7.5k
insurance = $3.2k
marketing = $6k
other_overhead = $8.5k
FIXED_COSTS = sumsection

break_even_revenue = FIXED_COSTS / contribution_margin
operating_profit = monthly_revenue * contribution_margin - FIXED_COSTS`
  },
  {
    id: "demo-vehicle-ownership",
    title: "Vehicle Cost of Ownership",
    loopCount: 4,
    loopPeriod: "Year",
    publishedVariableNames: [
      "vehicle_age",
      "estimated_value",
      "annual_operating_cost",
      "ownership_cost_to_date",
      "net_cost_to_date"
    ],
    showLoopSidebar: true,
    text: `5-Year Vehicle Cost of Ownership:
purchase_price = $68k
down_payment = $14k
annual_loan_payments = $11.8k
annual_depreciation = 15%
first_year_fuel = $2.8k
first_year_insurance = $2.4k
annual_maintenance = $1.2k
cost_inflation = 4%

Annual Ownership Plan:
vehicle_age = loop + 1
estimated_value = purchase_price * (1 - annual_depreciation) ^ vehicle_age
annual_fuel = first_year_fuel * (1 + cost_inflation) ^ loop
annual_insurance = first_year_insurance * (1 + cost_inflation) ^ loop
annual_operating_cost = annual_fuel + annual_insurance + annual_maintenance
inflation_factor = ((1 + cost_inflation) ^ vehicle_age - 1) / cost_inflation
operating_cost_to_date = (first_year_fuel + first_year_insurance) * inflation_factor + annual_maintenance * vehicle_age
ownership_cost_to_date = down_payment + annual_loan_payments * vehicle_age + operating_cost_to_date
net_cost_to_date = ownership_cost_to_date - estimated_value`
  },
  {
    id: "demo-wedding-budget",
    title: "Wedding Budget",
    loopCount: 0,
    loopPeriod: "None",
    publishedVariableNames: [
      "VENUE_AND_FOOD",
      "DESIGN_AND_ATTIRE",
      "VENDORS",
      "CONTINGENCY",
      "TOTAL_BUDGET",
      "remaining_to_fund"
    ],
    showLoopSidebar: false,
    text: `Wedding Budget:
Venue & Food:
venue = $28k
catering = $34k
bar = $12k
rentals = $7.5k
VENUE_AND_FOOD = sumsection

Design & Attire:
flowers = $9.5k
decor = $6.8k
attire = $8.2k
invitations = $2.4k
DESIGN_AND_ATTIRE = sumsection

Vendors:
photography = $7.8k
music = $5.2k
planner = $8.5k
transportation = $3.6k
VENDORS = sumsection

CONTINGENCY = (VENUE_AND_FOOD + DESIGN_AND_ATTIRE + VENDORS) * 8%
TOTAL_BUDGET = VENUE_AND_FOOD + DESIGN_AND_ATTIRE + VENDORS + CONTINGENCY
already_saved = $92k
remaining_to_fund = TOTAL_BUDGET - already_saved`
  },
  {
    id: "demo-travel-savings",
    title: "Travel Savings Goal",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: [
      "month_number",
      "savings_balance",
      "remaining_to_goal",
      "goal_progress"
    ],
    showLoopSidebar: true,
    text: `12-Month Travel Savings Goal:
trip_budget = $24k
current_savings = $6.5k
monthly_contribution = $1.4k
annual_yield = 4.5%
monthly_yield = annual_yield / 12

Monthly Savings Plan:
month_number = loop + 1
contribution_factor = ((1 + monthly_yield) ^ month_number - 1) / monthly_yield
savings_balance = current_savings * (1 + monthly_yield) ^ month_number + monthly_contribution * contribution_factor
remaining_to_goal = trip_budget - savings_balance
goal_progress = savings_balance / trip_budget`
  },
  {
    id: "demo-nonprofit-fundraising",
    title: "Nonprofit Fundraising Plan",
    loopCount: 11,
    loopPeriod: "Month",
    publishedVariableNames: [
      "monthly_donations",
      "donations_to_date",
      "total_raised",
      "goal_remaining",
      "goal_progress"
    ],
    showLoopSidebar: true,
    text: `12-Month Nonprofit Fundraising Plan:
annual_goal = $2.4M
starting_monthly_donations = $145k
monthly_donation_growth = 4%
annual_grant_funding = $600k

Monthly Fundraising Plan:
month_number = loop + 1
monthly_donations = starting_monthly_donations * (1 + monthly_donation_growth) ^ loop
donation_factor = ((1 + monthly_donation_growth) ^ month_number - 1) / monthly_donation_growth
donations_to_date = starting_monthly_donations * donation_factor
grants_to_date = annual_grant_funding * month_number / 12
total_raised = donations_to_date + grants_to_date
goal_remaining = annual_goal - total_raised
goal_progress = total_raised / annual_goal`
  }
] as const satisfies readonly DemoSheetDefinition[];

export function createDemoTimeDocuments(
  now = new Date()
): DemoSheetDocument[] {
  return demoSheetDefinitions.map((definition, index) => {
    const updatedAt = new Date(
      now.getTime() - index * 26 * 60 * 60 * 1000
    ).toISOString();
    return {
      demo: true,
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
        loopSidebarDividerLines: [],
        isLoopVariablePublished: true,
        isLoopEnabled: true,
        isResultsHidden: !definition.showLoopSidebar,
        resultSortMode: "manual",
        stockSymbols: []
      }
    };
  });
}

export function createDemoTimeLibraryDocuments(now = new Date()) {
  return [
    ...createDemoTimeDocuments(now),
    ...createGettingStartedDocuments(now.toISOString())
  ];
}
