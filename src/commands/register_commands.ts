import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';

export const data = new SlashCommandBuilder()
    .setName('register_commands')
    .setDescription('Rafrachit les commandes');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Rafraichissement des commandes en cours...');

    exec("node build/register_cmds.js", (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            interaction.editReply(`Erreur lors du rafraichissement des commandes: ${error}`);
            return;
        }

        interaction.editReply(`Commandes rafraichies avec succès!`);
    });
}

export const admin = false;