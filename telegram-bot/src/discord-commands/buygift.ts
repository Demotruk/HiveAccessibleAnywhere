/**
 * /buygift [@user] — Purchase a gift card via HBD or Bitcoin Lightning.
 *
 * Uses Discord buttons for payment method selection.
 * Button interactions (pay_hbd_, pay_btc_, cancel_) are also handled here.
 */

import { randomBytes } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import {
  getAvailableCard,
  reserveCard,
  releaseCard,
  createPayment,
  getConfigValue,
  getCardCounts,
} from '../db.js';
import { createV4vInvoice } from '../v4v.js';

function generatePaymentId(): string {
  return randomBytes(4).toString('hex');
}

function formatHbd(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '5.000';
  return num.toFixed(3);
}

export async function buygiftCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const recipient = interaction.options.getUser('user') ?? interaction.user;

  const counts = getCardCounts(db);
  if (counts.available === 0) {
    await interaction.reply({
      content: 'Sorry, no gift cards are currently available. Please try again later.',
      ephemeral: true,
    });
    return;
  }

  const priceOverride = getConfigValue(db, 'gift_price_hbd');
  const price = formatHbd(priceOverride || config.giftPriceHbd);

  const card = getAvailableCard(db);
  if (!card) {
    await interaction.reply({
      content: 'Sorry, no gift cards are currently available. Please try again later.',
      ephemeral: true,
    });
    return;
  }

  const paymentId = generatePaymentId();
  reserveCard(db, card.id, paymentId);

  const expiresAt = new Date(Date.now() + config.paymentTimeoutMinutes * 60_000).toISOString();
  createPayment(db, {
    id: paymentId,
    telegramUserId: interaction.user.id,
    telegramChatId: interaction.channelId,
    recipientUserId: recipient.id !== interaction.user.id ? recipient.id : null,
    recipientUsername: recipient.id !== interaction.user.id ? recipient.displayName : null,
    amountHbd: price,
    expiresAt,
    cardId: card.id,
    platform: 'discord',
  });

  const recipientLabel = recipient.id === interaction.user.id ? 'yourself' : recipient.toString();

  const embed = new EmbedBuilder()
    .setTitle('Gift Card Purchase')
    .setDescription(`Gift card for ${recipientLabel} — **${price} HBD**`)
    .setFooter({ text: `Expires in ${config.paymentTimeoutMinutes} minutes` });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pay_hbd_${paymentId}`)
      .setLabel('Pay with HBD')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pay_btc_${paymentId}`)
      .setLabel('Pay with Bitcoin')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cancel_${paymentId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    embeds: [embed],
    components: [buttons],
    ephemeral: true,
  });
}

export async function handleBuygiftButton(
  interaction: ButtonInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const id = interaction.customId;

  if (id.startsWith('cancel_')) {
    const paymentId = id.slice('cancel_'.length);
    await handleCancel(interaction, db, paymentId);
  } else if (id.startsWith('pay_hbd_')) {
    const paymentId = id.slice('pay_hbd_'.length);
    await handlePayHbd(interaction, db, config, paymentId);
  } else if (id.startsWith('pay_btc_')) {
    const paymentId = id.slice('pay_btc_'.length);
    await handlePayBtc(interaction, db, config, paymentId);
  }
}

async function handlePayHbd(
  interaction: ButtonInteraction,
  db: Database.Database,
  config: BotConfig,
  paymentId: string,
): Promise<void> {
  const payment = db.prepare(
    "SELECT * FROM payments WHERE id = ? AND status = 'pending'"
  ).get(paymentId) as { amount_hbd: string } | undefined;

  if (!payment) {
    await interaction.update({
      content: 'This payment has expired or been cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  const memo = `pay-${paymentId}`;

  const cancelButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel_${paymentId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.update({
    content:
      `**Pay with HBD**\n\n` +
      `Send **${payment.amount_hbd} HBD** to \`@${config.hiveAccount}\` on Hive\n` +
      `Memo: \`${memo}\`\n\n` +
      `Payment expires in ${config.paymentTimeoutMinutes} minutes.\n` +
      `The gift card will be sent automatically once payment is confirmed.`,
    embeds: [],
    components: [cancelButton],
  });
}

async function handlePayBtc(
  interaction: ButtonInteraction,
  db: Database.Database,
  config: BotConfig,
  paymentId: string,
): Promise<void> {
  const payment = db.prepare(
    "SELECT * FROM payments WHERE id = ? AND status = 'pending'"
  ).get(paymentId) as { amount_hbd: string } | undefined;

  if (!payment) {
    await interaction.update({
      content: 'This payment has expired or been cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  const memo = `pay-${paymentId}`;

  await interaction.deferUpdate();

  let content: string;
  try {
    const invoice = await createV4vInvoice({
      hiveAccount: config.hiveAccount,
      amountHbd: payment.amount_hbd,
      memo,
      expirySeconds: config.paymentTimeoutMinutes * 60,
    });

    const satsLabel = invoice.amountSats > 0
      ? ` (~${invoice.amountSats.toLocaleString()} sats)`
      : '';

    content =
      `**Pay with Bitcoin Lightning**${satsLabel}\n\n` +
      `\`\`\`\n${invoice.paymentRequest}\n\`\`\`\n` +
      `Copy the invoice above into any Lightning wallet to pay.\n\n` +
      `Payment expires in ${config.paymentTimeoutMinutes} minutes.\n` +
      `The gift card will be sent automatically once payment is confirmed.`;
  } catch (err) {
    console.error('v4v.app invoice generation failed:', err);
    content = 'Bitcoin Lightning payment is temporarily unavailable. Please use HBD instead.';
  }

  const cancelButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel_${paymentId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({
    content,
    embeds: [],
    components: [cancelButton],
  });
}

async function handleCancel(
  interaction: ButtonInteraction,
  db: Database.Database,
  paymentId: string,
): Promise<void> {
  const payment = db.prepare(
    "SELECT * FROM payments WHERE id = ? AND status = 'pending'"
  ).get(paymentId) as { card_id: number | null } | undefined;

  if (!payment) {
    await interaction.update({
      content: 'This payment has already expired or been cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Cancel payment and release card
  db.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").run(paymentId);
  if (payment.card_id) {
    releaseCard(db, payment.card_id);
  }

  await interaction.update({
    content: 'Payment cancelled. The gift card has been released.',
    embeds: [],
    components: [],
  });
}
