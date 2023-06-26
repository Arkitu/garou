import { Client, Guild, ChannelType, PermissionFlagsBits, CategoryChannel, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

enum Role {
    Villager,
    Werewolf
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
    players_ids: string[];

    /** All roles (usefull at the start of the game) */
    roles: Role[];

    players: Player[];
    client: Client;
    guild: Guild;
    categoryChannel: CategoryChannel;



    constructor(players_ids: string[] = [], client: Client, guild: Guild) {
        this.players_ids = players_ids;
        this.client = client;
        this.guild = guild;
    }

    async configMessage(interaction: ChatInputCommandInteraction) {
        let embed = new EmbedBuilder()
            .setTitle("Configuration de la partie")
            .setColor(`#${process.env.MAIN_COLOR}`)
            .setDescription("**Joueurs :**\n" + this.players_ids.map(id => `• <@${id}>`).join("\n"));
        
        let joinComponents = new ActionRowBuilder<ButtonBuilder>()
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
        
        await interaction.editReply({ embeds: [embed], components: [joinComponents] });
    }

    async init(interaction: ChatInputCommandInteraction) {
        await this.configMessage(interaction);

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
    }

    get generalPermissionOverwrites() {
        return [
            {
                id: this.guild.roles.everyone,
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
}