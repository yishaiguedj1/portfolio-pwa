// Pure analysis functions over RiseUp tool output. No I/O, so they are unit-tested
// with synthetic fixtures in scripts/test/.

import { cleanText, dateOnly, daysBetween, foreignCountry, median, merchantKey, percentChange, round2, sum } from './util.mjs';

// Generic defaults for any user. Personal values live in config/thresholds.json
// (scripts/lib/config.mjs merges them); `npm run calibrate` derives them from
// the user's own history, for example newMerchantMin near the 90th percentile
// of single charges.
export const THRESHOLDS = {
  priceChangePct: 4, // smaller changes are usually exchange-rate noise
  priceChangeMin: 1, // ILS
  newMerchantMin: 300, // ILS, for a new merchant that is not subscription-like
  newMerchantTop: 5,
  duplicateMin: 30, // ILS; smaller same-day repeats were legitimate (tickets, snacks)
  duplicateMaxDays: 1,
  frequentMerchantCount: 8, // merchants this frequent need a same-day match
  frequentDuplicateMin: 50, // ILS
  lookbackMonths: 6,
  findingTransactions: 4,
};

const SUBSCRIPTION_HINTS = /netflix|spotify|apple|itunes|icloud|google|youtube|disney|amazon|prime video|microsoft|xbox|playstation|steam|adobe|dropbox|openai|chatgpt|anthropic|claude|canva|notion|zoom|audible|kindle|hbo|paramount|deezer|tidal|patreon|linkedin|duolingo|vpn|paypal|subscription|membership|\byes\b|\bhot\b|partner|cellcom|pelephone|golan|bezeq|סלקום|פרטנר|פלאפון|גולן|בזק|מנוי|חברות|נטפליקס|ספוטיפיי/i;
const CANCEL_WORDS = /בוטל|ביטול|לבטל|ביטלתי|בטלתי|הופסק|הפסקתי|cancel/i;

const FREQUENCIES = [
  { id: 'weekly', label: 'שבועי', min: 5, max: 9, perMonth: 52 / 12, minCount: 4 },
  { id: 'monthly', label: 'חודשי', min: 20, max: 40, perMonth: 1, minCount: 3 },
  { id: 'bimonthly', label: 'דו-חודשי', min: 50, max: 70, perMonth: 1 / 2, minCount: 3 },
  { id: 'quarterly', label: 'רבעוני', min: 80, max: 100, perMonth: 1 / 3, minCount: 2 },
  { id: 'semiannual', label: 'חצי-שנתי', min: 165, max: 200, perMonth: 1 / 6, minCount: 2 },
  { id: 'yearly', label: 'שנתי', min: 340, max: 390, perMonth: 1 / 12, minCount: 2 },
];

const GUIDANCE = {
  'new-recurring': {
    unknown: 'האם זה מנוי או התחייבות שהתחלת ביודעין',
    nextStep: 'לבדוק במייל או בחשבון אצל הספק. אם לא מוכר, לברר מול חברת האשראי',
  },
  'new-installments': {
    unknown: 'מה נקנה, והאם מספר התשלומים והסכום נכונים',
    nextStep: 'להשוות לקבלה או להזמנה',
  },
  'new-subscription-like': {
    unknown: 'האם זו תקופת ניסיון שהפכה לתשלום',
    nextStep: 'לבדוק בהגדרות המנוי אצל הספק',
  },
  'new-large': {
    unknown: 'האם החיוב מוכר לך',
    nextStep: 'אם לא מוכר, לברר מול חברת האשראי או הבנק',
  },
  'new-abroad': {
    unknown: 'האם אלה חיובים מנסיעה או מקנייה שלך',
    nextStep: 'אם לא מוכרים, לפנות מיד לחברת האשראי ולחסום את הכרטיס',
  },
  'price-increase': {
    unknown: 'האם העלייה קבועה, הודעה מראש, או שינוי שער מטבע',
    nextStep: 'לבדוק את תנאי המנוי או החשבונית האחרונה',
  },
  duplicate: {
    unknown: 'ייתכן ששתי רכישות אמיתיות',
    nextStep: 'להשוות לקבלות. אם כפול, לבקש זיכוי מבית העסק או מחברת האשראי',
  },
  'double-recurring': {
    unknown: 'ייתכן חיוב רטרואקטיבי או שינוי מועד חיוב',
    nextStep: 'לבדוק בחשבון אצל הספק כמה חיובים היו צפויים החודש',
  },
  'after-cancellation': {
    unknown: 'מתי נכנס הביטול לתוקף, והאם זה חיוב אחרון לגיטימי',
    nextStep: 'לבקש מהספק אישור ביטול וזיכוי. אם אין מענה, לפנות לחברת האשראי',
  },
};

