const express = require("express");
const dotenv = require("dotenv");
const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");

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

const token = process.env.TOKEN;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Load only BM-related commands
const fs = require("node:fs");
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);
client.commands = new Map();

for (const folder of commandFolders) {
    if (folder.toLowerCase().includes("bm")) { // Only load BM-related commands
        const subfoldersPath = path.join(foldersPath, folder);
        const subFolders = fs.readdirSync(subfoldersPath);
        for (const sub_folder of subFolders) {
            if (sub_folder.endsWith(".js")) {
                const filePath = path.join(subfoldersPath, sub_folder);
                const command = require(filePath);
                if ("data" in command && "execute" in command) {
                    client.commands.set(command.data.name, command);
                }
            } else {
                const sub_subfoldersPath = path.join(subfoldersPath, sub_folder);
                const commandFiles = fs
                    .readdirSync(sub_subfoldersPath)
                    .filter((file) => file.endsWith(".js"));
                for (const file of commandFiles) {
                    const filePath = path.join(sub_subfoldersPath, file);
                    const command = require(filePath);
                    if ("data" in command && "execute" in command) {
                        client.commands.set(command.data.name, command);
                    }
                }
            }
        }
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