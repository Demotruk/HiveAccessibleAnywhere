/**
 * State persistence.
 *
 * Tracks the last-seen account history index per watched account
 * in a JSON file so restarts don't re-alert on old operations.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Maps account name → last processed history index */
export type StateMap = Record<string, number>;

export function loadState(filePath: string): StateMap {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as StateMap;
  } catch {
    return {};
  }
}

export function saveState(filePath: string, state: StateMap): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n');
}
