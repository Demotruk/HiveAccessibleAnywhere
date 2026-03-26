/**
 * Send a gift card as image attachments via Discord.
 *
 * Converts the 2-page PDF to PNG images and sends them as file attachments.
 * Page 1 = front (QR code), Page 2 = back (PIN + instructions).
 *
 * Returns false if the DM could not be delivered (user has DMs disabled).
 */

import { AttachmentBuilder, DiscordAPIError, type User, type DMChannel, type TextChannel } from 'discord.js';
import { pdfToImages } from './pdf-to-images.js';

const PAGE_LABELS = ['Front — scan this QR code', 'Back — your PIN and instructions'];

export async function sendCardImagesDiscord(
  target: User | DMChannel | TextChannel,
  pdfPath: string,
  options?: { recipientName?: string; inviteUrl?: string | null },
): Promise<boolean> {
  const images = pdfToImages(pdfPath);
  const recipientName = options?.recipientName;
  const inviteUrl = options?.inviteUrl;

  if (images.length === 0) {
    throw new Error('PDF produced no images');
  }

  const attachments = images.map((buf, i) =>
    new AttachmentBuilder(buf, {
      name: `gift-card-${i + 1}.png`,
      description: PAGE_LABELS[i] || `Page ${i + 1}`,
    }),
  );

  try {
    await target.send({
      content: `Hive gift card${recipientName ? ` for ${recipientName}` : ''}! Scan the QR code to create your account.`,
      files: attachments,
    });

    if (inviteUrl) {
      await target.send({
        content: `**Your invite link:**\n${inviteUrl}\n\nTap the link above or scan the QR code to create your Hive account.`,
      });
    }

    return true;
  } catch (err) {
    // Discord error 50007 = "Cannot send messages to this user" (DMs disabled)
    if (err instanceof DiscordAPIError && err.code === 50007) {
      return false;
    }
    throw err;
  }
}