export function normalizeTransaction(t) {
  return {
    id: t.transactionId ?? null,
    date: dateOnly(t.transactionDate),
    billingDate: dateOnly(t.billingDate),
    month: t.cashflowDate ?? null,
    merchant: cleanText(t.businessName) ?? '(ללא שם)',
    key: merchantKey(t.businessName) || '(empty)',
    amount: round2(t.amount ?? 0),
    isIncome: Boolean(t.isIncome),
    account: t.accountNumberHash ?? null,
    source: t.source ?? null,
    sourceType: t.sourceType ?? null,
    isInstallment: Boolean(t.isInstallment),
    installmentNumber: t.installmentNumber ?? null,
    totalInstallments: t.totalNumberOfInstallments ?? t.totalNumberOfPayments ?? null,
    commitmentId: t.commitmentId ?? null,
    actualType: t.actualType ?? null,
    category: cleanText(t.categoryLabel, 30),
    isExcluded: Boolean(t.isExcluded),
    note: cleanText(t.transactionCustomerComment, 80),
    sequenceName: cleanText(t.sequenceName, 60),
  };
}

export const isSpend = (t) => !t.isIncome && !t.isExcluded;

export function brief(t) {
  const out = { date: t.date, merchant: t.merchant, amount: t.amount, account: t.account, source: t.source, month: t.month };
  if (t.isInstallment) out.installment = `${t.installmentNumber}/${t.totalInstallments}`;
  if (t.billingDate && t.billingDate !== t.date) out.billingDate = t.billingDate;
  return out;
}

const byDate = (a, b) => (a.date ?? '').localeCompare(b.date ?? '');

// ---------------------------------------------------------------------------
// Budget status for one cashflow month (get_budget output).

function envelopeSums(envelope) {
  let expense = 0;
  let income = 0;
  for (const actual of envelope.actuals ?? []) {
    if (actual.isIncome) income += Number(actual.incomeAmount ?? 0);
    else expense += Number(actual.billingAmount ?? 0);
  }
  return { expense: round2(expense), income: round2(income), count: (envelope.actuals ?? []).length };
}

function envelopeName(envelope) {
  if (envelope.type === 'trackingCategory') {
    const raw = envelope.details?.trackingCategory?.name;
    const display = raw === '__saving-hidden-category__' ? 'השקעה וחיסכון' : raw === 'כלכלה' ? 'סופר' : raw;
    return cleanText(display, 40) ?? 'קטגוריה';
  }
  const names = [...new Set((envelope.actuals ?? []).map((a) => cleanText(a.businessName, 40)).filter(Boolean))];
  return names.length ? names.slice(0, 2).join(' / ') : null;
}

