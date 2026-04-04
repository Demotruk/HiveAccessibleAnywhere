/**
 * Account history monitor.
 *
 * Polls each watched account's history for operations outside the
 * expected set (create_claimed_account, delegate_vesting_shares).
 * Alerts via Telegram when unexpected operations are detected.
 */

import type { MonitorConfig } from './config.js';
import { ALLOWED_OPERATIONS } from './config.js';
import type { StateMap } from './state.js';
import { saveState } from './state.js';
import { sendAlert } from './alert.js';

type HistoryEntry = [number, { op: [string, Record<string, string>]; trx_id: string }];

async function fetchAccountHistory(
  nodes: string[],
  account: string,
  start: number,
  limit: number,
): Promise<HistoryEntry[]> {
  for (const node of nodes) {
    try {
      const resp = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_account_history',
          params: [account, start, limit],
          id: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = await resp.json() as {
        result?: HistoryEntry[];
        error?: { message: string };
      };
      if (json.error) throw new Error(json.error.message);
      return json.result ?? [];
    } catch (err) {
      console.warn(`Node ${node} failed for ${account}: ${(err as Error).message}`);
    }
  }
  throw new Error(`All nodes failed for account ${account}`);
}

/**
 * Initialize state for accounts that don't have a last-seen index yet.
 * Sets the high-water mark to the current latest so we don't alert on
 * historical operations.
 */
export async function initializeState(
  config: MonitorConfig,
  state: StateMap,
): Promise<void> {
  for (const account of config.watchAccounts) {
    if (state[account] !== undefined) continue;

    try {
      const history = await fetchAccountHistory(config.hiveNodes, account, -1, 1);
      if (history.length > 0) {
        state[account] = history[history.length - 1][0];
        console.log(`Initialized ${account} at history index ${state[account]}`);
      } else {
        state[account] = -1;
        console.log(`Initialized ${account} with empty history`);
      }
    } catch (err) {
      console.error(`Failed to initialize state for ${account}: ${(err as Error).message}`);
      state[account] = -1;
    }
  }
  saveState(config.stateFile, state);
}

/**
 * Poll all watched accounts once. Called on each interval tick.
 */
export async function poll(config: MonitorConfig, state: StateMap): Promise<void> {
  for (const account of config.watchAccounts) {
    try {
      const history = await fetchAccountHistory(config.hiveNodes, account, -1, 100);
      const lastSeen = state[account] ?? -1;
      let maxIndex = lastSeen;

      for (const [index, entry] of history) {
        if (index <= lastSeen) continue;
        if (index > maxIndex) maxIndex = index;

        const [opType, opData] = entry.op;
        if (ALLOWED_OPERATIONS.has(opType)) continue;

        console.warn(`ALERT: unexpected ${opType} on ${account} (tx: ${entry.trx_id})`);
        try {
          await sendAlert(
            config.telegramBotToken,
            config.telegramChatId,
            account,
            opType,
            opData,
            entry.trx_id,
          );
        } catch (alertErr) {
          console.error(`Failed to send alert: ${(alertErr as Error).message}`);
        }
      }

      if (maxIndex > lastSeen) {
        state[account] = maxIndex;
        saveState(config.stateFile, state);
      }
    } catch (err) {
      console.error(`Poll error for ${account}: ${(err as Error).message}`);
    }
  }
}
