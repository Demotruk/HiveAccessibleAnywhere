/**
 * /clear <batch-id> — Remove available cards from a batch (operator only).
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { clearBatch } from '../db.js';

export async function clearCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const batchId = interaction.options.getString('batch_id', true);

  const { deleted, skipped } = clearBatch(db, batchId);

  if (deleted === 0 && skipped === 0) {
    await interaction.reply({ content: `No cards found for batch ${batchId}.`, ephemeral: true });
    return;
  }

  let msg = `Cleared ${deleted} available card(s) from batch ${batchId}.`;
  if (skipped > 0) {
    msg += `\n${skipped} delivered/reserved card(s) kept for audit trail.`;
  }
  await interaction.reply({ content: msg, ephemeral: true });
}
