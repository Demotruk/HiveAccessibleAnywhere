/**
 * /trust @user — Add a trusted user who can gift for free (operator only).
 * /untrust @user — Remove a trusted user (operator only).
 * /trusted — List all trusted users (operator only).
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { addTrustedUser, removeTrustedUser, getTrustedUsers } from '../db.js';

export async function trustCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const added = addTrustedUser(db, user.id, interaction.user.id, undefined, 'discord');
  if (added) {
    await interaction.reply({
      content: `${user} is now a trusted user and can send free gift cards.`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `${user} is already a trusted user.`,
      ephemeral: true,
    });
  }
}

export async function untrustCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const removed = removeTrustedUser(db, user.id, 'discord');
  if (removed) {
    await interaction.reply({ content: `${user} is no longer a trusted user.`, ephemeral: true });
  } else {
    await interaction.reply({ content: `${user} was not a trusted user.`, ephemeral: true });
  }
}

export async function trustedCommand(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const users = getTrustedUsers(db, 'discord');

  if (users.length === 0) {
    await interaction.reply({
      content: 'No trusted users. Use `/trust @user` to add one.',
      ephemeral: true,
    });
    return;
  }

  const lines = users.map(u => {
    const note = u.note ? ` — ${u.note}` : '';
    return `- <@${u.telegram_user_id}> (added ${u.added_at})${note}`;
  });

  await interaction.reply({
    content: `**Trusted users:**\n${lines.join('\n')}`,
    ephemeral: true,
  });
}
