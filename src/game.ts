import { Client, Guild, ChannelType, PermissionFlagsBits, CategoryChannel, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, OverwriteResolvable, TextChannel, User, GuildMember, CategoryChannelType } from "discord.js";
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
    werewolvesChannel: TextChannel;

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
            .addFields(this.playerAndRolesFields);
        
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

    async configMessagePhase(interaction: ChatInputCommandInteraction) {
        const reply = await this.configMessageRefresh(interaction);

        while (true) {
            const buttonInteraction = await reply.awaitMessageComponent<ComponentType.Button>({ time: 60000 });

            await db.updateOrCreateUser(interaction.user.id, interaction.user.username);

            switch (buttonInteraction.customId) {
                case "join":
                    // Check if the user is already in the game
                    if (this.players_ids.includes(buttonInteraction.user.id)) {
                        await buttonInteraction.reply({ content: "Vous êtes déjà dans la partie.", ephemeral: true });
                        break;
                    }

                    // Add the user to the game
                    this.players_ids.push(buttonInteraction.user.id);

                    await this.configMessageRefresh(buttonInteraction);
                    break;
                
                case "leave":
                    // Check if the user is in the game
                    if (!this.players_ids.includes(buttonInteraction.user.id)) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas dans la partie.", ephemeral: true });
                        break;
                    }

                    // Remove the user from the game
                    this.players_ids = this.players_ids.filter(id => id !== buttonInteraction.user.id);

                    await this.configMessageRefresh(buttonInteraction);
                    break;
                
                case "start":
                    // Check if the user is the creator of the game
                    if (buttonInteraction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    }

                    // Check if there is at least 2 players
                    if (this.players_ids.length < 2) {
                        await buttonInteraction.reply({ content: "Il faut au moins 2 joueurs pour lancer la partie.", ephemeral: true });
                        break;
                    }
                    
                    // Check if there is as many roles as players
                    if (this.players_ids.length !== this.roles.length) {
                        await buttonInteraction.reply({ content: "Il faut autant de rôles que de joueurs pour lancer la partie.", ephemeral: true });
                        break;
                    }

                    // Change the message
                    let embed = new EmbedBuilder()
                        .setTitle("Partie en cours")
                        .setColor(`#${process.env.MAIN_COLOR}`)
                        .addFields(this.playerAndRolesFields);
                
                    await buttonInteraction.update({ components: [], embeds: [embed] });

                    // Exit the function
                    return;

                // Handle roles buttons
                default:
                    // Check if the button custom id is a role
                    if (!Object.keys(roles).includes(buttonInteraction.customId)) {
                        throw new Error("Unknown button custom id");
                    }

                    // Check if the user is the creator of the game
                    if (interaction.user.id !== this.creator_id) {
                        await buttonInteraction.reply({ content: "Vous n'êtes pas l'hôte de la partie.", ephemeral: true });
                        break;
                    }

                    // Add the role to the game
                    this.roles.push(roles[buttonInteraction.customId as keyof typeof roles]);

                    // Remove the first role from the game if there are too many roles
                    if (this.roles.length > this.players_ids.length) {
                        this.roles.shift();
                    }

                    await this.configMessageRefresh(buttonInteraction);
                    break;
            }
        }
    }

    async createPlayers() {
        this.roles = shuffleArray(this.roles);
        this.players = [];
        for (let i=0; this.players_ids.length > i; i++) {
            this.players.push(new Player(await this.guild.members.fetch(this.players_ids[i]), this.roles[i]));
        }
    }

    async createChannel<T extends CategoryChannelType>(name: string, permissionOverwrites: OverwriteResolvable[], type: T) {
        return await this.categoryChannel.children.create({
            name: name,
            type: type,
            permissionOverwrites: permissionOverwrites
        });
    }

    async createChannels() {
        // Create category
        this.categoryChannel = await this.guild.channels.create({
            name: "Partie de Garou",
            type: ChannelType.GuildCategory,
            permissionOverwrites: this.generalPermissionOverwrites
        })

        // General
        this.generalChannel = await this.createChannel("Place du village", this.generalPermissionOverwrites, ChannelType.GuildText);

        // Send start message
        let embeds: EmbedBuilder[] = [];
        embeds.push(new EmbedBuilder()
            .setTitle("Place du village")
            .setColor(`#${process.env.MAIN_COLOR}`)
            .setDescription("Bienvenue sur la place du village !\n\nC'est ici que vous débatrez le jour pour éliminer un joueur suspect\n\nVous trouverez votre rôle dans le salon à votre nom.\nNe le partagez pas avec les autres joueurs ! 😉")
            .addFields(this.playerAndRolesFields)
        );

        // Warn players if there is/are admin(s) in the game
        let admins = this.players.filter(p => p.user.permissions.has(PermissionFlagsBits.Administrator));
        if (admins.length > 0) {
            embeds.push(new EmbedBuilder()
                .setTitle("Attention !")
                .setColor(`#${process.env.WARN_COLOR}`)
                .setDescription(`${admins.map(admin => `<@${admin.user.id}>`).join(", ")} est/sont administrateur(s) du serveur. Il(s) peut/peuvent donc voir tous les salons, y compris ceux privés. Attention à bien respecter les règles du jeu !`)
            );
        }

        await this.generalChannel.send({ embeds });

        // Werewolves
        if (this.roles.includes(roles.werewolf)) {
            this.werewolvesChannel = await this.createChannel("Tanière des loups", this.werewolvesPermissionOverwrites, ChannelType.GuildText);
        }

        // Create a channel for each player
        for (let player of this.players) {
            player.channel = await this.createChannel(player.user.user.username, this.userPermissionOverwrites(player.user.id), ChannelType.GuildText);

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
    }

    async init(interaction: ChatInputCommandInteraction) {
        await this.configMessagePhase(interaction);

        await this.createPlayers();

        await this.createChannels();
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

    get werewolvesPermissionOverwrites(): OverwriteResolvable[] {
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

    get playerAndRolesFields() {
        return [
            { name: "Joueurs :", value: this.players_ids.map(id => `• <@${id}>`).join("\n") || "Aucun joueur pour l'instant" },
            { name: "Rôles :", value: this.roles.map(role => `• ${role.name} ${role.emoji}`).join("\n") || "Aucun rôle pour l'instant" }
        ]
    }
}