export function budgetStatus(budget) {
  const updated = dateOnly(budget.lastUpdatedAt);
  const fixedIncome = { planned: 0, arrived: 0, pending: 0, missed: [] };
  const fixedExpense = { planned: 0, arrived: 0, pending: 0, missed: [] };
  const tracking = [];
  let variableExpense = 0;
  let variableIncome = 0;
  let goal = 0;
  const deviations = [];

  for (const envelope of budget.envelopes ?? []) {
    const sums = envelopeSums(envelope);
    const name = envelopeName(envelope);
    if (envelope.type === 'fixed') {
      const plan = Number(envelope.originalAmount ?? 0);
      const isIncome = plan < 0 || (plan === 0 && sums.income > sums.expense);
      const planned = Math.abs(plan);
      const actual = round2(isIncome ? sums.income - sums.expense : sums.expense - sums.income);
      const due = dateOnly(envelope.balanceDate);
      const bucket = isIncome ? fixedIncome : fixedExpense;
      bucket.planned += planned;
      if (sums.count > 0) {
        bucket.arrived += actual;
        const diff = round2(isIncome ? planned - actual : actual - planned);
        if (diff >= Math.max(1, planned * 0.03)) {
          deviations.push({ kind: isIncome ? 'income-short' : 'fixed-over', name, planned, actual, diff });
        }
      } else if (due && updated && due < updated) {
        bucket.missed.push({ name, planned, due });
        if (isIncome) deviations.push({ kind: 'income-missing', name, planned, actual: 0, diff: planned, due });
      } else {
        bucket.pending += planned;
      }
    } else if (envelope.type === 'trackingCategory') {
      const target = Number(envelope.originalAmount ?? 0);
      const actual = round2(sums.expense - sums.income);
      const item = {
        name,
        target,
        actual,
        left: round2(Math.max(0, target - actual)),
        over: round2(Math.max(0, actual - target)),
        targetSetByUser: Boolean(envelope.isCustomPrediction),
      };
      const week = envelope.details?.startDate ?? envelope.startDate;
      if (week) item.weekStart = dateOnly(week);
      tracking.push(item);
      if (item.over >= 1) deviations.push({ kind: 'tracking-over', name, planned: target, actual, diff: item.over });
    } else if (envelope.type === 'variable') {
      variableExpense += sums.expense - sums.income;
    } else if (envelope.type === 'variableIncome') {
      variableIncome += sums.income - sums.expense;
    } else if (envelope.type === 'riseupGoal') {
      goal += Math.max(0, Number(envelope.originalAmount ?? 0));
    }
  }

  for (const bucket of [fixedIncome, fixedExpense]) {
    for (const key of ['planned', 'arrived', 'pending']) bucket[key] = round2(bucket[key]);
  }
  const trackingExpected = sum(tracking.map((t) => Math.max(t.target, t.actual)));
  // Weekly categories arrive as one envelope per week; show them per category.
  const trackingByName = new Map();
  for (const item of tracking) {
    const entry = trackingByName.get(item.name) ?? { name: item.name, target: 0, actual: 0, left: 0, over: 0, weeks: 0, targetSetByUser: item.targetSetByUser };
    entry.target = round2(entry.target + item.target);
    entry.actual = round2(entry.actual + item.actual);
    entry.left = round2(entry.left + item.left);
    entry.over = round2(entry.over + item.over);
    if (item.weekStart) entry.weeks++;
    trackingByName.set(item.name, entry);
  }
  const trackingSummary = [...trackingByName.values()];
  const otherDeviations = deviations.filter((d) => d.kind !== 'tracking-over');
  const trackingDeviations = trackingSummary
    .filter((t) => t.over >= 1)
    .map((t) => ({ kind: 'tracking-over', name: t.name, planned: t.target, actual: t.actual, diff: t.over }));
  const expectedIncome = round2(fixedIncome.arrived + fixedIncome.pending + variableIncome);
  const expectedFixed = round2(fixedExpense.arrived + fixedExpense.pending);
  const remaining = round2(expectedIncome - expectedFixed - trackingExpected - variableExpense - goal);

  return {
    budgetDate: budget.budgetDate,
    lastUpdatedAt: budget.lastUpdatedAt,
    remaining,
    breakdown: {
      expectedIncome,
      fixedIncomeArrived: fixedIncome.arrived,
      fixedIncomePending: fixedIncome.pending,
      variableIncome: round2(variableIncome),
      expectedFixedExpenses: expectedFixed,
      fixedExpensesArrived: fixedExpense.arrived,
      fixedExpensesPending: fixedExpense.pending,
      trackingExpected,
      trackingLeft: sum(tracking.map((t) => t.left)),
      variableExpenseSoFar: round2(variableExpense),
      savingsGoal: round2(goal),
    },
    formula: 'remaining = expectedIncome - expectedFixedExpenses - trackingExpected - variableExpenseSoFar - savingsGoal; arrived items count at their actual amount, pending items at their plan, items whose due date passed without arriving count as 0; each tracking category counts at max(target, actual)',
    tracking: trackingSummary,
    missed: { income: fixedIncome.missed, expenses: fixedExpense.missed },
    topDeviations: [...otherDeviations, ...trackingDeviations].sort((a, b) => b.diff - a.diff).slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Monthly review: the last full cashflow month vs. the month before it.

export function monthlyReview({ month, previousMonth, byMonth, lookback, cancelled = [], thresholds = THRESHOLDS }) {
  const current = (byMonth[month] ?? []).filter(isSpend);
  const previous = (byMonth[previousMonth] ?? []).filter(isSpend);
  const prior = lookback.flatMap((m) => byMonth[m] ?? []).filter(isSpend);
  const priorKeys = new Set(prior.map((t) => t.key));
  const priorCommitments = new Set(prior.map((t) => t.commitmentId).filter(Boolean));
  const findings = [];
  const take = (list) => list.sort(byDate).slice(0, thresholds.findingTransactions).map(brief);
  const add = (type, fields, transactions) => findings.push({ type, ...fields, transactions: take(transactions), ...GUIDANCE[type] });

  // 1. New charges.
  const reportedKeys = new Set();
  const newCommitments = groupBy(current.filter((t) => t.commitmentId && !t.isInstallment), (t) => t.commitmentId);
  for (const [commitmentId, list] of newCommitments) {
    if (priorCommitments.has(commitmentId) || list.some((t) => priorKeys.has(t.key))) continue;
    add('new-recurring', { merchant: list[0].merchant, total: sum(list.map((t) => t.amount)) }, list);
    list.forEach((t) => reportedKeys.add(t.key));
  }
  for (const t of current.filter((x) => x.isInstallment && x.installmentNumber === 1)) {
    add('new-installments', {
      merchant: t.merchant,
      perPayment: t.amount,
      payments: t.totalInstallments,
      total: t.totalInstallments ? round2(t.amount * t.totalInstallments) : null,
    }, [t]);
    reportedKeys.add(t.key);
  }
  const newMerchants = groupBy(current.filter((t) => !t.isInstallment && !priorKeys.has(t.key) && !reportedKeys.has(t.key)), (t) => t.key);
  const largeNew = [];
  const abroad = new Map();
  for (const [, list] of newMerchants) {
    const total = sum(list.map((t) => t.amount));
    const country = foreignCountry(list[0].merchant);
    if (SUBSCRIPTION_HINTS.test(list[0].merchant)) add('new-subscription-like', { merchant: list[0].merchant, total }, list);
    else if (country) abroad.set(country, [...(abroad.get(country) ?? []), ...list]);
    else if (total >= thresholds.newMerchantMin) largeNew.push({ list, total });
  }
  // New merchants in one foreign country (usually a trip) become one finding.
  for (const [country, list] of abroad) {
    const total = sum(list.map((t) => t.amount));
    if (total < thresholds.newMerchantMin) continue;
    findings.push({
      type: 'new-abroad',
      country,
      merchants: new Set(list.map((t) => t.key)).size,
      charges: list.length,
      total,
      transactions: [...list].sort((a, b) => b.amount - a.amount).slice(0, thresholds.findingTransactions).map(brief),
      ...GUIDANCE['new-abroad'],
    });
  }
  largeNew
    .sort((a, b) => b.total - a.total)
    .slice(0, thresholds.newMerchantTop)
    .forEach(({ list, total }) => add('new-large', { merchant: list[0].merchant, total }, list));

  // 2. Price increases: one charge in each month, by commitment first, then by
  // merchant. Usage-based bills (public transport, electricity) change every
  // month, so a rise counts only when the old price held for two months in a row.
  const monthlyAmounts = (list) => [...groupBy(list, (t) => t.month)]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, items]) => sum(items.map((t) => t.amount)));
  const heldSteady = (priorList) => {
    const amounts = monthlyAmounts(priorList);
    return amounts.length < 2 || Math.abs(amounts[0] - amounts[1]) <= 0.02 * Math.abs(amounts[1]);
  };
  const isIncrease = (from, to, priorList) => to - from >= thresholds.priceChangeMin
    && percentChange(from, to) >= thresholds.priceChangePct
    && heldSteady(priorList);
  const priorNonInstallment = prior.filter((t) => !t.isInstallment);
  const compared = new Set();
  const curByCommitment = groupBy(current.filter((t) => t.commitmentId && !t.isInstallment), (t) => t.commitmentId);
  const prevByCommitment = groupBy(previous.filter((t) => t.commitmentId && !t.isInstallment), (t) => t.commitmentId);
  for (const [commitmentId, list] of curByCommitment) {
    const before = prevByCommitment.get(commitmentId);
    if (!before || list.length !== 1 || before.length !== 1) continue;
    compared.add(list[0].key);
    if (isIncrease(before[0].amount, list[0].amount, priorNonInstallment.filter((t) => t.commitmentId === commitmentId))) {
      add('price-increase', {
        merchant: list[0].merchant,
        from: before[0].amount,
        to: list[0].amount,
        changePct: percentChange(before[0].amount, list[0].amount),
      }, [before[0], list[0]]);
    }
  }
  const curByKey = groupBy(current.filter((t) => !t.isInstallment), (t) => t.key);
  const prevByKey = groupBy(previous.filter((t) => !t.isInstallment), (t) => t.key);
  for (const [key, list] of curByKey) {
    const before = prevByKey.get(key);
    if (compared.has(key) || !before || list.length !== 1 || before.length !== 1) continue;
    if (isIncrease(before[0].amount, list[0].amount, priorNonInstallment.filter((t) => t.key === key))) {
      add('price-increase', {
        merchant: list[0].merchant,
        from: before[0].amount,
        to: list[0].amount,
        changePct: percentChange(before[0].amount, list[0].amount),
      }, [before[0], list[0]]);
    }
  }

  // 3. Suspected duplicates in the reviewed month.
  const keyCounts = countBy(current, (t) => t.key);
  // Two cash withdrawals of the same amount are normal, so they are skipped.
  const sameCharge = groupBy(
    current.filter((t) => !t.isInstallment && t.amount >= thresholds.duplicateMin && !CASH_WORDS.test(t.merchant)),
    (t) => `${t.key}|${t.account}|${t.amount}`,
  );
  let duplicates = 0;
  for (const [, list] of sameCharge) {
    if (list.length < 2) continue;
    list.sort(byDate);
    for (let i = 1; i < list.length; i++) {
      const gap = Math.abs(daysBetween(list[i - 1].date, list[i].date));
      const frequent = keyCounts.get(list[i].key) >= thresholds.frequentMerchantCount;
      const ok = frequent ? gap === 0 && list[i].amount >= thresholds.frequentDuplicateMin : gap <= thresholds.duplicateMaxDays;
      if (ok && duplicates < 10) {
        add('duplicate', { merchant: list[i].merchant, amount: list[i].amount, daysApart: gap, confidence: gap === 0 ? 'high' : 'medium' }, [list[i - 1], list[i]]);
        duplicates++;
      }
    }
  }
  // A commitment charged once in every earlier month but twice now.
  const priorByCommitment = groupBy(prior.filter((t) => t.commitmentId && !t.isInstallment), (t) => t.commitmentId);
  for (const [commitmentId, list] of curByCommitment) {
    if (list.length < 2) continue;
    const earlier = priorByCommitment.get(commitmentId) ?? [];
    const perMonth = countBy(earlier, (t) => t.month);
    if (perMonth.size >= 2 && [...perMonth.values()].every((n) => n === 1)) {
      add('double-recurring', { merchant: list[0].merchant, charges: list.length, total: sum(list.map((t) => t.amount)) }, list);
    }
  }

  // 4. Charges after cancellation: RiseUp comments that mention a cancellation,
  // or merchants the user named as cancelled.
  const cancelledKeys = cancelled.map(merchantKey).filter(Boolean);
  const afterCancel = groupBy(
    current.filter((t) => CANCEL_WORDS.test(t.note ?? '') || CANCEL_WORDS.test(t.sequenceName ?? '') || cancelledKeys.some((k) => t.key.includes(k))),
    (t) => t.key,
  );
  for (const [, list] of afterCancel) {
    add('after-cancellation', { merchant: list[0].merchant, total: sum(list.map((t) => t.amount)) }, list);
  }

  return {
    month,
    previousMonth,
    lookbackMonths: lookback,
    counts: { reviewedTransactions: current.length, previousTransactions: previous.length },
    totals: {
      month: sum(current.map((t) => t.amount)),
      previousMonth: sum(previous.map((t) => t.amount)),
    },
    findings,
    thresholds,
    cancellationSignals: cancelledKeys.length ? 'comments + user list' : 'RiseUp comments only',
  };
}

