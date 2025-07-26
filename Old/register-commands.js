
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a player using BattleMetrics')
    .addStringOption(option => option.setName('player_id').setDescription('BattleMetrics player ID').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(option => option.setName('duration').setDescription('Duration in seconds').setRequired(false)),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a player by ban ID')
    .addStringOption(option => option.setName('ban_id').setDescription('Ban ID').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
