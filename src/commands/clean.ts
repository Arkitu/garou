import { CategoryChannel, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('clean')
    .setDescription('Supprime tous les salons de parties');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    if (!process.env.ADMIN_IDS?.split(", ").includes(interaction.user.id)) {
        await interaction.editReply('Vous n\'avez pas la permission d\'utiliser cette commande.');
        return;
    }

    for (const category of interaction.guild?.channels.cache?.filter(channel => channel.type === ChannelType.GuildCategory).values()) {
        if (category.name === "Partie de Garou") {
            for (const channel of (category as CategoryChannel).children.cache.values()) {
                await channel.delete();
            }
            await category.delete();
        }
    }

    await interaction.editReply('Tous les salons de parties ont été supprimés.');
}

export const admin = false;