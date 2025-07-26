/*
  BattleMetrics Ban Listener for Discord (Polling + Webhooks)
  ----------------------------------------------------------
  Enhanced to parse `ban.attributes.identifiers` array for player Name and SteamID,
  and to fetch the banning admin’s username via `/users/{id}`.
  
  Authors:
  Developer: @dickdiver44, @fornari
  Maintainer: @dickdiver44
  */
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ChannelType,
    PermissionsBitField,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addtothread")
        .setDescription("Ping one or more selected users via a button in a new channel")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The first user you want to ping")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target2")
                .setDescription("Another user to ping (optional)")
                .setRequired(false)
        )
        .addUserOption((option) =>
            option
                .setName("target3")
                .setDescription("Another user to ping (optional)")
                .setRequired(false)
        )
        .addUserOption((option) =>
            option
                .setName("target4")
                .setDescription("Another user to ping (optional)")
                .setRequired(false)
        )
        .addUserOption((option) =>
            option
                .setName("target5")
                .setDescription("Another user to ping (optional)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const userOptions = ["target", "target2", "target3", "target4", "target5"];
        const targetUsers = userOptions
            .map((opt) => interaction.options.getUser(opt))
            .filter(Boolean);

        // Create a new text channel in the guild
        const channelName = `ping-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
        const guild = interaction.guild;

        // You may want to set permissions so only the command user and target users can view the channel
        const permissionOverwrites = [
            {
                id: guild.roles.everyone,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            ...targetUsers.map((u) => ({
                id: u.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            })),
        ];

        try {
            const newChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites,
                reason: `Created by /addtothread for pinging users`,
            });

            // Build an embed to explain the action
            const embed = new EmbedBuilder()
                .setTitle("Ping Users")
                .setDescription(
                    `Click the button below to ping: ${targetUsers.map((u) => `${u}`).join(", ")}.`
                )
                .setColor(0x00ae86);

            // Create a button with a custom ID we'll listen for
            const pingButton = new ButtonBuilder()
                .setCustomId("ping_button")
                .setLabel("Ping")
                .setStyle(ButtonStyle.Primary);

            // Put the button into an ActionRow
            const row = new ActionRowBuilder().addComponents(pingButton);

            // Send the initial message with the embed and button in the new channel
            const sentMessage = await newChannel.send({
                embeds: [embed],
                components: [row],
            });

            // Create a collector that only accepts clicks from the user who invoked the command
            const filter = (i) =>
                i.customId === "ping_button" && i.user.id === interaction.user.id;

            const collector = sentMessage.createMessageComponentCollector({
                filter,
                componentType: ComponentType.Button,
                time: 60_000,
            });

            collector.on("collect", async (buttonInteraction) => {
                await buttonInteraction.reply({
                    content: targetUsers.map((u) => `${u}`).join(" "),
                    allowedMentions: { users: targetUsers.map((u) => u.id) },
                });

                pingButton.setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(pingButton);

                await sentMessage.edit({
                    embeds: [embed],
                    components: [disabledRow],
                });

                collector.stop();
            });

            collector.on("end", async (collected, reason) => {
                if (reason === "time") {
                    pingButton.setDisabled(true);
                    const disabledRow = new ActionRowBuilder().addComponents(pingButton);
                    await sentMessage.edit({
                        embeds: [embed],
                        components: [disabledRow],
                    });
                }
            });

            // Acknowledge the command so the user knows the channel was created
            await interaction.reply({
                content: `Created channel <#${newChannel.id}> to ping selected users.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.reply({
                content: `Failed to create channel: ${error.message}`,
                ephemeral: true,
            });
            return;
        }
    },
};