import getCmds from "./get_cmds.js";
import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import loadConfig from "./load_config.js";

// Get environment variables
loadConfig();
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const devGuildId = process.env.DEV_GUILD_ID;
if (token === undefined) {
    console.error("No token provided! Please set the DISCORD_TOKEN environment variable in config.env");
    process.exit(1);
}
if (clientId === undefined) {
    console.error("No client ID provided! Please set the DISCORD_CLIENT_ID environment variable in config.env");
    process.exit(1);
}
if (devGuildId === undefined) {
    console.error("No dev guild ID provided! Please set the DEV_GUILD_ID environment variable in config.env");
    process.exit(1);
}

const commands = await getCmds();

let everyoneCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
let adminCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const [key, value] of commands) {
    if (value.admin) {
        adminCommands.push(value.data.toJSON());
    } else {
        everyoneCommands.push(value.data.toJSON());
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing application commands.`);

		// Refresh admin commands in the dev guild
		await rest.put(
			Routes.applicationGuildCommands(clientId, devGuildId),
			{ body: adminCommands },
		);

        // Refresh everyone commands in the global scope
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: everyoneCommands },
        );

		console.log(`Successfully reloaded application commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();