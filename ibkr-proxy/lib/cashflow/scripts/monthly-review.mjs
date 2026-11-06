#!/usr/bin/env node
// Compares the last full cashflow month with the month before it and reports
// only what needs checking: new charges, price increases, suspected duplicates,
// and charges after a cancellation.
//
// Usage: node scripts/monthly-review.mjs [--month YYYY-MM] [--cancelled "name1,name2"]

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { monthlyReview } from './lib/analysis.mjs';
import { loadThresholds } from './lib/config.mjs';
import { addMonths, parseArgs } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));

runScript(() => withRiseup(async (call) => {
  const { month: current } = await currentBudget(call);
  const month = typeof args.month === 'string' ? args.month : addMonths(current, -1);
  if (month >= current) throw new Error(`${month} is not a full cashflow month yet (current is ${current})`);
  const previousMonth = addMonths(month, -1);
  const thresholds = loadThresholds();
  const lookback = Array.from({ length: thresholds.lookbackMonths }, (_, i) => addMonths(month, -(i + 1)));
  const { byMonth, missing } = await transactionsByMonth(call, [month, ...lookback]);
  const cancelled = typeof args.cancelled === 'string' ? args.cancelled.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const review = monthlyReview({ month, previousMonth, byMonth, lookback, cancelled, thresholds });
  return {
    sources: [`riseup get_transactions for cashflow months ${[month, ...lookback].join(', ')}`],
    currentCashflowMonth: current,
    missingMonths: missing,
    ...review,
  };
}));
