const {
    SlashCommandBuilder,
} = require("discord.js");

// Replace with your actual BattleMetrics API logic
async function addUserToBMOrganisation(bmUserId, bmRole) {
    // Example: Use fetch or axios to call BM API
    // return await fetch('https://api.battlemetrics.com/organisations/xxx/users', { ... });
    // For now, simulate success:
    return { success: true };
}

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
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Discord role to assign")
                .setRequired(true)
        ),

    async execute(interaction) {
        const discordUser = interaction.options.getUser("user");
        const bmUserId = interaction.options.getString("bmuserid");
        const discordRole = interaction.options.getRole("role");

        // Add user to BM organisation
        const bmResult = await addUserToBMOrganisation(bmUserId, discordRole.name);

        if (!bmResult.success) {
            await interaction.reply({
                content: "Failed to add user to BattleMetrics organisation.",
                ephemeral: true,
            });
            return;
        }

        // Assign Discord role
        const member = await interaction.guild.members.fetch(discordUser.id);
        await member.roles.add(discordRole);

        await interaction.reply({
            content: `Added <@${discordUser.id}> to BM organisation and assigned role <@&${discordRole.id}>.`,
            ephemeral: true,
        });
    },
};