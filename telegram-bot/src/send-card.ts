/**
 * Send a gift card as photo images via Telegram.
 *
 * Converts the 2-page PDF to PNG images and sends them as a media group.
 * Page 1 = front (QR code), Page 2 = back (PIN + instructions).
 */

import { InputFile, type Api, InputMediaBuilder } from 'grammy';
import { pdfToImages } from './pdf-to-images.js';

const PAGE_LABELS = ['Front — scan this QR code', 'Back — your PIN and instructions'];

export async function sendCardImages(
  api: Api,
  chatId: number,
  pdfPath: string,
  options?: { recipientName?: string; inviteUrl?: string | null },
): Promise<void> {
  const images = pdfToImages(pdfPath);
  const recipientName = options?.recipientName;
  const inviteUrl = options?.inviteUrl;

  if (images.length === 0) {
    throw new Error('PDF produced no images');
  }

  if (images.length === 1) {
    await api.sendPhoto(
      chatId,
      new InputFile(images[0], 'gift-card.png'),
      { caption: 'Here is your Hive gift card! Scan the QR code to create your account.' },
    );
  } else {
    const media = images.map((img, i) => {
      const caption = i === 0
        ? `Hive gift card${recipientName ? ` for ${recipientName}` : ''}! ${PAGE_LABELS[i] || ''}`
        : PAGE_LABELS[i] || `Page ${i + 1}`;
      return InputMediaBuilder.photo(new InputFile(img, `gift-card-${i + 1}.png`), { caption });
    });

    await api.sendMediaGroup(chatId, media);
  }

  // Send the invite link as a separate message so it's easily clickable
  if (inviteUrl) {
    await api.sendMessage(chatId,
      `🔗 <b>Your invite link:</b>\n${inviteUrl}\n\n` +
      `Tap the link above or scan the QR code to create your Hive account.`,
      { parse_mode: 'HTML' },
    );
  }
}
