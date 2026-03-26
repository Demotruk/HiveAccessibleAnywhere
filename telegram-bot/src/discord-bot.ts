/**
 * Discord bot setup with slash command registration and interaction routing.
 */

import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type Interaction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotConfig } from './config.js';
import { giftCommand } from './discord-commands/gift.js';
import { buygiftCommand, handleBuygiftButton } from './discord-commands/buygift.js';
import { loadCommand } from './discord-commands/load.js';
import { stockCommand } from './discord-commands/stock.js';
import { setpriceCommand } from './discord-commands/setprice.js';
import { shareCommand } from './discord-commands/share.js';
import { clearCommand } from './discord-commands/clear.js';
import { trustCommand, untrustCommand, trustedCommand } from './discord-commands/trust.js';
import { claimCommand } from './discord-commands/claim.js';

const slashCommands = [
  new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Send a free gift card to a user (operator/trusted only)')
    .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true)),
  new SlashCommandBuilder()
    .setName('buygift')
    .setDescription('Purchase a gift card (HBD or Bitcoin Lightning)')
    .addUserOption(opt => opt.setName('user').setDescription('Recipient (optional, defaults to you)')),
  new SlashCommandBuilder()
    .setName('load')
    .setDescription('Load gift cards from a batch directory (operator only)')
    .addStringOption(opt => opt.setName('batch_id').setDescription('Batch ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Check gift card inventory (operator only)'),
  new SlashCommandBuilder()
    .setName('setprice')
    .setDescription('Set the HBD price per gift card (operator only)')
    .addStringOption(opt => opt.setName('amount').setDescription('Price in HBD (e.g. 5.000)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('share')
    .setDescription('Generate claimable gift card codes (operator only)')
    .addIntegerOption(opt => opt.setName('count').setDescription('Number of codes (1-20)').setMinValue(1).setMaxValue(20)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Remove available cards from a batch (operator only)')
    .addStringOption(opt => opt.setName('batch_id').setDescription('Batch ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('trust')
    .setDescription('Allow a user to gift for free (operator only)')
    .addUserOption(opt => opt.setName('user').setDescription('User to trust').setRequired(true)),
  new SlashCommandBuilder()
    .setName('untrust')
    .setDescription('Revoke free gifting privilege (operator only)')
    .addUserOption(opt => opt.setName('user').setDescription('User to untrust').setRequired(true)),
  new SlashCommandBuilder()
    .setName('trusted')
    .setDescription('List trusted users (operator only)'),
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a gift card from a shared code')
    .addStringOption(opt => opt.setName('code').setDescription('Claim code').setRequired(true)),
];

function isOperator(interaction: ChatInputCommandInteraction, config: BotConfig): boolean {
  return interaction.user.id === config.operatorDiscordId;
}

async function replyOperatorOnly(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ content: 'This command is restricted to the bot operator.', ephemeral: true });
}

export function createDiscordBot(config: BotConfig, db: Database.Database): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user!.tag}`);

    // Register slash commands globally
    try {
      await client.application!.commands.set(slashCommands);
      console.log(`Registered ${slashCommands.length} Discord slash commands`);
    } catch (err) {
      console.error('Failed to register Discord slash commands:', err);
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, db, config);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction, db, config);
      }
    } catch (err) {
      console.error(`Discord interaction error (${interaction.id}):`, err);
      try {
        const reply = { content: 'Something went wrong. Please try again.', ephemeral: true };
        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      } catch {
        // Cannot recover
      }
    }
  });

  return client;
}

async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const operatorCommands = ['load', 'stock', 'setprice', 'share', 'clear', 'trust', 'untrust', 'trusted'];

  if (operatorCommands.includes(interaction.commandName) && !isOperator(interaction, config)) {
    await replyOperatorOnly(interaction);
    return;
  }

  switch (interaction.commandName) {
    case 'gift': return giftCommand(interaction, db, config);
    case 'buygift': return buygiftCommand(interaction, db, config);
    case 'load': return loadCommand(interaction, db, config);
    case 'stock': return stockCommand(interaction, db);
    case 'setprice': return setpriceCommand(interaction, db);
    case 'share': return shareCommand(interaction, db);
    case 'clear': return clearCommand(interaction, db);
    case 'trust': return trustCommand(interaction, db);
    case 'untrust': return untrustCommand(interaction, db);
    case 'trusted': return trustedCommand(interaction, db);
    case 'claim': return claimCommand(interaction, db);
  }
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  db: Database.Database,
  config: BotConfig,
): Promise<void> {
  const id = interaction.customId;

  if (id.startsWith('pay_hbd_') || id.startsWith('pay_btc_') || id.startsWith('cancel_')) {
    await handleBuygiftButton(interaction, db, config);
  }
}

export async function startDiscordBot(client: Client, config: BotConfig): Promise<void> {
  await client.login(config.discordBotToken);
}