// ---------------------------------------------------------------------------
// Recurring charges over a window of cashflow months.

function priceLevels(charges) {
  const levels = [];
  for (const charge of charges) {
    const last = levels.at(-1);
    if (last && Math.abs(charge.amount - last.ref) <= Math.max(0.25 * last.ref, 3)) {
      last.charges.push(charge);
      last.ref = median(last.charges.map((c) => c.amount));
    } else {
      levels.push({ ref: charge.amount, charges: [charge] });
    }
  }
  return levels;
}

function frequencyOf(gaps) {
  const gap = median(gaps);
  if (gap === null) return null;
  return FREQUENCIES.find((f) => gap >= f.min && gap <= f.max) ?? null;
}

const CASH_WORDS = /כספומט|משיכה|מזומן|\batm\b|cash/i;

const similarAmount = (a, b) => {
  const ma = median(a.map((t) => t.amount));
  const mb = median(b.map((t) => t.amount));
  return Math.abs(ma - mb) <= 0.25 * Math.max(ma, mb);
};
const firstDate = (list) => list.reduce((d, t) => (t.date < d ? t.date : d), list[0].date);
const lastDate = (list) => list.reduce((d, t) => (t.date > d ? t.date : d), list[0].date);

export function detectRecurring(transactions, { months, today, thresholds = THRESHOLDS }) {
  const spend = transactions.filter((t) => isSpend(t) && !t.isInstallment && t.amount >= 0.5 && t.date);
  const groups = new Map();
  for (const t of spend) {
    const key = t.commitmentId ? `c:${t.commitmentId}` : `m:${t.key}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  // Charges from before RiseUp recognized a commitment join that commitment
  // when the merchant matches and the amount is close.
  for (const [key, list] of [...groups]) {
    if (!key.startsWith('m:')) continue;
    const target = [...groups].find(([k, l]) => k.startsWith('c:') && l[0].key === list[0].key && similarAmount(l, list));
    if (target) {
      target[1].push(...list);
      groups.delete(key);
    }
  }
  // RiseUp sometimes re-detects the same commitment under a new id. Merge
  // same-merchant, similar-amount commitments when one ends before the other starts.
  let merged = true;
  while (merged) {
    merged = false;
    const entries = [...groups].filter(([k]) => k.startsWith('c:'));
    for (let i = 0; i < entries.length && !merged; i++) {
      for (let j = i + 1; j < entries.length && !merged; j++) {
        const [ka, a] = entries[i];
        const [kb, b] = entries[j];
        if (a[0].key !== b[0].key || !similarAmount(a, b)) continue;
        const sequential = daysBetween(lastDate(a), firstDate(b)) >= -10 || daysBetween(lastDate(b), firstDate(a)) >= -10;
        if (!sequential) continue;
        groups.set(ka, [...a, ...b]);
        groups.delete(kb);
        merged = true;
      }
    }
  }
  const groupsPerMerchant = new Map();
  for (const [key, list] of groups) {
    if (key.startsWith('c:')) groupsPerMerchant.set(list[0].key, (groupsPerMerchant.get(list[0].key) ?? 0) + 1);
  }

  const results = [];
  for (const [key, list] of groups) {
    const charges = [...list].sort(byDate);
    const isCommitment = key.startsWith('c:');
    if (charges.length < 2) continue;
    const gaps = [];
    for (let i = 1; i < charges.length; i++) gaps.push(daysBetween(charges[i - 1].date, charges[i].date));
    let frequency = frequencyOf(gaps.filter((g) => g > 0));
    const levels = priceLevels(charges);
    const distinctMonths = new Set(charges.map((c) => c.month)).size;
    if (!isCommitment) {
      // Without RiseUp's commitment flag, demand a clear pattern: at least three
      // charges at a steady price, and no cash withdrawals.
      // Thresholds follow common practice (e.g. Plaid treats a stream as mature
      // after 3 charges): a steady price on most charges, and most gaps in the band.
      const typical = median(charges.map((c) => c.amount));
      const steadyShare = charges.filter((c) => Math.abs(c.amount - typical) <= 0.1 * typical).length / charges.length;
      const gapShare = frequency ? gaps.filter((g) => g >= frequency.min && g <= frequency.max).length / gaps.length : 0;
      if (!frequency || charges.length < Math.max(3, frequency.minCount) || levels.length > 2 || steadyShare < 0.75 || gapShare < 0.8) continue;
      if (CASH_WORDS.test(charges[0].merchant)) continue;
      if (frequency.id === 'monthly' && (distinctMonths < 3 || charges.length / distinctMonths > 1.34)) continue;
    } else if (frequency && charges.length < frequency.minCount) {
      frequency = null;
    }

    // A price change counts when the new amount held on the next charge (or is
    // the latest one); one-off blips are left out.
    const changes = [];
    for (let i = 1; i < charges.length; i++) {
      const from = charges[i - 1].amount;
      const to = charges[i].amount;
      const held = i === charges.length - 1 || Math.abs(charges[i + 1].amount - to) <= 0.02 * to;
      if (held && Math.abs(to - from) >= thresholds.priceChangeMin && Math.abs(percentChange(from, to)) >= thresholds.priceChangePct) {
        changes.push({ date: charges[i].date, from, to, changePct: percentChange(from, to) });
      }
    }
    const signFlips = changes.filter((c, i) => i > 0 && Math.sign(c.changePct) !== Math.sign(changes[i - 1].changePct)).length;
    const last = charges.at(-1);
    // The current price: charges since the last lasting change, unless the amount
    // just fluctuates (foreign currency), in which case the overall median.
    const sinceChange = signFlips < 2 && changes.length ? charges.filter((c) => c.date >= changes.at(-1).date) : charges;
    const currentPrice = median(sinceChange.map((c) => c.amount));
    const perMonth = frequency ? frequency.perMonth : charges.length / months.length;
    const periodDays = frequency ? Math.round(30.4 / frequency.perMonth) : null;
    const daysSinceLast = today ? daysBetween(last.date, today) : null;
    // high: a clear period at a steady price. low: RiseUp marked it as fixed, but
    // it has neither a period nor a steady price (often one-off shopping).
    const steady = levels.length <= 2;
    const confidence = frequency && steady ? 'high' : frequency || steady ? 'medium' : 'low';
    results.push({
      merchant: last.merchant,
      confidence,
      frequency: frequency?.label ?? 'לא סדיר',
      detectedBy: isCommitment ? 'riseup-commitment' : 'pattern',
      charges: charges.length,
      lastAmount: last.amount,
      typicalAmount: round2(median(charges.map((c) => c.amount))),
      currentPrice: round2(currentPrice),
      monthlyEquivalent: round2(currentPrice * perMonth),
      firstDate: charges[0].date,
      firstMonth: charges[0].month,
      startedBeforeWindow: charges[0].month === months[0],
      lastDate: last.date,
      possiblyEnded: periodDays !== null && daysSinceLast !== null && daysSinceLast > periodDays * 1.5 + 5,
      priceChanges: signFlips >= 2 ? [] : changes,
      fluctuatingAmount: signFlips >= 2,
      accounts: [...new Set(charges.map((c) => c.account).filter(Boolean))],
      category: last.category,
      parallelCommitments: isCommitment ? groupsPerMerchant.get(last.key) : undefined,
    });
  }
  return results.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}

// ---------------------------------------------------------------------------
// Variable (non-fixed) spending per month, split by how fast it hits the bank.

// Single charges at or above `largeThreshold` (transfers to savings, loan
// repayments, one-off purchases) are left out of the run rate and listed apart,
// because one of them would distort a three-month average.
export function variableSpendingStats(byMonth, months, { largeThreshold = 1500 } = {}) {
  const large = [];
  const perMonth = months.map((month) => {
    const all = (byMonth[month] ?? []).filter((t) => isSpend(t) && !t.isInstallment && t.actualType !== 'fixed' && !t.commitmentId);
    const list = all.filter((t) => t.amount < largeThreshold);
    large.push(...all.filter((t) => t.amount >= largeThreshold));
    const card = sum(list.filter((t) => t.sourceType === 'creditCard').map((t) => t.amount));
    const total = sum(list.map((t) => t.amount));
    return { month, total, card, bankDirect: round2(total - card) };
  });
  const avg = (key) => round2(perMonth.reduce((a, m) => a + m[key], 0) / Math.max(1, perMonth.length));
  return {
    months: perMonth,
    average: { total: avg('total'), card: avg('card'), bankDirect: avg('bankDirect') },
    largeThreshold,
    excludedLarge: {
      count: large.length,
      total: sum(large.map((t) => t.amount)),
      top: [...large].sort((a, b) => b.amount - a.amount).slice(0, 5).map(brief),
    },
  };
}

// ---------------------------------------------------------------------------
// Organized month summary: income, spending by category, business vs. personal,
// changes against the average of earlier months, and the monthly surplus.

const SAVING_CATEGORIES = new Set(['השקעה וחיסכון', '__saving-hidden-category__']);

export function displayCategory(label) {
  if (!label) return 'ללא קטגוריה';
  if (label === 'כלכלה') return 'סופר';
  if (label === '__saving-hidden-category__') return 'השקעה וחיסכון';
  return label;
}

export function isBusiness(t, business) {
  if (!business) return false;
  const text = (patterns, value) => (patterns ?? []).some((p) => p && String(value ?? '').toLowerCase().includes(String(p).toLowerCase()));
  return text(business.categoryPatterns, t.category)
    || text(business.merchantPatterns, t.merchant)
    || (business.accounts ?? []).includes(t.account);
}

function monthTotals(list, business, largeThreshold) {
  const counted = list.filter((t) => !t.isExcluded);
  const income = counted.filter((t) => t.isIncome);
  const spend = counted.filter((t) => !t.isIncome);
  const savings = spend.filter((t) => SAVING_CATEGORIES.has(t.category));
  const consumption = spend.filter((t) => !SAVING_CATEGORIES.has(t.category));
  const businessSpend = consumption.filter((t) => isBusiness(t, business));
  const byCategory = {};
  for (const t of consumption) {
    const name = displayCategory(t.category);
    byCategory[name] = round2((byCategory[name] ?? 0) + t.amount);
  }
  const large = consumption.filter((t) => t.amount >= largeThreshold);
  const uncategorized = groupBy(consumption.filter((t) => !t.category || t.category === 'אחר'), (t) => t.key);
  return {
    income: sum(income.map((t) => t.amount)),
    spending: sum(consumption.map((t) => t.amount)),
    largeTotal: sum(large.map((t) => t.amount)),
    uncategorizedTop: [...uncategorized.values()]
      .map((list) => ({ merchant: list[0].merchant, charges: list.length, amount: sum(list.map((t) => t.amount)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    savings: sum(savings.map((t) => t.amount)),
    fixed: sum(consumption.filter((t) => t.actualType === 'fixed' || t.commitmentId).map((t) => t.amount)),
    installments: sum(consumption.filter((t) => t.isInstallment).map((t) => t.amount)),
    large,
    business: businessSpend,
    byCategory,
    incomeBySource: income,
  };
}

export function monthSummary({ month, byMonth, averageMonths, business = null, largeThreshold = 1500, planMonthly = 0 }) {
  const current = monthTotals(byMonth[month] ?? [], business, largeThreshold);
  const earlier = averageMonths.map((m) => monthTotals(byMonth[m] ?? [], business, largeThreshold));
  const avg = (fn) => round2(earlier.reduce((a, t) => a + fn(t), 0) / Math.max(1, earlier.length));

  const categories = Object.entries(current.byCategory)
    .map(([name, amount]) => {
      const average = avg((t) => t.byCategory[name] ?? 0);
      const changePct = average ? percentChange(average, amount) : null;
      return { name, amount, average, changePct, notable: Math.abs(amount - average) >= 200 && (changePct === null || Math.abs(changePct) >= 25) };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeSources = groupBy(current.incomeBySource, (t) => t.key);
  const surplusPerMonth = earlier.map((t, i) => ({
    month: averageMonths[i],
    surplus: round2(t.income - t.spending),
    withoutLargeCharges: round2(t.income - t.spending + t.largeTotal),
  }));
  const averageSurplus = avg((t) => t.income - t.spending);
  const everydaySurplus = avg((t) => t.income - t.spending + t.largeTotal);

  return {
    month,
    averageOf: averageMonths,
    totals: {
      income: current.income,
      spending: current.spending,
      net: round2(current.income - current.spending),
      savingsTransfers: current.savings,
      netAfterSavings: round2(current.income - current.spending - current.savings),
      fixed: current.fixed,
      variable: round2(current.spending - current.fixed),
      installments: current.installments,
    },
    averages: {
      income: avg((t) => t.income),
      spending: avg((t) => t.spending),
      savingsTransfers: avg((t) => t.savings),
    },
    incomeSources: [...incomeSources.values()]
      .map((list) => ({ source: list[0].merchant, amount: sum(list.map((t) => t.amount)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    categories,
    uncategorizedTop: current.uncategorizedTop,
    largeCharges: {
      threshold: largeThreshold,
      count: current.large.length,
      total: sum(current.large.map((t) => t.amount)),
      top: [...current.large].sort((a, b) => b.amount - a.amount).slice(0, 3).map(brief),
    },
    business: business
      ? {
        name: business.name,
        configured: Boolean((business.categoryPatterns ?? []).length || (business.merchantPatterns ?? []).length || (business.accounts ?? []).length),
        count: current.business.length,
        total: sum(current.business.map((t) => t.amount)),
        transactions: [...current.business].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map(brief),
        averageTotal: avg((t) => sum(t.business.map((x) => x.amount))),
      }
      : null,
    surplus: {
      perMonth: surplusPerMonth,
      average: averageSurplus,
      averageWithoutLargeCharges: everydaySurplus,
      planMonthly: planMonthly || null,
      averageAfterPlan: planMonthly ? round2(averageSurplus - planMonthly) : null,
      withoutLargeChargesAfterPlan: planMonthly ? round2(everydaySurplus - planMonthly) : null,
      note: `surplus = income - spending (savings transfers are not spending). withoutLargeCharges adds back single charges of ${largeThreshold} ILS or more. Averages are over averageOf.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Calibration: suggests personal thresholds from a user's single charges.

export function suggestThresholds(transactions) {
  const amounts = transactions
    .filter((t) => isSpend(t) && !t.isInstallment && !t.commitmentId && t.amount > 0)
    .map((t) => t.amount)
    .sort((a, b) => a - b);
  if (amounts.length < 30) return { enoughData: false, charges: amounts.length, suggested: {} };
  const p90 = amounts[Math.floor(0.9 * (amounts.length - 1))];
  const newMerchantMin = Math.max(100, Math.round(p90 / 50) * 50);
  return {
    enoughData: true,
    charges: amounts.length,
    basis: 'newMerchantMin = 90th percentile of single charges, rounded to 50 ILS (at least 100)',
    suggested: { newMerchantMin, duplicateMin: THRESHOLDS.duplicateMin, priceChangePct: THRESHOLDS.priceChangePct },
  };
}

// ---------------------------------------------------------------------------
// Mortgage summary (get_mortgages_data output).

export function mortgageSummary(data) {
  if (!data?.hasMortgageData) {
    return {
      hasMortgageData: false,
      paymentsCashflowMonth: data?.paymentsCashflowMonth ?? null,
      mortgagePaymentsInCashflow: data?.mortgagePaymentsInCashflow ?? 0,
    };
  }
  const parts = data.parts ?? [];
  const total = sum(parts.map((p) => p.remainingAmount));
  const byType = {};
  for (const part of parts) {
    byType[part.mortgageType] = round2((byType[part.mortgageType] ?? 0) + part.remainingAmount);
  }
  const share = Object.fromEntries(Object.entries(byType).map(([type, amount]) => [type, total ? round2((amount / total) * 100) : null]));
  const withMonths = parts.filter((p) => p.remainingMonths);
  const weightedMonths = withMonths.length
    ? Math.round(withMonths.reduce((a, p) => a + p.remainingMonths * p.remainingAmount, 0) / sum(withMonths.map((p) => p.remainingAmount)))
    : null;
  return {
    hasMortgageData: true,
    monthlyPayment: data.monthlyPayment,
    totalRemainingAmount: data.totalRemainingAmount,
    remainingPrincipalAmount: data.remainingPrincipalAmount,
    remainingInterestAmount: data.remainingInterestAmount,
    interestShareOfRemaining: data.totalRemainingAmount ? round2((data.remainingInterestAmount / data.totalRemainingAmount) * 100) : null,
    paymentsCashflowMonth: data.paymentsCashflowMonth,
    mortgagePaymentsInCashflow: data.mortgagePaymentsInCashflow,
    paymentGapVsPlan: data.monthlyPayment && data.hasMortgagePaymentsInCashflow
      ? round2(data.mortgagePaymentsInCashflow - data.monthlyPayment)
      : null,
    parts: parts.map((p) => ({
      type: p.mortgageType,
      remainingAmount: p.remainingAmount,
      remainingMonths: p.remainingMonths,
      shareOfTotal: total ? round2((p.remainingAmount / total) * 100) : null,
      interestRates: p.interestRates ?? null,
    })),
    shareByType: share,
    weightedRemainingMonths: weightedMonths,
    riseupSavingsPotential: data.riseupSavingsPotential ?? null,
  };
}

// ---------------------------------------------------------------------------

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) map.set(keyFn(item), (map.get(keyFn(item)) ?? 0) + 1);
  return map;
}
