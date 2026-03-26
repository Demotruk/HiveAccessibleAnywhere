/**
 * /load <batch-id> — Load gift cards from a batch directory (operator only).
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import { loadBatch } from '../inventory.js';

export async function loadCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const batchId = interaction.options.getString('batch_id', true);

  try {
    const { loaded, total } = loadBatch(db, config.giftcardOutputDir, batchId);
    await interaction.reply({
      content: `Loaded ${loaded} new cards from batch "${batchId}" (${total} total in batch, duplicates skipped).`,
      ephemeral: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.reply({ content: `Failed to load batch: ${msg}`, ephemeral: true });
  }
}
