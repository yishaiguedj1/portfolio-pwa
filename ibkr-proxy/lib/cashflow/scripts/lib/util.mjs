// Pure helpers: months, dates, money and text. No I/O.

export function addMonths(yyyymm, delta) {
  const [year, month] = yyyymm.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Months from `from` to `to`, inclusive, oldest first.
export function monthRange(from, to) {
  const months = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  return months;
}

export function lastDayOfMonth(yyyymm) {
  const [year, month] = yyyymm.split('-').map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yyyymm}-${String(day).padStart(2, '0')}`;
}

export function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(dateOnly(b)) - Date.parse(dateOnly(a))) / 86_400_000);
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function sum(values) {
  return round2(values.reduce((total, value) => total + (Number(value) || 0), 0));
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Free text from the bank, card company or third parties is untrusted.
// Strip control and direction characters, collapse spaces, cap the length.
export function cleanText(value, maxLength = 60) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

// A grouping key for merchant names: case, punctuation and spacing ignored, and
// tokens with digits dropped (card companies append reference codes and phone
// numbers that change from charge to charge, e.g. "PAYPAL *SPOTIFY*P47C6C 3531...").
export function merchantKey(name) {
  const tokens = String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const words = tokens.filter((token) => !/\d/.test(token));
  return (words.length ? words : tokens).join(' ');
}

// The country code card companies put at the end of foreign merchant names.
export function foreignCountry(name) {
  const last = String(name ?? '').trim().split(/\s+/).at(-1) ?? '';
  return /^[A-Z]{3}$/.test(last) && last !== 'ISR' ? last : null;
}

export function percentChange(from, to) {
  if (!from) return null;
  return round2(((to - from) / Math.abs(from)) * 100);
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

export function todayIsrael() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}
