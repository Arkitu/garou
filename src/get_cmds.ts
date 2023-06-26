import { readdirSync } from 'fs';
import { Command } from './types/interfaces';
import path from 'path';

export default async function getCmds() {
    const commands = new Map<string, Command>();
    for (const fileName of readdirSync(path.join(process.cwd(), "build", "commands"))) {
        const command = await import(path.join(process.cwd(), "build", "commands", fileName));
        commands.set(command.data.name, command);
    }
    return commands;
}