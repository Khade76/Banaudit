const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banpoll')
        .setDescription('Polls BattleMetrics for new bans'),
    async execute(interaction) {
        // Your polling logic here
        await interaction.reply('Polling BattleMetrics...');
    }
};  