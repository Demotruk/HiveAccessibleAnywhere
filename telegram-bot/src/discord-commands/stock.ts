/**
 * /stock — Check gift card inventory (operator only).
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { getCardCounts, getUnclaimedLinkCount } from '../db.js';

export async function stockCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const counts = getCardCounts(db);
  const unclaimed = getUnclaimedLinkCount(db);
  const total = counts.available + counts.reserved + counts.delivered;

  await interaction.reply({
    content:
      `**Gift card inventory:**\n` +
      `  Available: ${counts.available}\n` +
      `  Reserved (awaiting payment): ${counts.reserved}\n` +
      `  Shared links (unclaimed): ${unclaimed}\n` +
      `  Delivered: ${counts.delivered}\n` +
      `  Total: ${total}`,
    ephemeral: true,
  });
}
