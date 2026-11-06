#!/usr/bin/env node
// Health check: token present and well formed (never printed), each scope
// works, data is fresh, and the pinned server version is current.

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ROOT, RiseupToolError, redact, runScript, withRiseup } from './lib/riseup-mcp.mjs';
import { dateOnly, daysBetween, todayIsrael } from './lib/util.mjs';

const run = promisify(execFile);

function pinnedVersion() {
  const config = JSON.parse(readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
  const arg = (config?.mcpServers?.riseup?.args ?? []).find((a) => a.startsWith('@riseup-oss/mcp'));
  return /@riseup-oss\/mcp@(\d+\.\d+\.\d+)$/.exec(arg ?? '')?.[1] ?? null;
}

async function latestVersion() {
  try {
    const { stdout } = await run('npm', ['view', '@riseup-oss/mcp', 'version'], { timeout: 30_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function classify(error) {
  const status = error instanceof RiseupToolError ? error.status : null;
  if (status === 401 || /\(401\)/.test(error.message)) return { status: 'fail', code: 401 };
  if (status === 403 || /\(403\)/.test(error.message)) return { status: 'fail', code: 403 };
  if (status === 429) return { status: 'warn', code: 429 };
  return { status: 'fail', code: status, message: redact(error.message).slice(0, 160) };
}

runScript(async () => {
  const today = todayIsrael();
  const checks = [];
  const pat = process.env.RISEUP_PAT ?? '';
  checks.push({ check: 'token-set', status: pat ? 'ok' : 'fail' });
  checks.push({ check: 'token-format', status: pat.startsWith('riseup_pat_') ? 'ok' : 'fail' });

  const created = process.env.RISEUP_PAT_CREATED;
  if (created && /^\d{4}-\d{2}-\d{2}$/.test(created)) {
    const age = daysBetween(created, today);
    checks.push({ check: 'token-age', status: age >= 30 ? 'fail' : age >= 25 ? 'warn' : 'ok', days: age, expiresInDays: 30 - age });
  } else {
    checks.push({ check: 'token-age', status: 'unknown', note: 'Set RISEUP_PAT_CREATED=YYYY-MM-DD (not secret) in the environment to track the 30-day expiry.' });
  }

  const [pinned, latest] = [pinnedVersion(), await latestVersion()];
  checks.push({
    check: 'server-version',
    status: !pinned ? 'warn' : latest && latest !== pinned ? 'warn' : 'ok',
    pinned,
    latest,
    note: latest && pinned && latest !== pinned ? 'A newer version exists. Read its CHANGELOG before changing the pin in .mcp.json.' : undefined,
  });

  if (pat) {
    await withRiseup(async (call) => {
      const probes = [
        ['balances:read', () => call('get_current_bank_balances_data')],
        ['budget:read', () => call('get_budget', { date: 'current' })],
        ['mortgages:read', () => call('get_mortgages_data')],
        ['benchmarks:read', () => call('get_benchmarks_data', { spendAreas: ['eating_out'] })],
      ];
      for (const [scope, probe] of probes) {
        try {
          const result = await probe();
          checks.push({ check: `scope ${scope}`, status: 'ok' });
          if (scope === 'balances:read') {
            for (const b of result.balances ?? []) {
              const days = daysBetween(dateOnly(b.lastUpdated), today);
              checks.push({ check: 'bank-freshness', account: b.accountNumberHash, source: b.source, lastUpdated: b.lastUpdated, days, status: days > 2 ? 'warn' : 'ok' });
            }
          }
          if (scope === 'budget:read') {
            const days = daysBetween(dateOnly(result.lastUpdatedAt), today);
            checks.push({ check: 'budget-freshness', cashflowMonth: result.budgetDate, lastUpdatedAt: result.lastUpdatedAt, days, status: days > 2 ? 'warn' : 'ok' });
          }
        } catch (error) {
          checks.push({ check: `scope ${scope}`, ...classify(error) });
        }
      }
    });
  }

  const worst = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
  return { today, overall: worst, checks, tokensPage: 'https://input.riseup.co.il/developer/tokens' };
});
