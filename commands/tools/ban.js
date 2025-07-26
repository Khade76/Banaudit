const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user via BattleMetrics')
        .addStringOption(option =>
            option.setName('steamid').setDescription('SteamID of the user to ban').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason').setDescription('Reason for ban').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('serverid').setDescription('BattleMetrics Server ID').setRequired(true)
        ),
    async execute(interaction) {
        const steamId = interaction.options.getString('steamid');
        const reason = interaction.options.getString('reason');
        const serverId = interaction.options.getString('serverid');
        const bmToken = process.env.BM_API_TOKEN_BANEXPORT;

        // BattleMetrics ban API endpoint
        const url = 'https://api.battlemetrics.com/bans';

        // Ban payload
        const payload = {
            data: {
                type: "ban",
                attributes: {
                    reason: reason,
                    identifiers: [
                        { type: "steamid", identifier: steamId.toString() }
                    ]
                },
                relationships: {
                    server: {
                        data: { type: "server", id: serverId }
                    }
                }
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${bmToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                await interaction.reply({
                    content: `Failed to ban user: ${errorText}`,
                    ephemeral: true
                });
                return;
            }

            const result = await response.json();
            await interaction.reply({
                content: `User with SteamID ${steamId} has been banned on server ${serverId} for: ${reason}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `Error banning user: ${error.message}`,
                ephemeral: true
            });
        }
    },
};