/**
 * Payment notification dispatchers.
 *
 * When the transfer monitor confirms a payment, it needs to notify the buyer
 * on the correct platform. This module provides a PaymentNotifier interface
 * and platform-specific implementations.
 */

import type { Bot } from 'grammy';
import type { Client } from 'discord.js';
import type { PaymentRow } from './db.js';

export interface PaymentNotifier {
  /**
   * Notify the buyer that their payment was confirmed and provide the claim code.
   * Non-critical — failures are logged but don't block payment confirmation.
   */
  notifyPaymentConfirmed(
    payment: PaymentRow & { pdf_path: string; invite_url: string | null },
    claimCode: string,
  ): Promise<void>;
}

/**
 * Sends a Telegram deep link to the buyer's chat.
 */
export class TelegramNotifier implements PaymentNotifier {
  constructor(private bot: Bot) {}

  async notifyPaymentConfirmed(
    payment: PaymentRow & { pdf_path: string; invite_url: string | null },
    claimCode: string,
  ): Promise<void> {
    const botInfo = this.bot.botInfo;
    const link = `https://t.me/${botInfo.username}?start=gc_${claimCode}`;

    try {
      await this.bot.api.sendMessage(
        parseInt(payment.telegram_chat_id, 10),
        `Payment confirmed! Here's your gift card link:\n\n${link}\n\n` +
        `Share it with the recipient — they'll receive the card when they tap the link.`,
      );
    } catch (err) {
      console.error(`Failed to send Telegram payment confirmation for ${payment.id}:`, err);
    }
  }
}

/**
 * Sends a Discord DM with the claim code.
 * Falls back to a channel message if DMs are disabled.
 */
export class DiscordNotifier implements PaymentNotifier {
  constructor(private client: Client) {}

  async notifyPaymentConfirmed(
    payment: PaymentRow & { pdf_path: string; invite_url: string | null },
    claimCode: string,
  ): Promise<void> {
    try {
      // Try DMing the buyer
      const user = await this.client.users.fetch(payment.telegram_user_id);
      await user.send(
        `Payment confirmed! Use \`/claim ${claimCode}\` in any server I'm in (or right here in DMs) to get your gift card.`,
      );
    } catch (dmErr) {
      console.error(`Failed to DM Discord user ${payment.telegram_user_id} for payment ${payment.id}:`, dmErr);

      // Fallback: try sending in the originating channel
      try {
        const channel = await this.client.channels.fetch(payment.telegram_chat_id);
        if (channel && 'send' in channel) {
          await channel.send(
            `<@${payment.telegram_user_id}> Payment confirmed! Use \`/claim ${claimCode}\` to get your gift card.`,
          );
        }
      } catch (channelErr) {
        console.error(`Failed to send Discord channel fallback for payment ${payment.id}:`, channelErr);
      }
    }
  }
}
