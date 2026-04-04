/**
 * Key Monitor — entry point.
 *
 * Watches Hive accounts for unexpected operations by a delegated
 * service account and alerts via Telegram.
 */

import 'dotenv/config';
import { loadConfig, ALLOWED_OPERATIONS } from './config.js';
import { loadState, saveState } from './state.js';
import { initializeState, poll } from './monitor.js';

const config = loadConfig();
const state = loadState(config.stateFile);

console.log('Key Monitor starting');
console.log(`  Watching: ${config.watchAccounts.join(', ')}`);
console.log(`  Allowed operations: ${[...ALLOWED_OPERATIONS].join(', ')}`);
console.log(`  Poll interval: ${config.pollIntervalMs}ms`);
console.log(`  Nodes: ${config.hiveNodes.join(', ')}`);
console.log(`  State file: ${config.stateFile}`);

await initializeState(config, state);

const timer = setInterval(() => poll(config, state), config.pollIntervalMs);

function shutdown() {
  console.log('Shutting down...');
  clearInterval(timer);
  saveState(config.stateFile, state);
  console.log('State saved. Goodbye.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Key Monitor running.');
