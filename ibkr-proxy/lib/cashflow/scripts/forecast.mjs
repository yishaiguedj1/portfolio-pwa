#!/usr/bin/env node
// Expected balance per bank account at the end of the next cashflow month,
// split into actual data, known commitments and estimates, with an optional
// what-if expense.
//
// Usage:
//   node scripts/forecast.mjs [--date YYYY-MM-DD]
//     [--amount 2500 [--method bank|card] [--installments 3] [--account <hash>]]
//
// --method bank (default) assumes the full amount leaves the account inside the
// window. --method card assumes a purchase in the current cashflow month whose
// first installment is billed next month.

import { RiseupToolError, runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { currentBudget, transactionsByMonth } from './lib/fetch.mjs';
import { variableSpendingStats } from './lib/analysis.mjs';
import { addMonths, cleanText, lastDayOfMonth, parseArgs, round2, todayIsrael } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));

// Walks the dated items from the current balance to find the lowest point
// before the forecast date. Variable spending that has not happened is not in it.
function lowestPoint(account) {
  const events = [
    ...(account.transactionsBilledUntilFuturePredictionDate ?? []).map((t) => ({ date: t.billingDate, amount: t.amount, isIncome: t.isIncome })),
    ...(account.fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate ?? []).map((t) => ({ date: t.predictedBillingDate, amount: t.amount, isIncome: t.isIncome })),
  ].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  let balance = account.currentBalance;
  let lowest = { date: String(account.currentBalanceUpdatedAt ?? '').slice(0, 10) || null, balance };
  let firstBelowZero = balance < 0 ? lowest.date : null;
  const byDay = new Map();
  for (const e of events) byDay.set(e.date, (byDay.get(e.date) ?? 0) + (e.isIncome ? e.amount : -e.amount));
  for (const [date, delta] of byDay) {
    balance = round2(balance + delta);
    if (balance < lowest.balance) lowest = { date, balance };
    if (balance < 0 && !firstBelowZero) firstBelowZero = date;
  }
  return { lowest, firstBelowZero };
}

function items(list, dateKey) {
  return (list ?? [])
    .map((t) => ({ merchant: cleanText(t.businessName, 40), amount: t.amount, isIncome: Boolean(t.isIncome), date: t[dateKey] }))
    .sort((a, b) => b.amount - a.amount);
}

async function predict(call, date, today) {
  try {
    return { date, response: await call('get_future_bank_balances_prediction', { futureDateForPrediction: date }) };
  } catch (error) {
    if (!(error instanceof RiseupToolError) || error.status !== 400) throw error;
    // The 400 explains the supported range. Retry once with the latest date it allows.
    const dates = [...error.message.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]).filter((d) => d >= today && d < date).sort();
    if (!dates.length) throw error;
    const fallback = dates.at(-1);
    return { date: fallback, adjustedFrom: date, response: await call('get_future_bank_balances_prediction', { futureDateForPrediction: fallback }) };
  }
}

runScript(() => withRiseup(async (call) => {
  const today = todayIsrael();
  const { month: current } = await currentBudget(call);
  const requested = typeof args.date === 'string' ? args.date : lastDayOfMonth(addMonths(current, 1));
  const fullMonths = [1, 2, 3].map((n) => addMonths(current, -n));
  const [prediction, history] = await Promise.all([
    predict(call, requested, today),
    transactionsByMonth(call, [current, ...fullMonths]),
  ]);

  const stats = variableSpendingStats(history.byMonth, fullMonths);
  const soFar = variableSpendingStats(history.byMonth, [current]).months[0];
  const restOfThisMonth = round2(Math.max(0, stats.average.total - soFar.total));
  const variableEstimate = round2(restOfThisMonth + stats.average.bankDirect);

  const accounts = (prediction.response.accounts ?? []).map((a) => ({
    bank: cleanText(a.bankName, 30),
    nickname: cleanText(a.accountNickname, 30),
    account: a.accountNumberHash,
    actual: { currentBalance: a.currentBalance, updatedAt: a.currentBalanceUpdatedAt },
    knownCommitments: {
      net: a.amountToBeBilledUntilFuturePredictionDate,
      count: (a.transactionsBilledUntilFuturePredictionDate ?? []).length,
      top: items(a.transactionsBilledUntilFuturePredictionDate, 'billingDate').slice(0, 8),
    },
    predictedFixed: {
      net: a.amountFixedPredictedToBeBilledUntilFuturePredictionDate,
      count: (a.fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate ?? []).length,
      top: items(a.fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate, 'predictedBillingDate').slice(0, 8),
    },
    predictedBalance: a.futurePredictedBalance,
    path: lowestPoint(a),
    creditCards: a.creditCardsInfo ?? [],
  }));

  let whatIf = null;
  if (args.amount !== undefined) {
    const amount = Number(args.amount);
    if (!(amount > 0)) throw new Error('--amount must be a positive number');
    const method = args.method === 'card' ? 'card' : 'bank';
    const installments = Math.max(1, Math.floor(Number(args.installments) || 1));
    const inWindow = method === 'bank' ? amount : round2(amount / installments);
    const target = accounts.find((a) => a.account === args.account) ?? accounts[0];
    whatIf = {
      amount,
      method,
      installments,
      assumption: method === 'bank'
        ? 'The full amount leaves the account before the forecast date.'
        : 'Card purchase in the current cashflow month: only the first installment is billed before the forecast date.',
      inWindow,
      afterWindow: round2(amount - inWindow),
      account: target?.account ?? null,
      predictedBalanceAfter: target ? round2(target.predictedBalance - inWindow) : null,
      withVariableEstimate: target && accounts.length === 1 ? round2(target.predictedBalance - inWindow - variableEstimate) : null,
    };
  }

  return {
    today,
    sources: [
      `riseup get_future_bank_balances_prediction(${prediction.date})`,
      `riseup get_transactions for cashflow months ${[current, ...fullMonths].join(', ')} (variable-spending estimate)`,
    ],
    currentCashflowMonth: current,
    forecastDate: prediction.date,
    forecastDateAdjustedFrom: prediction.adjustedFrom ?? null,
    accounts,
    emptyReason: accounts.length === 0
      ? 'No prediction: rolling credit is not supported, or no bank balance was updated in the last 2 days.'
      : null,
    estimate: {
      label: 'ESTIMATE, not data: variable spending that has not happened yet is not in the RiseUp prediction',
      basis: `average of non-fixed spending in ${fullMonths.join(', ')}, without single charges of ${stats.largeThreshold} ILS or more`,
      averagePerMonth: stats.average,
      leftOutLargeCharges: stats.excludedLarge,
      spentSoFarThisMonth: soFar.total,
      restOfThisMonth,
      nextMonthBankDirect: stats.average.bankDirect,
      totalUntilForecastDate: variableEstimate,
      predictedBalanceWithEstimate: accounts.length === 1 ? round2(accounts[0].predictedBalance - variableEstimate) : null,
      timingNote: 'Card spending next month is usually billed after the forecast date, so only its bank-direct part is included.',
    },
    whatIf,
    missingMonths: history.missing,
  };
}));
