import 'dotenv/config';

/**
 * Health-check all proxy endpoints from feed-config.json.
 *
 * Usage:
 *   npx tsx list-proxies.ts [--config feed-config.json]
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// -- Parse args --

const args = process.argv.slice(2);
const configIdx = args.indexOf('--config');
const configPath = configIdx >= 0 ? args[configIdx + 1] : 'feed-config.json';

// -- Load config --

interface FeedConfig {
  endpoints?: string[];
  groups?: Record<string, { endpoints?: string[] }>;
}

let config: FeedConfig;
try {
  const raw = readFileSync(resolve(configPath), 'utf-8');
  config = JSON.parse(raw) as FeedConfig;
} catch (e) {
  console.error(`Failed to read config from ${configPath}:`, (e as Error).message);
  process.exit(1);
}

// -- Collect all unique endpoints --

function collectEndpoints(config: FeedConfig): string[] {
  const set = new Set<string>();
  for (const ep of config.endpoints ?? []) set.add(ep);
  if (config.groups) {
    for (const group of Object.values(config.groups)) {
      for (const ep of group.endpoints ?? []) set.add(ep);
    }
  }
  return [...set];
}

// -- Health check --

interface HealthResult {
  url: string;
  ok: boolean;
  ms: number;
  instance?: string;
  theme?: string;
  error?: string;
}

async function checkHealth(url: string): Promise<HealthResult> {
  const healthUrl = url.replace(/\/+$/, '') + '/health';
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const ms = Date.now() - start;
    if (!response.ok) {
      return { url, ok: false, ms, error: `HTTP ${response.status}` };
    }
    const data = await response.json() as any;
    return {
      url,
      ok: data.status === 'ok',
      ms,
      instance: data.instance,
      theme: data.theme,
    };
  } catch (e) {
    return { url, ok: false, ms: Date.now() - start, error: (e as Error).message };
  }
}

// -- Main --

async function main() {
  const endpoints = collectEndpoints(config);

  if (endpoints.length === 0) {
    console.log('No proxy endpoints found in config.');
    return;
  }

  console.log(`Checking ${endpoints.length} proxy endpoint(s)...\n`);

  const results = await Promise.all(endpoints.map(checkHealth));

  const healthy = results.filter(r => r.ok).length;

  for (const r of results) {
    const status = r.ok ? '\x1b[32m✓ healthy\x1b[0m' : '\x1b[31m✗ down\x1b[0m';
    const detail = r.ok
      ? `(${r.ms}ms, instance: ${r.instance ?? '?'}, theme: ${r.theme ?? '?'})`
      : `(${r.error})`;
    console.log(`  ${r.url}  ${status} ${detail}`);
  }

  console.log(`\n${healthy}/${results.length} proxies healthy.`);

  if (healthy < results.length) {
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
