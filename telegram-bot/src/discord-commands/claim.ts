/**
 * /claim <code> — Claim a gift card from a shared code.
 *
 * Platform-agnostic: codes generated on Telegram or Discord are interchangeable.
 * Attempts DM delivery; falls back to ephemeral in-channel message with instructions.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { getSharedLink, claimSharedLink, markCardDelivered } from '../db.js';
import { sendCardImagesDiscord } from '../send-card-discord.js';

export async function claimCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const code = interaction.options.getString('code', true).trim();

  const link = getSharedLink(db, code);

  if (!link) {
    await interaction.reply({ content: 'This gift card code is not valid.', ephemeral: true });
    return;
  }

  if (link.claimed_by) {
    await interaction.reply({ content: 'This gift card has already been claimed.', ephemeral: true });
    return;
  }

  if (link.status === 'delivered') {
    await interaction.reply({ content: 'This gift card has already been delivered.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const dmSuccess = await sendCardImagesDiscord(interaction.user, link.pdf_path, {
      recipientName: interaction.user.displayName,
      inviteUrl: link.invite_url,
    });

    claimSharedLink(db, code, interaction.user.id);
    markCardDelivered(db, link.card_id, interaction.user.id);

    if (dmSuccess) {
      await interaction.editReply(
        'Your gift card has been sent to your DMs! Scan the QR code or tap the invite link to create your Hive account.',
      );
    } else {
      await interaction.editReply(
        'I couldn\'t send the card to your DMs (you may have DMs disabled). ' +
        'Please enable DMs from server members and try `/claim` again, or DM me directly and use `/claim` there.',
      );
      // Undo the claim since delivery failed
      db.prepare("UPDATE shared_links SET claimed_by = NULL, claimed_at = NULL WHERE code = ?").run(code);
      db.prepare("UPDATE cards SET status = 'reserved', delivered_to = NULL, delivered_at = NULL WHERE id = ?").run(link.card_id);
    }
  } catch (err) {
    console.error(`Failed to deliver card for claim code ${code}:`, err);
    await interaction.editReply('Something went wrong delivering your gift card. Please try again or contact the operator.');
  }
}
