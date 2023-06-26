import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Redémarre le bot');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Redémarrage du bot");

    process.exit(0);
}

export const admin = true;