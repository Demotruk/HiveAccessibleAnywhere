/**
 * /setprice <amount> — Set the HBD price for gift cards (operator only).
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { setConfigValue } from '../db.js';

export async function setpriceCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const amountStr = interaction.options.getString('amount', true);

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    await interaction.reply({
      content: 'Invalid amount. Please enter a positive number (e.g. 5.000).',
      ephemeral: true,
    });
    return;
  }

  const formatted = amount.toFixed(3);
  setConfigValue(db, 'gift_price_hbd', formatted);
  await interaction.reply({ content: `Gift card price set to ${formatted} HBD.`, ephemeral: true });
}
