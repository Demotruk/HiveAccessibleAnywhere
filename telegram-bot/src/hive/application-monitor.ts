/**
 * Issuer application monitor.
 *
 * Streams recent Hive blocks looking for `propolis_issuer_apply` custom_json
 * operations targeting the operator's service account.  When a new application
 * is found, sends a Telegram notification to the operator.
 *
 * Unlike the transfer monitor (which polls account history), this must stream
 * blocks because custom_json ops only appear in the *signer's* account history,
 * not the target service account's.
 */

import { config as hiveTxConfig } from 'hive-tx';
import type Database from 'better-sqlite3';
import type { Bot } from 'grammy';
import { getConfigValue, setConfigValue } from '../db.js';
import type { BotConfig } from '../config.js';

const POLL_INTERVAL_MS = 15_000;
const MAX_BLOCKS_PER_POLL = 20;
const CONFIG_KEY = 'application_monitor_last_block';

interface DynamicGlobalProperties {
  head_block_number: number;
}

interface HiveBlock {
  transactions: Array<{
    operations: Array<[string, Record<string, string>]>;
  }>;
}

interface IssuerApplication {
  service: string;
  description?: string;
  contact?: string;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const node = hiveTxConfig.nodes![0];
  const resp = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await resp.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

async function getHeadBlockNumber(): Promise<number> {
  const props = await rpcCall<DynamicGlobalProperties>(
    'condenser_api.get_dynamic_global_properties',
    [],
  );
  return props.head_block_number;
}

async function getBlock(blockNum: number): Promise<HiveBlock | null> {
  return rpcCall<HiveBlock | null>('condenser_api.get_block', [blockNum]);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNotification(applicant: string, app: IssuerApplication): string {
  let msg = `<b>New issuer application</b>\n\n`;
  msg += `<b>@${escapeHtml(applicant)}</b> wants to become an issuer on your service.`;

  if (app.description) {
    msg += `\n\nDescription: "${escapeHtml(app.description)}"`;
  }
  if (app.contact) {
    msg += `\nContact: ${escapeHtml(app.contact)}`;
  }

  msg += `\n\n<a href="https://peakd.com/@${encodeURIComponent(applicant)}">View profile</a>`;
  return msg;
}

async function pollBlocks(bot: Bot, db: Database.Database, config: BotConfig): Promise<void> {
  try {
    const headBlock = await getHeadBlockNumber();

    // Read persisted cursor
    const stored = getConfigValue(db, CONFIG_KEY);
    let lastProcessed = stored ? parseInt(stored, 10) : 0;

    // First run: start from head block (don't notify on historical applications)
    if (lastProcessed === 0) {
      setConfigValue(db, CONFIG_KEY, String(headBlock));
      console.log(`Application monitor initialized at block ${headBlock}`);
      return;
    }

    // Nothing new
    if (headBlock <= lastProcessed) return;

    // Cap blocks per cycle to avoid hammering the node after downtime
    const startBlock = lastProcessed + 1;
    const endBlock = Math.min(headBlock, lastProcessed + MAX_BLOCKS_PER_POLL);

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      const block = await getBlock(blockNum);
      if (!block) continue;

      for (const tx of block.transactions) {
        for (const [opType, opData] of tx.operations) {
          if (opType !== 'custom_json') continue;
          if (opData.id !== 'propolis_issuer_apply') continue;

          let app: IssuerApplication;
          try {
            app = JSON.parse(opData.json) as IssuerApplication;
          } catch {
            continue;
          }

          if (app.service !== config.hiveAccount) continue;

          // Extract applicant from required_auths
          const requiredAuths = opData.required_auths;
          const applicant =
            typeof requiredAuths === 'string'
              ? JSON.parse(requiredAuths)[0]
              : Array.isArray(requiredAuths)
                ? requiredAuths[0]
                : undefined;

          if (!applicant) continue;

          console.log(`New issuer application from @${applicant} (block ${blockNum})`);

          try {
            await bot.api.sendMessage(config.operatorTelegramId, formatNotification(applicant, app), {
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
            });
          } catch (err) {
            console.error(`Failed to send application notification for @${applicant}:`, err);
          }
        }
      }
    }

    // Persist cursor
    setConfigValue(db, CONFIG_KEY, String(endBlock));
  } catch (err) {
    console.error('Application monitor poll error:', err);
  }
}

export function startApplicationMonitor(bot: Bot, db: Database.Database, config: BotConfig): void {
  // Initialize on first poll (async, non-blocking)
  pollBlocks(bot, db, config).catch(err =>
    console.error('Failed to initialize application monitor:', err),
  );

  setInterval(() => pollBlocks(bot, db, config), POLL_INTERVAL_MS);

  console.log(`Application monitor started (polling every ${POLL_INTERVAL_MS / 1000}s)`);
}
