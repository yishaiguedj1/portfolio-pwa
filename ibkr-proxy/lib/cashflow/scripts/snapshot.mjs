#!/usr/bin/env node
// Balance per account, what is left in the current cashflow month, and the top
// three deviations from plan. Prints JSON for the snapshot skill to format.

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { budgetStatus } from './lib/analysis.mjs';
import { cleanText, dateOnly, daysBetween, sum, todayIsrael } from './lib/util.mjs';

runScript(() => withRiseup(async (call) => {
  const [balances, budget] = await Promise.all([
    call('get_current_bank_balances_data'),
    call('get_budget', { date: 'current' }),
  ]);
  const today = todayIsrael();
  const accounts = (balances.balances ?? []).map((b) => ({
    source: b.source,
    nickname: cleanText(b.accountNickname, 30),
    account: b.accountNumberHash,
    balance: b.balance,
    lastUpdated: b.lastUpdated,
    daysOld: daysBetween(dateOnly(b.lastUpdated), today),
  }));
  const status = budgetStatus(budget);
  return {
    today,
    sources: [
      'riseup get_current_bank_balances_data',
      `riseup get_budget(current): cashflow month ${budget.budgetDate}, updated ${budget.lastUpdatedAt}`,
    ],
    accounts,
    totalBalance: sum(accounts.map((a) => a.balance)),
    staleAccounts: accounts.filter((a) => a.daysOld > 2).map((a) => a.account),
    budget: {
      cashflowMonth: status.budgetDate,
      lastUpdatedAt: status.lastUpdatedAt,
      remaining: status.remaining,
      breakdown: status.breakdown,
      formula: status.formula,
      topDeviations: status.topDeviations,
      missedIncome: status.missed.income,
    },
  };
}));
