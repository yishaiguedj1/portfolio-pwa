// Direct read-only HTTP transport to the RiseUp external API, for environments
// that cannot start the stdio MCP server, for example a read-only server container.
// It calls exactly the GET endpoints that @riseup-oss/mcp@0.7.0 calls, and those
// return the API JSON unchanged, so every analysis sees the same shapes.
// Enable it with RISEUP_TRANSPORT=http. withRiseup() picks it up automatically.

import { READ_ONLY_TOOLS, RiseupToolError } from './riseup-mcp.mjs';

const API_BASE = 'https://input.riseup.co.il';
const TIMEOUT_MS = 30_000;

// tool name + MCP arguments -> API path (mirrors src/tools/*.ts of the official server)
export function toolPath(name, args = {}) {
  const q = new URLSearchParams();
  switch (name) {
    case 'get_budget':
      return `/api/external/budget/${encodeURIComponent(String(args.date ?? 'current'))}`;
    case 'get_transactions':
      if (args.cashflowMonth) q.set('cashflowMonth', args.cashflowMonth);
      if (args.transactionDate) q.set('transactionDate', args.transactionDate);
      if (args.businessName) q.set('businessName', args.businessName);
      if (args.maxTransactions !== undefined) q.set('maxTransactions', String(args.maxTransactions));
      return `/api/external/transactions${q.size ? `?${q}` : ''}`;
    case 'get_current_bank_balances_data':
      return '/api/external/balances/current';
    case 'get_historical_bank_balances_data':
      q.set('daysBack', String(args.daysBack));
      return `/api/external/balances/history?${q}`;
    case 'get_future_bank_balances_prediction':
      q.set('futureDateForPrediction', String(args.futureDateForPrediction));
      return `/api/external/future-balances?${q}`;
    case 'get_mortgages_data':
      return '/api/external/mortgages';
    case 'get_benchmarks_data':
      for (const area of args.spendAreas ?? []) q.append('spendAreas', area);
      return `/api/external/benchmarks${q.size ? `?${q}` : ''}`;
    default:
      throw new Error(`Tool not allowed: ${name}`);
  }
}

export async function withRiseupHttp(fn, { token, fetchImpl = globalThis.fetch } = {}) {
  const pat = token ?? process.env.RISEUP_PAT;
  if (!pat) throw new Error('RISEUP_PAT is not set. Create a token at https://input.riseup.co.il/developer/tokens');

  const once = async (name, args) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(`${API_BASE}${toolPath(name, args)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      throw new RiseupToolError(name, `Network error: ${error?.name === 'AbortError' ? 'timeout' : error?.message}`);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401) throw new RiseupToolError(name, 'RiseUp PAT was rejected (401). Token may be expired or revoked.');
    if (response.status === 403) throw new RiseupToolError(name, 'RiseUp PAT lacks the required scope (403).');
    if (!response.ok) throw new RiseupToolError(name, `RiseUp API ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return response.json();
  };

  const call = async (name, args = {}) => {
    if (!READ_ONLY_TOOLS.has(name)) throw new Error(`Tool not allowed: ${name}`);
    try {
      return await once(name, args);
    } catch (error) {
      const retryAfter = Number(/retryAfterSeconds"?\s*:\s*(\d+)/.exec(error.message)?.[1]);
      if (error instanceof RiseupToolError && error.status === 429 && retryAfter > 0 && retryAfter <= 65) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return once(name, args);
      }
      throw error;
    }
  };
  return fn(call);
}
