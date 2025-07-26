const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user via BattleMetrics')
        .addStringOption(option =>
            option.setName('banid').setDescription('BattleMetrics Ban ID to unban').setRequired(true)
        ),
    async execute(interaction) {
        const banId = interaction.options.getString('banid');
        const bmToken = process.env.BM_API_TOKEN_BANEXPORT;

        // BattleMetrics unban API endpoint
        const url = `https://api.battlemetrics.com/bans/${banId}`;

        // Unban payload (expire the ban)
        const payload = {
            data: {
                type: "ban",
                id: banId,
                attributes: {
                    expires: new Date().toISOString()
                }
            }
        };

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${bmToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                await interaction.reply({
                    content: `Failed to unban user: ${errorText}`,
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: `Ban ${banId} has been expired (user unbanned).`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `Error unbanning user: ${error.message}`,
                ephemeral: true
            });
        }
    },
};      