/**
 * /share [count] — Generate claimable gift card codes (operator only).
 *
 * Unlike the Telegram version, these are raw codes (not deep links).
 * Recipients claim them via /claim <code>.
 */

import { randomBytes } from 'node:crypto';
import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import {
  getAvailableCard,
  reserveCard,
  createSharedLink,
  getCardCounts,
} from '../db.js';

function generateShortCode(): string {
  return randomBytes(6).toString('base64url');
}

export async function shareCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const count = interaction.options.getInteger('count') ?? 1;

  const counts = getCardCounts(db);
  if (counts.available < count) {
    await interaction.reply({
      content: `Not enough cards. Requested: ${count}, available: ${counts.available}.`,
      ephemeral: true,
    });
    return;
  }

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = getAvailableCard(db);
    if (!card) break;

    const code = generateShortCode();
    reserveCard(db, card.id, `share-${code}`);
    createSharedLink(db, code, card.id, interaction.user.id);
    codes.push(code);
  }

  if (codes.length === 0) {
    await interaction.reply({ content: 'No cards available.', ephemeral: true });
    return;
  }

  const codeList = codes.map(c => `\`${c}\``).join('\n');
  await interaction.reply({
    content:
      `Generated ${codes.length} claimable code${codes.length > 1 ? 's' : ''}:\n\n` +
      `${codeList}\n\n` +
      `Recipients can claim with \`/claim <code>\` in any server I'm in, or in a DM with me.`,
    ephemeral: true,
  });
}
