import { Client, Guild, ChannelType, PermissionFlagsBits, CategoryChannel, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, OverwriteResolvable } from "discord.js";
import { shuffleArray } from "./utils.js";

export enum Role {
    Villager = "Villageois",
    Werewolf = "Loup-garou"
}

function getEmojiFromRole(role: Role) {
    switch (role) {
        case Role.Villager:
            return "👨‍🌾";
        case Role.Werewolf:
            return "🐺";
    }
}

export class Player {
    id: string;
    role: Role;

    constructor(id: string, role: Role = Role.Villager) {
        this.id = id;
        this.role = role;
    }
}

export class Game {
    /** Players discord ids (usefull at the start of the game) */
    players_ids: string[] = [];

    /** All roles in the game (usefull at the start of the game) */
    roles: Role[] = [];

    creator_id: string;

    players: Player[];
    client: Client;
    guild: Guild;
    categoryChannel: CategoryChannel;



    constructor(players_ids: string[] = [], client: Client, guild: Guild, creator_id: string) {
        this.players_ids = players_ids;
        this.client = client;
        this.guild = guild;
        this.creator_id = creator_id;
    }

    async configMessageRefresh(interaction: ChatInputCommandInteraction | ButtonInteraction) {
        let embed = new EmbedBuilder()
            .setTitle("Configuration de la partie")
            .setColor(`#${process.env.MAIN_COLOR}`)
            .addFields([
                { name: "Joueurs :", value: this.players_ids.map(id => `• <@${id}>`).join("\n") || "Aucun joueur pour l'instant" },
                { name: "Rôles :", value: this.roles.map(role => `• ${role} ${getEmojiFromRole(role)}`).join("\n") || "Aucun rôle pour l'instant" }
            ]);
        
        const joinComponents = new ActionRowBuilder<ButtonBuilder>()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId("join")
                    .setEmoji("📥")
                    .setLabel("Rejoindre")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("leave")
                    .setEmoji("📤")
                    .setLabel("Quitter")
                    .setStyle(ButtonStyle.Danger),
                
                new ButtonBuilder()
                    .setCustomId("start")
                    .setEmoji("🎲")
                    .setLabel("Lancer la partie")
                    .setStyle(ButtonStyle.Success)
            ]);
        
        const roleComponents = new ActionRowBuilder<ButtonBuilder>()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId("villager")
                    .setEmoji("👨‍🌾")
                    .setLabel("Villageois")
                    .setStyle(ButtonStyle.Primary),
                
                new ButtonBuilder()
                    .setCustomId("werewolf")
                    .setEmoji("🐺")
                    .setLabel("Loup-garou")
                    .setStyle(ButtonStyle.Danger)
            ]);
        
        let msg;
        if (interaction.isChatInputCommand()) {
            msg = await interaction.editReply({ embeds: [embed], components: [joinComponents, roleComponents] });
        } else {
            msg = await interaction.update({ embeds: [embed], components: [joinComponents, roleComponents] });
        }
        return msg;
    }

    async configMessage(interaction: ChatInputCommandInteraction) {
        const reply = await this.configMessageRefresh(interaction);

        while (true) {
            const buttonInteraction = await reply.awaitMessageComponent<ComponentType.Button>({ time: 60000 });

            await db.updateOrCreateUser(interaction.user.id, interaction.user.username);

            switch (buttonInteraction.customId) {
                case "join":
                    if (this.players_ids.includes(buttonInteraction.user.id)) {
                        await buttonInteraction.reply({ content: "Vous êtes déjà dans la partie.", ephemeral: true });
                        break;
                    } else {
                        this.players_ids.push(buttonInteraction.user.id);
                        await this.configMessageRefresh(buttonInteraction);
                        break;
                    }
                case "leave":
                    if (!this.players_ids.includes(buttonInteraction.user.id)) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas dans la partie.", ephemeral: true });
                        break;
                    } else {
                        this.players_ids = this.players_ids.filter(id => id !== buttonInteraction.user.id);
                        await this.configMessageRefresh(buttonInteraction);
                        break;
                    }
                case "start":
                    if (buttonInteraction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    } else if (this.players_ids.length < 2) {
                        await buttonInteraction.reply({ content: "Il faut au moins 2 joueurs pour lancer la partie.", ephemeral: true });
                        break;
                    } else if (this.players_ids.length !== this.roles.length) {
                        await buttonInteraction.reply({ content: "Il faut autant de rôles que de joueurs pour lancer la partie.", ephemeral: true });
                        break;
                    } else {
                        let embed = new EmbedBuilder()
                            .setTitle("Partie en cours")
                            .setColor(`#${process.env.MAIN_COLOR}`)
                            .addFields([
                                { name: "Joueurs :", value: this.players_ids.map(id => `• <@${id}>`).join("\n") },
                                { name: "Rôles :", value: this.roles.map(role => `• ${role} ${getEmojiFromRole(role)}`).join("\n") }
                            ]);
                        await buttonInteraction.update({ components: [], embeds: [embed] });
                        return;
                    }
                case "villager":
                    if (interaction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    } else {
                        this.roles.push(Role.Villager);
                        if (this.roles.length > this.players_ids.length) {
                            this.roles.shift();
                        }
                        await this.configMessageRefresh(buttonInteraction);
                        break;
                    }
                case "werewolf":
                    if (interaction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    } else {
                        this.roles.push(Role.Werewolf);
                        await this.configMessageRefresh(buttonInteraction);
                        break;
                    }
            }
        }
    }

    async init(interaction: ChatInputCommandInteraction) {
        await this.configMessage(interaction);

        // Fetch players
        for (const id of this.players_ids) {
            await this.guild.members.fetch(id);
        }

        // Create players
        let roles = shuffleArray(this.roles);
        for (let i=0; this.players_ids.length > i; i++) {
            this.players.push(new Player(this.players_ids[i], roles[i]));
        }

        // Create category
        this.categoryChannel = await this.guild.channels.create({
            name: "Partie de Garou",
            type: ChannelType.GuildCategory,
            permissionOverwrites: this.generalPermissionOverwrites
        })

        // Create channels
        this.categoryChannel.children.create({
            name: "Place du village",
            type: ChannelType.GuildText,
            permissionOverwrites: this.generalPermissionOverwrites
        })

        if (this.roles.includes(Role.Werewolf)) {
            this.categoryChannel.children.create({
                name: "Tanière des loups",
                type: ChannelType.GuildText,
                permissionOverwrites: this.generalPermissionOverwrites
            })
        }
    }

    get generalPermissionOverwrites(): OverwriteResolvable[] {
        return [
            {
                id: this.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...this.players_ids.map(id => {
                return {
                    id: id,
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            })
        ]
    }

    get werewolfPermissionOverwrites(): OverwriteResolvable[] {
        return [
            {
                id: this.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...this.players.filter(player => player.role === Role.Werewolf).map(player => {
                return {
                    id: player.id,
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            })
        ]
    }
}