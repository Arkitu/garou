import dotenv from 'dotenv';
import path from 'path';

const configProperties = [
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DEV_GUILD_ID",
    "ADMIN_IDS"
]

export default function loadConfig() {
    dotenv.config({
        path: path.join(process.cwd(), "config.env")
    });

    for (const property of configProperties) {
        if (!process.env[property]) {
            throw new Error(`Missing ${property} in config.env`);
        }
    }
}