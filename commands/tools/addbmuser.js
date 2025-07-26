const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const BM_ROLES = [
    { name: "Helper", value: "Helper" },
    { name: "Admin", value: "Admin" },
    { name: "Moderator", value: "Moderator" },
    { name: "Gym Trainer", value: "Gym Trainer" },
    { name: "R&E", value: "R&E" },
    { name: "Senior Trainer", value: "Senior Trainer" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addbmuser")
        .setDescription("Add a user to the BattleMetrics organisation and assign a Discord role")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Discord user to add")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("bmuserid")
                .setDescription("BattleMetrics User ID")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("email")
                .setDescription("User's email address")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("bmrole")
                .setDescription("BattleMetrics role to assign")
                .setRequired(true)
                .addChoices(...BM_ROLES)
        )
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Discord role to assign")
                .setRequired(true)
        ),

    async execute(interaction) {
        const discordUser = interaction.options.getUser("user");
        const bmUserId = interaction.options.getString("bmuserid");
        const email = interaction.options.getString("email");
        const bmRole = interaction.options.getString("bmrole");
        const discordRole = interaction.options.getRole("role");

        const bmToken = process.env.BM_API_TOKEN_BANEXPORT;
        const orgId = process.env.BM_ORG_ID;

        if (!bmToken || !orgId) {
            await interaction.reply({
                content: "BattleMetrics API token or organization ID is missing in .env.",
                ephemeral: true,
            });
            return;
        }

        // BattleMetrics API call to add user to organization
        const url = `https://api.battlemetrics.com/organizations/${orgId}/users`;
        const payload = {
            data: {
                type: "organizationUser",
                attributes: {
                    role: bmRole,
                    email: email
                },
                relationships: {
                    user: {
                        data: {
                            type: "user",
                            id: bmUserId
                        }
                    }
                }
            }
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    "Authorization": `Bearer ${bmToken}`,
                    "Content-Type": "application/json"
                }
            });

            // Assign Discord role
            const member = await interaction.guild.members.fetch(discordUser.id);
            await member.roles.add(discordRole);

            await interaction.reply({
                content: `Added <@${discordUser.id}> to BattleMetrics organization as ${bmRole} and assigned role <@&${discordRole.id}>.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.reply({
                content: `Error adding user to BattleMetrics organization: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};