import { Client, Guild, ChannelType, PermissionFlagsBits, CategoryChannel, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, OverwriteResolvable, TextChannel, User, GuildMember, CategoryChannelType, MessageCreateOptions, MappedChannelCategoryTypes, MessagePayload, InteractionUpdateOptions } from "discord.js";
import { shuffleArray } from "./utils.js";

let WEREWOLF_PHASE_DURATION = 60; // seconds
let DAY_PHASE_DURATION = 60; // seconds
let SEER_PHASE_DURATION = 60; // seconds
let END_PHASE_DURATION = 600; // seconds

if (process.env.ENV == "dev") {
    WEREWOLF_PHASE_DURATION = 10;
    DAY_PHASE_DURATION = 10;
    END_PHASE_DURATION = 10;
}

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
        color: "#d8b362",
        description: "Vous n'avez aucun pouvoir particulier. Vous gagnez avec le village : votre but est d'éliminer tous les loups-garous.",
        image_url: "https://www.regledujeu.fr/wp-content/uploads/simple-villageois.png"
    } as Role,
    werewolf: {
        name: "Loup-Garou",
        emoji: "🐺",
        color: "#6e1d1d",
        description: "Chaque nuit, vous vous réveillez avec les autres loups-garous pour dévorer un villageois. Vous gagnez avec les loups-garous : votre but est d'éliminer tous les villageois.",
        image_url: "https://www.regledujeu.fr/wp-content/uploads/loup-garou-1.png"
    } as Role,
    seer: {
        name: "Voyante",
        emoji: "👁️",
        color: "#702d5f",
        description: "Chaque nuit, vous vous réveillez pour espionner un joueur et découvrir sa véritable identité. Vous gagnez avec le village : votre but est d'éliminer tous les loups-garous.",
        image_url: "https://www.regledujeu.fr/wp-content/uploads/voyante-1.png"
    } as Role
};

export class Player {
    user: GuildMember;
    role: Role;
    alive: boolean;
    channel?: TextChannel;

    constructor(user: GuildMember, role: Role = roles.villager, alive: boolean = true) {
        this.user = user;
        this.role = role;
        this.alive = alive;
    }

    kill() {
        this.alive = false;
    }
}

function votesToCount(votes: Map<string, string>) {
    let count: {[key: string]: number} = {};
    for (let vote of votes.values()) {
        if (vote == "abstention") continue;
        count[vote] = (count[vote] || 0) + 1;
    }
    return count;
}

export class Game {
    /** Players discord ids (usefull at the start of the game) */
    players_ids: string[] = [];

    /** All roles in the game (usefull at the start of the game) */
    roles: Role[] = [];

    creator_id: string;

    playersRaw: Player[];
    client: Client;
    guild: Guild;

    finished: boolean = false;

