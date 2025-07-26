const express = require("express");
const dotenv = require("dotenv");
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const fs = require('node:fs');
const path = require('node:path');

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

// BattleMetrics ban export configuration
const bmToken = process.env.BM_API_TOKEN_BANEXPORT;
const serverIds = (process.env.SERVER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
const channelId = process.env.DISCORD_BANEXPORT_CHANNEL_ID;
const port = process.env.PORT || 3000;

// Express app for webhook listener
const app = express();

const clientId = process.env.CLIENTID;
const token = process.env.TOKEN;
const guildId = process.env.GUILD_ID; // If you want to register commands for a specific guild

// Load all command files
const commands = [];
const commandsPath = path.join(__dirname, 'commands', 'tools');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

// Register commands with Discord
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Registering slash commands...');
        // For global commands (may take up to 1 hour to appear)
        // await rest.put(Routes.applicationCommands(clientId), { body: commands });
        // For instant guild commands (appear immediately)
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Slash commands registered.');
    } catch (error) {
        console.error(error);
    }
})();

// Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Load only BM-related commands
client.commands = new Map();

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Handle execution of BM commands
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    }
});

// BM ban export webhook integration
const { initBanExport } = require('./Admin/banexport.js');
initBanExport({
    app,
    client,
    bmToken,
    serverIds,
    channelId
});

app.listen(port, () => console.log(`Listening on port ${port}`));
client.login(token);