#!/usr/bin/env node
// Mortgage summary and the comparison with similar RiseUp customers.
// Each call is independent: a missing scope on one does not hide the other.

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { mortgageSummary } from './lib/analysis.mjs';

runScript(() => withRiseup(async (call) => {
  const [mortgage, benchmarks] = await Promise.allSettled([
    call('get_mortgages_data'),
    call('get_benchmarks_data', { spendAreas: ['mortgage'] }),
  ]);
  const benchmark = benchmarks.status === 'fulfilled'
    ? (benchmarks.value.benchmarks ?? []).find((b) => b.spendArea === 'mortgage') ?? null
    : null;
  return {
    sources: ['riseup get_mortgages_data', 'riseup get_benchmarks_data(mortgage)'],
    mortgage: mortgage.status === 'fulfilled' ? mortgageSummary(mortgage.value) : { error: mortgage.reason.message },
    benchmark: benchmark
      ? {
        customerMonthlySpend: benchmark.customerSpend,
        period: 'typical month over the last 6 months',
        percentile: benchmark.customerSpendPercentile,
        percentileMeaning: `spends more than ${benchmark.customerSpendPercentile}% of similar customers`,
        similarCustomersMean: benchmark.similarCustomersMean,
        comparedBy: benchmark.comparedBy,
      }
      : (benchmarks.status === 'rejected' ? { error: benchmarks.reason.message } : null),
  };
}));
