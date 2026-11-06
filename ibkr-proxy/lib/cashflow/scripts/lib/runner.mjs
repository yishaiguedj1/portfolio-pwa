// Integration point for other systems: the planned /api/cashflow/* routes in
// THE SNOWBALL's server, the bridge, or any agent. runReport() runs one report
// script as a child process with the caller's token and returns its JSON, so
// every consumer gets exactly what the CLI and the skills get.
// No shell is involved, and the names and arguments are whitelisted.

import { execFile } from 'node:child_process';
import path from 'node:path';
import { ROOT, redact } from './riseup-mcp.mjs';

export const REPORTS = {
  doctor: 'doctor.mjs',
  snapshot: 'snapshot.mjs',
  month: 'month.mjs',
  'monthly-review': 'monthly-review.mjs',
  subscriptions: 'subscriptions.mjs',
  forecast: 'forecast.mjs',
  mortgage: 'mortgage.mjs',
  accounts: 'accounts.mjs',
};

const SAFE_ARG = /^(--[a-z][a-z-]*|[\p{L}\p{N} ,._:-]{1,100})$/u;

export function reportCommand(name, args = []) {
  const file = REPORTS[name];
  if (!file) throw new Error(`Unknown report: ${name}`);
  if (!Array.isArray(args) || !args.every((a) => typeof a === 'string' && SAFE_ARG.test(a))) {
    throw new Error('Invalid report arguments');
  }
  return [path.join(ROOT, 'scripts', file), ...args];
}

// Network configuration (proxy and CA settings) is not secret, and without it a
// child process behind a proxy cannot reach RiseUp at all.
const NETWORK_VARS = /^(HTTPS?_PROXY|NO_PROXY|https?_proxy|no_proxy|NODE_EXTRA_CA_CERTS|NODE_OPTIONS|NODE_USE_ENV_PROXY|SSL_CERT_FILE|SSL_CERT_DIR|GLOBAL_AGENT_[A-Z_]+)$/;
const networkEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => NETWORK_VARS.test(k)));

// cleanEnv: give the child only what it needs, never the host's other secrets
// (a server passes cleanEnv with transport 'http').
export function runReport(name, args = [], { token, timeoutMs = 180_000, cleanEnv = false, transport } = {}) {
  const argv = reportCommand(name, args);
  const base = cleanEnv
    ? { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TZ: process.env.TZ ?? 'Asia/Jerusalem', ...networkEnv() }
    : { ...process.env };
  const env = { ...base, ...(token ? { RISEUP_PAT: token } : {}), ...(transport ? { RISEUP_TRANSPORT: transport } : {}) };
  return new Promise((resolve, reject) => {
    execFile(process.execPath, argv, { cwd: ROOT, env, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(redact(stderr || error.message).slice(0, 500)));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Report ${name} did not return JSON`));
      }
    });
  });
}
