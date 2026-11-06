#!/usr/bin/env node
// Organized summary of one cashflow month: income, spending by category
// against the average of the 3 months before, business vs. personal, large
// charges, tracking-category targets, and the average monthly surplus.
//
// Usage: node scripts/month.mjs [--month YYYY-MM] [--plan-monthly 5000]
//   --plan-monthly: a planned new monthly cost (for example rent and groceries)
//                   to subtract from the average surplus.

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { loadBusiness } from './lib/config.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { budgetStatus, monthSummary } from './lib/analysis.mjs';
import { addMonths, parseArgs } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));

runScript(() => withRiseup(async (call) => {
  const { month: current } = await currentBudget(call);
  const month = typeof args.month === 'string' ? args.month : addMonths(current, -1);
  const averageMonths = [1, 2, 3].map((n) => addMonths(month, -n));
  const [budget, history] = await Promise.all([
    call('get_budget', { date: month }),
    transactionsByMonth(call, [month, ...averageMonths]),
  ]);
  const planMonthly = Number(args['plan-monthly']) > 0 ? Number(args['plan-monthly']) : 0;
  const summary = monthSummary({ month, byMonth: history.byMonth, averageMonths, business: loadBusiness(), planMonthly });
  const status = budgetStatus(budget);
  return {
    sources: [
      `riseup get_transactions for cashflow months ${[month, ...averageMonths].join(', ')}`,
      `riseup get_budget(${month}), updated ${budget.lastUpdatedAt}`,
    ],
    currentCashflowMonth: current,
    isPartialMonth: month === current,
    missingMonths: history.missing,
    ...summary,
    tracking: status.tracking.filter((t) => t.target > 0 || t.actual > 0),
  };
}));
