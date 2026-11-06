// The personal layer: optional files in config/ that make the generic
// framework fit one user. Every script works without them.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './riseup-mcp.mjs';
import { THRESHOLDS } from './analysis.mjs';

export const CONFIG_DIR = path.join(ROOT, 'config');

export function readConfigJson(file) {
  try {
    return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf8'));
  } catch {
    return null;
  }
}

// Defaults from analysis.mjs, overridden by config/thresholds.json. Only known
// numeric keys are taken, so a typo or a bad value can't break an analysis.
export function loadThresholds(overrides = readConfigJson('thresholds.json')) {
  const merged = { ...THRESHOLDS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key in THRESHOLDS && typeof value === 'number' && Number.isFinite(value) && value >= 0) merged[key] = value;
  }
  return merged;
}

export const loadBusiness = () => readConfigJson('business.json');

export const hasProfile = () => existsSync(path.join(CONFIG_DIR, 'profile.md'));
