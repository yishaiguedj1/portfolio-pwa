#!/usr/bin/env node
// Suggests personal alert thresholds from the user's last 12 cashflow months
// and shows how many monthly-review findings they would give.
//
// Usage: node scripts/calibrate.mjs [--write]
//   --write saves the suggestion to config/thresholds.json (thresholds only,
//   no transactions or amounts beyond the thresholds themselves).

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { monthlyReview, suggestThresholds } from './lib/analysis.mjs';
import { CONFIG_DIR, loadThresholds } from './lib/config.mjs';
import { addMonths, monthRange, parseArgs, todayIsrael } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));

runScript(() => withRiseup(async (call) => {
  const { month } = await currentBudget(call);
  const months = monthRange(addMonths(month, -11), month);
  const { byMonth, missing } = await transactionsByMonth(call, months);
  const suggestion = suggestThresholds(Object.values(byMonth).flat());

  // Simulate the review on the last 5 full months with the suggested values.
  const thresholds = loadThresholds({ ...loadThresholds(), ...suggestion.suggested });
  const reviewMonths = monthRange(addMonths(month, -5), addMonths(month, -1));
  const findingsPerMonth = reviewMonths.map((m) => {
    const lookback = Array.from({ length: thresholds.lookbackMonths }, (_, i) => addMonths(m, -(i + 1))).filter((x) => x >= months[0]);
    const review = monthlyReview({ month: m, previousMonth: addMonths(m, -1), byMonth, lookback, thresholds });
    return { month: m, findings: review.findings.length };
  });

  let written = null;
  if (args.write && suggestion.enoughData) {
    const file = path.join(CONFIG_DIR, 'thresholds.json');
    writeFileSync(file, `${JSON.stringify({
      about: `Personal alert thresholds, calibrated on ${todayIsrael()} from ${months.length} cashflow months with scripts/calibrate.mjs. Any key missing here falls back to the defaults in scripts/lib/analysis.mjs.`,
      ...suggestion.suggested,
    }, null, 2)}\n`);
    written = 'config/thresholds.json';
  }
  return {
    sources: [`riseup get_transactions for cashflow months ${months[0]}..${months.at(-1)}`],
    missingMonths: missing,
    current: loadThresholds(),
    suggestion,
    simulatedFindingsPerMonth: findingsPerMonth,
    written,
  };
}));
