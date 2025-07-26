
import { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } from 'discord.js';
import axios from 'axios';
import fs from 'fs-extra';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const BM_API = 'https://api.battlemetrics.com';
const { GUILD_ID, DISCORD_TOKEN, BM_API_KEY, LOG_CHANNEL_ID, MOD_ROLE_ID } = process.env;

let lastSeenBanId = null;
const TRACK_FILE = './track.json';

// Load lastSeenBanId from disk
function loadTracking() {
  if (fs.existsSync(TRACK_FILE)) {
    const data = fs.readJsonSync(TRACK_FILE);
    lastSeenBanId = data.lastSeenBanId;
  }
}

// Save lastSeenBanId to disk
function saveTracking() {
  fs.writeJsonSync(TRACK_FILE, { lastSeenBanId });
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  loadTracking();
  startPollingForBans();
});

function startPollingForBans() {
  setInterval(async () => {
    try {
      const response = await axios.get(\`\${BM_API}/bans?sort=-created&page[limit]=1\`, {
        headers: { Authorization: \`Bearer \${BM_API_KEY}\` }
      });

      const latestBan = response.data.data[0];
      if (!latestBan) return;

      if (latestBan.id !== lastSeenBanId) {
        lastSeenBanId = latestBan.id;
        saveTracking();
        console.log(\`📌 New Ban Detected: \${latestBan.id}\`);
        await handleNewBan(latestBan);
      }
    } catch (err) {
      console.error('Error polling BattleMetrics:', err.message);
    }
  }, 60 * 1000);
}

async function handleNewBan(ban) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  const playerId = ban.relationships?.player?.data?.id || 'Unknown';
  const reason = ban.attributes.reason || 'No reason';
  const duration = ban.attributes.expires
    ? Math.floor((new Date(ban.attributes.expires) - new Date(ban.attributes.created)) / 1000)
    : 0;

  const channelName = \`ban-\${playerId.slice(0, 6)}-\${Math.floor(Date.now() / 1000)}\`;

  const banChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText
  });

  const embed = new EmbedBuilder()
    .setTitle('🚫 Auto Ban Detected')
    .setColor('Orange')
    .addFields(
      { name: 'Player ID', value: playerId },
      { name: 'Reason', value: reason },
      { name: 'Duration (s)', value: duration.toString() }
    )
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(\`pass_\${ban.id}\`).setLabel('Pass').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`remove_\${ban.id}\`).setLabel('Remove Ban').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(\`update_\${ban.id}\`).setLabel('Update Ban').setStyle(ButtonStyle.Primary)
  );

  const roleMention = MOD_ROLE_ID ? \`<@&\${MOD_ROLE_ID}>\` : '';
  await banChannel.send({ content: roleMention, embeds: [embed], components: [buttons] });

  if (logChannel) await logChannel.send({ embeds: [embed] });
}

client.login(DISCORD_TOKEN);
