import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Game } from '../game.js';

export const data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Lance une partie');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    if (!interaction.inGuild()) {
        await (interaction as ChatInputCommandInteraction).editReply('Cette commande n\'est disponible que dans un serveur.');
        return;
    }

    await db.updateOrCreateUser(interaction.user.id, interaction.user.username);

    const players = [interaction.user.id];

    const game = new Game(players, interaction.client, interaction.guild);
    await game.init(interaction);
}

export const admin = false;