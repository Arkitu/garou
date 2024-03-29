import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Game, roles } from '../game.js';

export const data = new SlashCommandBuilder()
    .setName('play_debug')
    .setDescription('Lance une partie avec des bots pour tester');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    if (!interaction.inGuild()) {
        await (interaction as ChatInputCommandInteraction).editReply('Cette commande n\'est disponible que dans un serveur.');
        return;
    }

    await db.updateOrCreateUser(interaction.user.id, interaction.user.username);

    const players = [interaction.user.id, "953179631043899413"];

    const game = new Game(players, interaction.client, interaction.guild!, interaction.user.id);
    game.roles = [roles.villager, roles.werewolf];
    await game.start(interaction);
}

export const admin = true;