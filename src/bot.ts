import { Client, Events, GatewayIntentBits } from 'discord.js';
import consoleStamp from 'console-stamp';
import getCmds from './get_cmds.js';
import loadConfig from './load_config.js';
import loadDb from './load_db.js';

// Enhance console logging
consoleStamp(console);

console.log("Starting bot...");

const commands = await getCmds();

loadConfig();

loadDb();

// Create client
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Log when ready
client.once(Events.ClientReady, () => {
    console.log("Bot is ready!");
    for (const id of process.env.ADMIN_IDS?.split(", ")) {
        client.users.fetch(id).then(user => {
            user.send("Bot started !")
        })
    }
});

// Handle commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = commands.get(interaction.commandName);
    if (command === undefined) {
        console.error(`${interaction.user.username} tried to use an unknown command: ${interaction.commandName}`);
        await interaction.reply({ content: '⚠️ Cette commande n\'existe pas!', ephemeral: true });
        return;
    }

    if (command.admin && !process.env.ADMIN_IDS?.split(", ").includes(interaction.user.id)) {
        console.log(`${interaction.user.username} tried to use an admin command: ${interaction.commandName}`);
        await interaction.reply({ content: '⚠️ Vous n\'avez pas la permission d\'utiliser cette commande!', ephemeral: true });
        return;
    }

    if (interaction.options.getSubcommandGroup(false)) {
        console.log(`${interaction.user.username} uses command: /${interaction.commandName} ${interaction.options.getSubcommandGroup(true)} ${interaction.options.getSubcommand(true)}`);
    } else if (interaction.options.getSubcommand(false)) {
        console.log(`${interaction.user.username} uses command: /${interaction.commandName} ${interaction.options.getSubcommand(true)}`);
    } else {
        console.log(`${interaction.user.username} uses command: /${interaction.commandName}`);
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        if (error instanceof Error && error.message === "Collector received no interactions before ending with reason: time") {
            await interaction.editReply({ content: '⏱️ Vous avez pris trop de temps', components: [], embeds: [] });
            return;
        }

        throw error;

        console.error(`${interaction.user.username} tried to use /${interaction.commandName} but an error occured: ${error}`);
        try {
            await interaction.reply({ content: '⚠️ Une erreur est survenue lors de l\'exécution de cette commande!', ephemeral: true });
        } catch (error) {
            await interaction.editReply({
                content: '⚠️ Une erreur est survenue lors de l\'exécution de cette commande!',
                components: [],
                embeds: []
            });
        }
    }
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isAutocomplete()) return;

    const command = commands.get(interaction.commandName);
    if (command === undefined) {
        console.error(`${interaction.user.username} tried to use an unknown autocomplete: ${interaction.commandName}`);
        return;
    }

    if (command.admin && !process.env.ADMIN_IDS?.split(", ").includes(interaction.user.id)) {
        return;
    }

    if (interaction.options.getSubcommandGroup(false)) {
        console.log(`${interaction.user.username} uses autocomplete: /${interaction.commandName} ${interaction.options.getSubcommandGroup(true)} ${interaction.options.getSubcommand(true)}`);
    } else if (interaction.options.getSubcommand(false)) {
        console.log(`${interaction.user.username} uses autocomplete: /${interaction.commandName} ${interaction.options.getSubcommand(true)}`);
    } else {
        console.log(`${interaction.user.username} uses autocomplete: /${interaction.commandName}`);
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        console.error(`${interaction.user.username} tried to use /${interaction.commandName} autocomplete but an error occured: ${error}`);
    }
})

// If no token is provided, exit
if (process.env.DISCORD_TOKEN === undefined) {
    console.error("No token provided! Please set the DISCORD_TOKEN environment variable in config.env");
    process.exit(1);
}

// Lauch bot
client.login(process.env.DISCORD_TOKEN);