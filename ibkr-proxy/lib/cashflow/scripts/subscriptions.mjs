#!/usr/bin/env node
// Recurring charges over the last 12 cashflow months (the current one included).
// It only surfaces them; it never decides that something is unnecessary.
//
// Usage: node scripts/subscriptions.mjs [--months 12]

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { detectRecurring } from './lib/analysis.mjs';
import { loadThresholds } from './lib/config.mjs';
import { addMonths, monthRange, parseArgs, sum, todayIsrael } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
const count = Math.min(24, Math.max(3, Number(args.months) || 12));

runScript(() => withRiseup(async (call) => {
  const { month: current } = await currentBudget(call);
  const months = monthRange(addMonths(current, -(count - 1)), current);
  const { byMonth, missing } = await transactionsByMonth(call, months);
  const today = todayIsrael();
  const recurring = detectRecurring(Object.values(byMonth).flat(), { months, today, thresholds: loadThresholds() });
  const active = recurring.filter((r) => !r.possiblyEnded && r.confidence !== 'low');
  return {
    sources: [`riseup get_transactions for cashflow months ${months[0]}..${months.at(-1)}`],
    today,
    window: { from: months[0], to: months.at(-1), months: months.length, currentMonthIsPartial: true },
    missingMonths: missing,
    summary: {
      recurringCount: recurring.length,
      activeCount: active.length,
      activeMonthlyEquivalent: sum(active.map((r) => r.monthlyEquivalent)),
      withPriceChanges: recurring.filter((r) => r.priceChanges.length > 0).length,
    },
    recurring,
    notes: [
      'Installments are excluded: they are payment plans, not recurring charges.',
      'monthlyEquivalent uses the latest price level times the detected frequency.',
      'possiblyEnded means no charge for over 1.5 periods; it may have been cancelled or may be late.',
      'confidence low: RiseUp marked it as a commitment, but it has no regular period and no steady price (often one-off shopping). Not counted in the totals.',
      'parallelCommitments > 1: RiseUp tracks several separate commitments for the same merchant.',
    ],
  };
}));
