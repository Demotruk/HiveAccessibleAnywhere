/**
 * /gift @user — Send a free gift card (operator/trusted only).
 *
 * Attempts DM delivery. On failure, generates a claim code as fallback.
 */

import { randomBytes } from 'node:crypto';
import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import {
  getAvailableCard,
  markCardDelivered,
  getCardCounts,
  isTrustedUser,
  reserveCard,
  createSharedLink,
} from '../db.js';
import { sendCardImagesDiscord } from '../send-card-discord.js';

function generateShortCode(): string {
  return randomBytes(6).toString('base64url');
}

export async function giftCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const isOperator = interaction.user.id === config.operatorDiscordId;
  const isTrusted = isTrustedUser(db, interaction.user.id, 'discord');

  if (!isOperator && !isTrusted) {
    await interaction.reply({
      content: 'You need to purchase a gift card. Use `/buygift` instead.',
      ephemeral: true,
    });
    return;
  }

  const recipient = interaction.options.getUser('user', true);

  const counts = getCardCounts(db);
  if (counts.available === 0) {
    await interaction.reply({ content: 'No gift cards available. Please try again later.', ephemeral: true });
    return;
  }

  const card = getAvailableCard(db);
  if (!card) {
    await interaction.reply({ content: 'No gift cards available. Please try again later.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const dmSuccess = await sendCardImagesDiscord(recipient, card.pdf_path, {
    recipientName: recipient.displayName,
    inviteUrl: card.invite_url,
  });

  if (dmSuccess) {
    markCardDelivered(db, card.id, recipient.id);
    await interaction.editReply(`Gift card sent to ${recipient} via DM!`);
  } else {
    // DM failed — generate claim code
    const code = generateShortCode();
    reserveCard(db, card.id, `share-${code}`);
    createSharedLink(db, code, card.id, interaction.user.id);

    await interaction.editReply(
      `I couldn't DM ${recipient} (they may have DMs disabled). ` +
      `They can claim their card with \`/claim ${code}\` in any server I'm in, or in a DM with me.`,
    );
  }
}
