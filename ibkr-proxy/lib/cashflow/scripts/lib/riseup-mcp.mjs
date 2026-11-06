// Minimal MCP client for the riseup server over stdio, with no dependencies.
//
// Scripts use it to call the same read-only tools that Claude calls, but they
// run the math in code and print only compact summaries. The server command is
// read from .mcp.json, so scripts and Claude always run the same pinned version.
//
// Security: the token is passed to the server process through the environment
// and is never printed. Every error message is redacted before it is shown.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The only tools scripts may call. All of them are read-only.
export const READ_ONLY_TOOLS = new Set([
  'get_budget',
  'get_transactions',
  'get_current_bank_balances_data',
  'get_historical_bank_balances_data',
  'get_future_bank_balances_prediction',
  'get_mortgages_data',
  'get_benchmarks_data',
]);

const PROTOCOL_VERSION = '2025-06-18';
const REQUEST_TIMEOUT_MS = 120_000;

export function redact(value) {
  let text = String(value ?? '');
  const pat = process.env.RISEUP_PAT;
  if (pat && pat.length >= 8) text = text.split(pat).join('[REDACTED]');
  return text.replace(/riseup_pat_[A-Za-z0-9_-]+/g, 'riseup_pat_[REDACTED]');
}

function serverCommand() {
  const config = JSON.parse(readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
  const server = config?.mcpServers?.riseup;
  if (!server?.command) throw new Error('No riseup server in .mcp.json');
  return { command: server.command, args: server.args ?? [] };
}

export class RiseupToolError extends Error {
  constructor(tool, message) {
    super(`${tool}: ${redact(message)}`);
    this.tool = tool;
    this.rawMessage = redact(message);
    this.status = Number(/RiseUp API (\d{3})/.exec(message)?.[1] ?? /\((\d{3})\)/.exec(message)?.[1] ?? 0) || null;
  }
}

// Runs fn(call) with a live server; call(name, args) returns the tool's parsed JSON,
// and call.request(method, params) sends a raw MCP request (used by the bridge).
// `token` overrides RISEUP_PAT for this server only (the bridge passes the
// caller's own token; it never stores one).
export async function withRiseup(fn, { token } = {}) {
  if (process.env.RISEUP_TRANSPORT === 'http') {
    const { withRiseupHttp } = await import('./riseup-http.mjs');
    return withRiseupHttp(fn, { token });
  }
  const pat = token ?? process.env.RISEUP_PAT;
  if (!pat) {
    throw new Error('RISEUP_PAT is not set. Create a token at https://input.riseup.co.il/developer/tokens');
  }
  const { command, args } = serverCommand();
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, RISEUP_PAT: pat } });

  const pending = new Map();
  let nextId = 1;
  let buffer = '';
  let stderrTail = '';
  let exited = false;

  const failAll = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id === undefined || !pending.has(message.id)) continue;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(redact(message.error.message ?? JSON.stringify(message.error))));
      else resolve(message.result);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk).slice(-2000);
  });
  child.on('error', (error) => failAll(new Error(`Could not start the riseup MCP server: ${redact(error.message)}`)));
  child.on('exit', (code) => {
    exited = true;
    failAll(new Error(`The riseup MCP server exited (code ${code}). ${redact(stderrTail.trim()).slice(-500)}`));
  });

  const send = (message) => {
    if (!exited) child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    send({ jsonrpc: '2.0', id, method, params });
  });

  const callOnce = async (name, toolArgs) => {
    const result = await request('tools/call', { name, arguments: toolArgs });
    const text = (result?.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    if (result?.isError) throw new RiseupToolError(name, text);
    try {
      return JSON.parse(text);
    } catch {
      throw new RiseupToolError(name, `Response is not JSON: ${text.slice(0, 200)}`);
    }
  };

  const call = async (name, toolArgs = {}) => {
    if (!READ_ONLY_TOOLS.has(name)) throw new Error(`Tool not allowed: ${name}`);
    try {
      return await callOnce(name, toolArgs);
    } catch (error) {
      // One polite retry on a per-minute rate limit, as the API docs recommend.
      const retryAfter = Number(/retryAfterSeconds"?\s*:\s*(\d+)/.exec(error.message)?.[1]);
      if (error instanceof RiseupToolError && error.status === 429 && retryAfter > 0 && retryAfter <= 65) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return callOnce(name, toolArgs);
      }
      throw error;
    }
  };

  try {
    await request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'riseup-finance-scripts', version: '1.0.0' },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    call.request = request;
    return await fn(call);
  } finally {
    if (!exited) {
      child.stdin.end();
      child.kill('SIGTERM');
    }
  }
}

// Runs async tasks with a concurrency cap, to stay well under 60 requests/minute.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// Shared entry point: prints compact JSON on success (fewer tokens for the
// model; add --pretty for humans), and a redacted error on failure.
export async function runScript(main) {
  try {
    const output = await main();
    process.stdout.write(`${JSON.stringify(output, null, process.argv.includes('--pretty') ? 2 : 0)}\n`);
  } catch (error) {
    const message = redact(error?.message ?? error);
    const hint = /\(401\)|401/.test(message)
      ? ' The token was rejected: it may have expired (tokens last 30 days) or been revoked. Create a new one at https://input.riseup.co.il/developer/tokens'
      : '';
    process.stderr.write(`Error: ${message}${hint}\n`);
    process.exit(1);
  }
}