    victims: Player[] = [];

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
            const buttonInteraction = await reply.awaitMessageComponent<ComponentType.Button>({ time: 10 * 60000 });

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
        this.playersRaw = [];
        for (let i=0; this.players_ids.length > i; i++) {
            this.playersRaw.push(new Player(await this.guild.members.fetch(this.players_ids[i]), this.roles[i]));
        }
    }

    async createChannel<T extends CategoryChannelType>(name: string, permissionOverwrites: OverwriteResolvable[] = [], type: T = ChannelType.GuildText as T): Promise<MappedChannelCategoryTypes[T]> {
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
            permissionOverwrites: [...this.generalViewPermissionOverwrites, ...this.unwritablesPermissionOverwrites]
        })

        // General
        this.generalChannel = await this.createChannel("Place du village") as TextChannel;

        // Send start message
        let embeds: EmbedBuilder[] = [];
        embeds.push(new EmbedBuilder()
            .setTitle("Place du village")
            .setDescription("Bienvenue sur la place du village !\n\nC'est ici que vous débatrez le jour pour éliminer un joueur suspect")
            .addFields(this.playerAndRolesFields)
        );

        embeds.push(new EmbedBuilder()
            .setTitle("Rappel des règles")
            .setDescription("Ceci n'est pas un rappel des règles du loup garou en général, mais des règles de cette adaptation sur Discord\n\n• Pas de message privé entre les joueurs pendant la partie\n\n• Les admins ne doivent pas regarder les salons auquels ils n'auraient normalement pas accès. Il est conseillé de joueur avec un compte non-admin.\n\n• Vous trouverez votre rôle dans le salon à votre nom. Ne le partagez pas avec les autres joueurs !\n\n• Amusez-vous et apréciez cette expérience de jeu que mon développeur s'est galéré à amener sur Discord !")
        );

        // Warn players if there is/are admin(s) in the game
        let admins = this.players.filter(p => p.user.permissions.has(PermissionFlagsBits.Administrator));
        if (admins.length > 0) {
            embeds.push(new EmbedBuilder()
                .setTitle("Attention !")
                .setColor("Red")
                .setDescription(`${admins.map(admin => `<@${admin.user.id}>`).join(", ")} est/sont administrateur(s) du serveur. Il(s) peut/peuvent donc voir tous les salons, y compris ceux privés. Attention à bien respecter les règles du jeu !`)
            );
        }

        let startMessage = await this.generalChannel.send({ embeds, components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("start")
                    .setLabel("Commencer la partie")
                    .setStyle(ButtonStyle.Primary)
            )
        ] });

        // Werewolves
        if (this.roles.includes(roles.werewolf)) {
            this.werewolvesChannel = await this.createChannel("Tanière des loups", this.werewolvesViewPermissionOverwrites) as TextChannel;
        
            // Send start message
            await this.werewolvesChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Tanière des loups")
                        .setColor(roles.werewolf.color)
                        .setDescription("Bienvenue dans la tanière des loups !\n\nC'est ici que vous déciderez de la victime de la nuit")   
                ]
            });
        }

        // Create a channel for each player
        for (let player of this.players) {
            player.channel = await this.createChannel(player.user.user.username, this.viewPermissionOverwrites(player.user.id)) as TextChannel;

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

        try {
            let inter = await startMessage.awaitMessageComponent({ filter: i => i.customId == "start" && i.user.id == this.creator_id, time: 10 * 60000 });
            await inter.update({ components: [] });
        } catch (e) {
            if (e instanceof Error && e.message === "Collector received no interactions before ending with reason: time") {
                await this.generalChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Partie annulée")
                            .setColor(`Red`)
                            .setDescription("La partie a été annulée car le créateur n'a pas cliqué sur le bouton de démarrage à temps")
                    ]
                });

                // TODO: Delete channels

                return;
            }
        }
    }

    async init(interaction: ChatInputCommandInteraction) {
        await this.configMessagePhase(interaction);

        await this.createPlayers();

        await this.createChannels();
    }

    /**
     * @param startTimestamp In seconds
     */
    getWerewolvesPhaseMessage(votes: Map<string, string>, startTimestamp: number, victim: Player | null = null) {
        if (victim) {
            return {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Phase des loups-garous")
                        .setColor(roles.werewolf.color)
                        .setDescription(`La victime est <@${victim.user.id}> !\n\nLe vote est terminé.`)
                ],
                components: []
            }
        }

        return {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase des loups-garous")
                    .setColor(roles.werewolf.color)
                    .setDescription("Choisissez votre victime\n\n" + this.getVoteDescription(votes, startTimestamp, WEREWOLF_PHASE_DURATION))
            ],
            components: this.getVoteComponents(this.players.filter(p => !this.werewolvesPlayers.includes(p)))
        }
    }

    /**
     * @param startTimestamp In seconds
     */
    getDayPhaseMessage(votes: Map<string, string>, startTimestamp: number, victim: Player | null = null) {
        if (victim) {
            return {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Phase du jour")
                        .setColor(roles.villager.color)
                        .setDescription(`La victime est <@${victim.user.id}> !\n\nLe vote est terminé.`)
                ],
                components: []
            }
        }

        return {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase du jour")
                    .setColor(roles.villager.color)
                    .setDescription("Choisissez votre victime\n\n" + this.getVoteDescription(votes, startTimestamp, DAY_PHASE_DURATION))
            ],
            components: this.getVoteComponents(this.players.filter(p => !this.werewolvesPlayers.includes(p)))
        }
    }

    /**
     * @param startTimestamp In seconds
     */
    getSeerPhaseMessage(votes: Map<string, string>, startTimestamp: number, victim: Player | null = null) {
        if (victim) {
            return {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Phase de la voyante")
                        .setColor(roles.seer.color)
                        .setDescription(`${victim.user.user.username} est ${victim.role.name} !`)
                ],
                components: []
            }
        }

        return {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase de la voyante")
                    .setColor(roles.seer.color)
                    .setDescription("Choisissez la personne dont vous voulez connaître le rôle\n" + this.getVoteDescription(votes, startTimestamp, SEER_PHASE_DURATION))
            ],
            components: this.getVoteComponents(this.players.filter(p => p.role.name != roles.seer.name))
        }
    }

    async werewolvesPhase() {
        if (this.werewolvesPlayers.length == 0) return;

        await this.generalChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase des loups-garous")
                    .setColor(roles.werewolf.color)
                    .setDescription("Les loups-garous se réveillent et décident de la victime de la nuit")
            ]
        });

        this.victims.push(await this.votePhase(this.werewolvesPlayers, this.players.filter(p => !this.werewolvesPlayers.includes(p)), WEREWOLF_PHASE_DURATION, this.werewolvesChannel, this.getWerewolvesPhaseMessage.bind(this)));

        // Disallow the werewolves send messages
        await this.werewolvesChannel.permissionOverwrites.set(this.werewolvesViewPermissionOverwrites);
    }

    async dayPhase() {
        await this.generalChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase du jour")
                    .setColor(roles.villager.color)
                    .setDescription("Le village se réveille et découvre la/les victime de la nuit")
            ]
        });

        await this.resolveVictims();

        // Allow the players send messages
        await this.generalChannel.permissionOverwrites.set(this.writablesPermissionOverwrites);

        // Vote for the victim
        const victim = await this.votePhase(this.players, this.players, DAY_PHASE_DURATION, this.generalChannel, this.getDayPhaseMessage.bind(this));

        // Disallow the players send messages
        await this.generalChannel.permissionOverwrites.set(this.unwritablesPermissionOverwrites);

        await this.resolveVictim(victim);
    }

    async seerPhase() {
        if (!this.seerPlayer) return;

        await this.generalChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase de la voyante")
                    .setColor(roles.seer.color)
                    .setDescription("La voyante se réveille et découvre le rôle d'un joueur")
            ]
        });

        const player = await this.seerPlayer.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Phase de la voyante")
                    .setColor(roles.seer.color)
                    .setDescription("Choisissez un joueur")
            ]
        });

        const target = await this.votePhase([this.seerPlayer], this.players.filter(p => p.role.name != roles.seer.name), SEER_PHASE_DURATION, this.seerPlayer.channel, this.getSeerPhaseMessage.bind(this));
    }

    /**
     * @returns true if the game is finished
     */
    async checkWin(): Promise<boolean> {
        const werewolvesAlive = this.werewolvesPlayers.filter(p => !this.victims.includes(p)).length;
        const villagersAlive = this.players.filter(p => !this.victims.includes(p)).length - werewolvesAlive;

        if (villagersAlive == 0 && werewolvesAlive == 0) {
            await this.resolveVictims();
            await this.generalChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Égalité !")
                        .setColor(roles.villager.color)
                        .setDescription("Il n'y a plus personne en vie !")
                ]
            });
        } else if (werewolvesAlive == 0) {
            await this.resolveVictims();
            await this.generalChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Victoire des villageois !")
                        .setColor(roles.villager.color)
                        .setDescription("Les loups-garous ont été tous tués !")
                ]
            });
        } else if (villagersAlive == 0) {
            await this.resolveVictims();
            await this.generalChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Victoire des loups-garous !")
                        .setColor(roles.werewolf.color)
                        .setDescription("Les loups-garous ont gagné !")
                ]
            });
        } else {
            this.finished = false;
            return this.finished;
        }

        this.finished = true;
        return this.finished;
    }

    async loop() {
        await this.seerPhase();

        await this.werewolvesPhase();

        if (await this.checkWin()) return;

        await this.dayPhase();

        if (await this.checkWin()) return;
    }

    async finish() {
        await this.generalChannel.permissionOverwrites.set(this.writablesPermissionOverwrites);

        await this.generalChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Fin de la partie")
                    .setDescription(`La partie est terminée ! Les salons vont être supprimés <t:${Math.floor((Date.now()/1000)+END_PHASE_DURATION)}:R>`)
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("clear_channels")
                            .setLabel("Supprimer les salons")
                            .setStyle(ButtonStyle.Danger)
                    )
            ]
        });

        try {
            await this.generalChannel.awaitMessageComponent({
                filter: i => i.customId == "clear_channels" && i.user.id == this.creator_id,
                time: END_PHASE_DURATION * 1000
            });
        } catch (e) {
            if (e instanceof Error && e.message === "Collector received no interactions before ending with reason: time") return;
            throw e;
        }

        for (const channel of this.categoryChannel.children.cache.values()) {
            await channel.delete();
        }

        await this.categoryChannel.delete();
    }

    async start(interaction: ChatInputCommandInteraction) {
        await this.init(interaction);

        while (!this.finished) {
            await this.loop();
        }

        await this.finish();
    }

    get generalViewPermissionOverwrites(): OverwriteResolvable[] {
        return [
            {
                id: this.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...this.players.map(p => {
                return {
                    id: p.user.id,
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            })
        ]
    }

    get werewolvesViewPermissionOverwrites(): OverwriteResolvable[] {
        return [
            {
                id: this.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...this.werewolvesPlayers.map(p => {
                return {
                    id: p.user.id,
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            })
        ]
    }

    get writablesPermissionOverwrites(): OverwriteResolvable[] {
        return [
            ...this.players.map(p => {
                return {
                    id: p.user.id,
                    allow: [PermissionFlagsBits.SendMessages]
                }
            })
        ]
    }

    get unwritablesPermissionOverwrites(): OverwriteResolvable[] {
        return [
            ...this.players.map(p => {
                return {
                    id: p.user.id,
                    deny: [PermissionFlagsBits.SendMessages]
                }
            })
        ]
    }

    viewPermissionOverwrites(id: string): OverwriteResolvable[] {
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

    get werewolvesPlayers() {
        return this.players.filter(player => player.role.name === roles.werewolf.name);
    }

    get seerPlayer() {
        return this.players.find(player => player.role.name === roles.seer.name);
    }

    get players() {
        return this.playersRaw.filter(player => player.alive);
    }

    getVoteComponents(players: Player[]) {
        return [new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                [...players
                    .map(p => 
                        new ButtonBuilder()
                            .setCustomId(p.user.id)
                            .setLabel(p.user.user.username)
                            .setStyle(ButtonStyle.Primary)
                    ),
                    new ButtonBuilder()
                        .setCustomId("cancel")
                        .setLabel("Annuler")
                        .setStyle(ButtonStyle.Danger)
                ]
            )]
    }

    getVoteDescription(votes: Map<string, string>, startTimestamp: number, phaseDuration: number) {
        const distribution: { [key: string]: string[] } = {};

        for (const [voterId, votedId] of votes.entries()) {
            if (distribution[votedId]) {
                distribution[votedId].push(voterId);
            } else {
                distribution[votedId] = [voterId];
            }
        }

        return Object.entries(distribution)
            .map(([voted, voters]) => `• <@${voted}> : <@` + voters.join(">, <@") + ">")
            .join("\n") +
            `\n\nLe vote se termine <t:${startTimestamp + phaseDuration}:R>` +
            "\nSi il y a égalité à la fin du temps, la cible sera choisie aléatoirement parmi les joueurs à égalité."
    }

    getVictimFromVotes(votes: Map<string, string>, targets: Player[]) {
        // If no one voted, a random player is chosen
        if (votes.size == 0) return targets[Math.floor(Math.random() * targets.length)];

        const count = votesToCount(votes);

        const victimId = Object.entries(count).reduce((a, b) => a[1] > b[1] ? a : b)[0];

        return this.players.find(p => p.user.id == victimId);
    }

    async votePhase(voters: Player[], targets: Player[], phaseDuration: number, channel:TextChannel, getVoteMessage: (votes: Map<string, string>, startTimestamp: number, victim?: Player | null) => { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] }) {
        const votes = new Map<string, string>();

        const startTimestamp = Math.floor(Date.now() / 1000);

        let msg = await channel.send(getVoteMessage(votes, startTimestamp));

        let victim: Player;
        while (true) {
            let choice;

            try {
                choice = await msg.awaitMessageComponent({ time: phaseDuration * 1000, componentType: ComponentType.Button });
            } catch (e) {
                if (e instanceof Error && e.message === "Collector received no interactions before ending with reason: time") {
                    victim = this.getVictimFromVotes(votes, targets);
                    msg = await msg.edit(getVoteMessage(votes, startTimestamp, victim));
                    break;
                } else {
                    throw e;
                }
            }

            if (choice.customId == "cancel") {
                votes.delete(choice.user.id);
            } else {
                votes.set(choice.user.id, choice.customId);
            }

            if (votes.size == voters.length) {
                victim = this.getVictimFromVotes(votes, targets);
                await choice.update(getVoteMessage(votes, startTimestamp, victim));
                break;
            }
        }

        return this.getVictimFromVotes(votes, targets);
    }

    async resolveVictim(victim: Player) {
        this.players.find(p => p.user.id == victim.user.id).kill();

        await this.generalChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`${victim.user.displayName} est mort !`)
                    .setColor(victim.role.color)
                    .setDescription(`<@${victim.user.id}> était ${victim.role.name}`)
                    .setThumbnail(victim.role.image_url)
            ]
        });

        this.categoryChannel.permissionOverwrites.edit(victim.user.id, { ViewChannel: true, SendMessages: false });
    }

    async resolveVictims() {
        for (const victim of shuffleArray(this.victims)) {
            await this.resolveVictim(victim);
        }
        this.victims = [];
    }
}