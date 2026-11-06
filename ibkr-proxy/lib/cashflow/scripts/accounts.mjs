#!/usr/bin/env node
// Lists the bank accounts and cards RiseUp sees, by masked ID only.
// Used to keep the account map in CLAUDE.md current.

import { runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { addMonths, cleanText } from './lib/util.mjs';

runScript(() => withRiseup(async (call) => {
  const { month } = await currentBudget(call);
  const months = [month, addMonths(month, -1), addMonths(month, -2)];
  const [balances, history] = await Promise.all([
    call('get_current_bank_balances_data'),
    transactionsByMonth(call, months),
  ]);
  const seen = new Map();
  for (const t of Object.values(history.byMonth).flat()) {
    const key = `${t.source}|${t.sourceType}|${t.account}`;
    const entry = seen.get(key) ?? { source: t.source, sourceType: t.sourceType, account: t.account, transactions: 0, lastDate: null };
    entry.transactions++;
    if (!entry.lastDate || (t.date && t.date > entry.lastDate)) entry.lastDate = t.date;
    seen.set(key, entry);
  }
  return {
    sources: ['riseup get_current_bank_balances_data', `riseup get_transactions for ${months.join(', ')}`],
    bankAccounts: (balances.balances ?? []).map((b) => ({
      source: b.source,
      account: b.accountNumberHash,
      nickname: cleanText(b.accountNickname, 30),
      lastUpdated: b.lastUpdated,
    })),
    sourcesSeen: [...seen.values()].sort((a, b) => b.transactions - a.transactions),
  };
}));
