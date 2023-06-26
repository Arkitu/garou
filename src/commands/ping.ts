import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Répond pong');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Pong!');
}

export const admin = false;