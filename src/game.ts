import { Client, Guild, ChannelType, PermissionFlagsBits, CategoryChannel, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, OverwriteResolvable, TextChannel, User, GuildMember } from "discord.js";
import { shuffleArray } from "./utils.js";

interface Role {
    name: string,
    emoji: string,
    color: `#${string}`,
    description: string,
    image_url: string
}

export const roles = {
    villager: {
        name: "Villageois",
        emoji: "👨‍🌾",
        color: "#00ff00",
        description: "Vous n'avez aucun pouvoir particulier. Vous gagnez avec le village : votre but est d'éliminer tous les loups-garous.",
        image_url: "https://www.regledujeu.fr/wp-content/uploads/simple-villageois-300x300.png"
    } as Role,
    werewolf: {
        name: "Loup-Garou",
        emoji: "🐺",
        color: "#ff0000",
        description: "Chaque nuit, vous vous réveillez avec les autres loups-garous pour dévorer un villageois. Vous gagnez avec les loups-garous : votre but est d'éliminer tous les villageois.",
        image_url: "https://www.regledujeu.fr/wp-content/uploads/loup-garou-1-300x300.png"
    } as Role,
};

export class Player {
    user: GuildMember;
    role: Role;
    channel?: TextChannel;

    constructor(user: GuildMember, role: Role = roles.villager) {
        this.user = user;
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

    // Channels
    categoryChannel: CategoryChannel;
    generalChannel: TextChannel;

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
                { name: "Rôles :", value: this.roles.map(role => `• ${role.name} ${role.emoji}`).join("\n") || "Aucun rôle pour l'instant" }
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
                    .setEmoji(roles.villager.emoji)
                    .setLabel(roles.villager.name)
                    .setStyle(ButtonStyle.Primary),
                
                new ButtonBuilder()
                    .setCustomId("werewolf")
                    .setEmoji(roles.werewolf.emoji)
                    .setLabel(roles.werewolf.name)
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
                                { name: "Rôles :", value: this.roles.map(role => `• ${role.name} ${role.emoji}`).join("\n") }
                            ]);
                        await buttonInteraction.update({ components: [], embeds: [embed] });
                        return;
                    }
                case "villager":
                    if (interaction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    } else {
                        this.roles.push(roles.villager);
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
                        this.roles.push(roles.werewolf);
                        await this.configMessageRefresh(buttonInteraction);
                        break;
                    }
            }
        }
    }

    async init(interaction: ChatInputCommandInteraction) {
        await this.configMessage(interaction);

        // Create players
        this.roles = shuffleArray(this.roles);
        this.players = [];
        for (let i=0; this.players_ids.length > i; i++) {
            this.players.push(new Player(await this.guild.members.fetch(this.players_ids[i]), this.roles[i]));
        }

        // Create category
        this.categoryChannel = await this.guild.channels.create({
            name: "Partie de Garou",
            type: ChannelType.GuildCategory,
            permissionOverwrites: this.generalPermissionOverwrites
        })

        // Create channels

        // General
        this.generalChannel = await this.categoryChannel.children.create({
            name: "Place du village",
            type: ChannelType.GuildText,
            permissionOverwrites: this.generalPermissionOverwrites
        })

        // Werewolf
        if (this.roles.includes(roles.werewolf)) {
            await this.categoryChannel.children.create({
                name: "Tanière des loups",
                type: ChannelType.GuildText,
                permissionOverwrites: this.werewolfPermissionOverwrites
            })
        }

        // Create a channel for each player
        for (let player of this.players) {
            player.channel = await this.categoryChannel.children.create({
                name: player.user.user.username,
                type: ChannelType.GuildText,
                permissionOverwrites: this.userPermissionOverwrites(player.user.id)
            });

            // Send role message
            await player.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Vous êtes " + player.role.name)
                        .setImage(player.role.image_url)
                        .setDescription(player.role.description)
                        .setColor(player.role.color)
                ]
            });
        }

        // Send start message
        let embeds: EmbedBuilder[] = [];
        embeds.push(new EmbedBuilder()
            .setTitle("Place du village")
            .setColor(`#${process.env.MAIN_COLOR}`)
            .setDescription("Bienvenue sur la place du village !\n\nC'est ici que vous débatrez le jour pour éliminer un joueur suspect\n\nVous trouverez votre rôle dans le salon à votre nom.\nNe le partagez pas avec les autres joueurs ! 😉")
            .addFields([
                { name: "Joueurs :", value: this.players_ids.map(id => `• <@${id}>`).join("\n") },
                { name: "Rôles :", value: shuffleArray(this.roles).map(role => `• ${role.name} ${role.emoji}`).join("\n") }
            ])
        );

        let admins = this.players.filter(p => p.user.permissions.has(PermissionFlagsBits.Administrator));
        if (admins.length > 0) {
            embeds.push(new EmbedBuilder()
                .setTitle("Attention !")
                .setColor(`#${process.env.WARN_COLOR}`)
                .setDescription(`${admins.map(admin => `<@${admin.user.id}>`).join(", ")} est/sont administrateur(s) du serveur. Il(s) peut/peuvent donc voir tous les salons, y compris ceux privés. Attention à bien respecter les règles du jeu !`)
            );
        }

        await this.generalChannel.send({ embeds });
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
            ...this.players.filter(player => player.role.name === roles.werewolf.name).map(player => {
                return {
                    id: player.user.id,
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            })
        ]
    }

    userPermissionOverwrites(id: string): OverwriteResolvable[] {
        return [
            {
                id: this.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: id,
                allow: [PermissionFlagsBits.ViewChannel]
            }
        ]
    }
}