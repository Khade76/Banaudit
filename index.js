const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");
const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    ActivityType,
    ChannelType,
    MessageFlags,
} = require("discord.js");

const dotenv = require("dotenv");
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

// BattleMetrics ban export configuration
const bmToken = process.env.BM_API_TOKEN_BANEXPORT;
const bmSecret = process.env.BM_WEBHOOK_SECRET || '';
const serverIds = (process.env.SERVER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
const channelId = process.env.DISCORD_BANEXPORT_CHANNEL_ID;
const port = process.env.PORT || 3000;

// Express app for webhook listener
const app = express();

const { getConfigValue } = require("./handlers/config_handler");
const { sendEmbedLog } = require("./util/log");
const { setClient } = require("./api/ErrorHandling/wrongformat");
const {
    setupVoiceActivityTracker,
    setupMessageActivityTracker,
} = require("./handlers/activity_handler");
const { getMedalCategories } = require("./handlers/medal_handler");
const {
    interactionButtonHandler,
} = require("./handlers/interactions/button_handler");
const {
    interactionModalHandler,
} = require("./handlers/interactions/modal_handler");
const token = process.env.TOKEN;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});
const { setupMemberRemovePinger } = require('./handlers/remove_handler.js')
client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const subfoldersPath = path.join(foldersPath, folder);
    const subFolders = fs.readdirSync(subfoldersPath);
    //sub cats
    for (const sub_folder of subFolders) {
        if (sub_folder.endsWith(".js")) {
            const filePath = path.join(subfoldersPath, sub_folder);
            const command = require(filePath);
            if ("data" in command && "execute" in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(
                    `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
                );
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
                } else {
                    console.log(
                        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
                    );
                }
            }
        }
    }
}

// Handles interaction API calls
client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        return await interactionButtonHandler(interaction);
    }

    if (interaction.isModalSubmit()) {
        return await interactionModalHandler(interaction);
    }
});

client.once(Events.ClientReady, () => {
    console.log("Ready! " + process.env.DESC);

    client.user.setActivity(process.env.DESC, { type: ActivityType.Watching });
    setClient(client);

    console.log(`Logged in as ${client.user.tag}!`);
    setupMessageActivityTracker(client);
    setupVoiceActivityTracker(client);
    setupMemberRemovePinger(client);
});

client.on("messageCreate", (message) => {
    var titus = client.users.cache.get("455300869085462528");

    if (!message.guildId && message.author !== client.user) {
        titus.send(
            `**DM** \n by: ${message.author} \n content: ${message.content}`
        );
    }
});
// handle autocomplete of commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isAutocomplete()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
        await command.autocomplete(interaction);
    } catch (error) {
        console.error(error);
    }
});

// handle execution of commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    console.log(interaction.commandName + " was called");

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});

var join2createChannel = null;
var guild = null;
var join2createCat = null;

var channelList = new Map();

client.on("voiceStateUpdate", async (oldState, newState) => {
    if (join2createChannel == null) {
        join2createChannel = await getConfigValue("join2create");
    }
    if (guild == null) {
        guild = await client.guilds.cache.get(process.env.GUILDID);
    }
    if (join2createCat == null) {
        join2createCat = await client.channels.fetch(
            await getConfigValue("join2create_categorie ")
        );
    }

    if (newState.channelId == join2createChannel) {
        //console.log("user joined the create channel");

        guild.channels
            .create({
                name: `${newState.member.nickname}'s Channel`,
                type: ChannelType.GuildVoice,
                parent: join2createCat,
            })
            .then(async (channel) => {
                newState.member.voice.setChannel(channel);
                channelList.set(channel.id, channel);
                sendEmbedLog(
                    client,
                    "Created channel",
                    `channel created via the join2create channel for ${newState.member}`,
                    0o3366,
                    []
                );
            });
    } else if (channelList.has(oldState.channelId)) {
        let channel = channelList.get(oldState.channelId);
        let channelName = channel.name;

        if (channel.members.size == 0)
            channel.delete().then(() => {
                channelList.delete(oldState.channelId);
                sendEmbedLog(
                    client,
                    "Deleted channel",
                    `channel delete after everyone leaving the channel. Channel name: ${channelName}`,
                    0o3366,
                    []
                );
            });
    }
});

const { initBanExport } = require('./senioradmin/banexport.js');
initBanExport({
    app,
    client,
    bmToken,
    serverIds,
    channelId
});
app.listen(port, () => console.log(`Listening on port ${port}`));
client.login(token);