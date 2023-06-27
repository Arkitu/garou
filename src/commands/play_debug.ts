import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Game } from '../game.js';

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

    const players = [interaction.user.id, "1117365150899511296", "1048011651145797673", "448110812801007618"];

    const game = new Game(players, interaction.client, interaction.guild, interaction.user.id);
    await game.init(interaction);
}

export const admin = true;