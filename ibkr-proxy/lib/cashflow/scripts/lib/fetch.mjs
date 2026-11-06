// Shared data fetching on top of withRiseup's call().

import { mapLimit } from './riseup-mcp.mjs';
import { normalizeTransaction } from './analysis.mjs';

export async function currentBudget(call) {
  const budget = await call('get_budget', { date: 'current' });
  return { month: budget.budgetDate, budget };
}

// Fetches one get_transactions call per cashflow month (the API allows no more).
// Months the API cannot serve (for example, before the first record) come back
// empty and are listed in `missing`.
export async function transactionsByMonth(call, months) {
  const missing = [];
  const lists = await mapLimit(months, 3, async (month) => {
    try {
      const response = await call('get_transactions', { cashflowMonth: month });
      return (response.transactions ?? []).map(normalizeTransaction);
    } catch (error) {
      missing.push({ month, error: error.message.slice(0, 160) });
      return [];
    }
  });
  return { byMonth: Object.fromEntries(months.map((m, i) => [m, lists[i]])), missing };
}
