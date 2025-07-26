require('dotenv').config();
const fetch = require('node-fetch');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// Load environment variables
const bmToken = process.env.BM_API_TOKEN_BANEXPORT;
const serverIds = (process.env.SERVER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const discordToken = process.env.TOKEN;
const channelId = process.env.DISCORD_BANEXPORT_CHANNEL_ID;
const clientId = process.env.CLIENTID;
const serverMap = { '1': '23928693', '2': '25285704', '3': '28062288', '4': '33204733' };

function validateEnv() {
    const missing = [];
    if (!bmToken) missing.push('BM_API_TOKEN_BANEXPORT');
    if (!serverIds.length) missing.push('SERVER_IDS');
    if (!discordToken) missing.push('TOKEN');
    if (!channelId) missing.push('DISCORD_BANEXPORT_CHANNEL_ID');
    if (!clientId) missing.push('CLIENT_ID');
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing.join(', '));
        process.exit(1);
    }
}

/**
 * Fetch all bans with pagination
 */
async function fetchAllBans(serverId, banlistId = null, sortOrder = 'asc') {
    const allBans = [];
    let nextUrl = new URL('https://api.battlemetrics.com/bans');
    nextUrl.searchParams.set('filter[server]', serverId);
    if (banlistId) nextUrl.searchParams.set('filter[banList]', banlistId);
    nextUrl.searchParams.set('sort', sortOrder === 'desc' ? '-timestamp' : 'timestamp');
    nextUrl.searchParams.set('page[size]', '100');
    nextUrl.searchParams.set('include', 'user');

    while (nextUrl) {
        const res = await fetch(nextUrl.toString(), {
            headers: { Authorization: `Bearer ${bmToken}` }
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '<no body>');
            throw new Error(`BattleMetrics API ${res.status}: ${text}`);
        }
        const { data, links } = await res.json();
        allBans.push(...data);
        nextUrl = links?.next
            ? (links.next.startsWith('http') ? links.next : `https://api.battlemetrics.com${links.next}`)
            : null;
        await new Promise(r => setTimeout(r, 300)); // rate limit
    }

    return allBans;
}

// Helper to strip HTML tags
function stripHtml(html = '') {
    return html.replace(/<[^>]*>/g, '').trim();
}

async function fetchServerName(serverId) {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${serverId}`, {
            headers: { Authorization: `Bearer ${bmToken}` }
        });
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        return stripHtml(data.attributes.name);
    } catch {
        return serverId;
    }
}

async function parseIdentifiers(identifiers = [], fallbackName) {
    let playerName = fallbackName || 'Unknown';
    let steamId = 'Unknown';
    for (const id of identifiers) {
        const t = id.type?.toLowerCase();
        if (t === 'name' && id.identifier) playerName = id.identifier;
        if (t === 'steamid' && id.identifier) steamId = id.identifier;
    }
    return { playerName, steamId };
}

async function buildEmbedForBan(ban) {
    const serverId = ban.relationships.server.data.id;
    const { playerName, steamId } = await parseIdentifiers(ban.attributes.identifiers, ban.meta?.player);
    const serverName = await fetchServerName(serverId);

    const reasonRaw = ban.attributes.reason || '';
    const reason = stripHtml(reasonRaw) || 'No reason provided';
    const notes = stripHtml(ban.attributes.notes) || 'No notes provided';
    const createdAt = new Date(ban.attributes.timestamp);
    const bstTime = createdAt.toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false });

    let expiresText = 'Perm';
    if (ban.attributes.expires) {
        const diff = new Date(ban.attributes.expires).getTime() - Date.now();
        if (diff <= 0) expiresText = 'Expired';
        else if (diff < 3600000) expiresText = `${Math.round(diff / 60000)}m`;
        else if (diff < 86400000) expiresText = `${Math.round(diff / 3600000)}h`;
        else expiresText = `${Math.round(diff / 86400000)}d`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🚫 Ban Exported')
        .setURL(`https://battlemetrics.com/bans/${ban.id}`)
        .addFields(
            { name: 'Server', value: `${serverName} (ID: ${serverId})`, inline: false },
            { name: 'Player', value: playerName, inline: false },
            { name: 'SteamID', value: steamId, inline: false },
            { name: 'When (BST)', value: bstTime, inline: true },
            { name: 'Expires In', value: expiresText, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Notes', value: notes, inline: false }
        )
        .setTimestamp(createdAt);

    return { embed, playerName, bstTime, banId: ban.id };
}

validateEnv();

// Register slash command
const exportOldBansCommand = new SlashCommandBuilder()
    .setName('exportoldbans')
    .setDescription('Export historical bans from BattleMetrics')
    .addIntegerOption(opt => opt.setName('server').setDescription('Server number').setRequired(false))
    .addStringOption(opt =>
        opt.setName('banlist')
            .setDescription('Ban list type')
            .addChoices(
                { name: 'Temp', value: 'temp' },
                { name: 'CBL', value: 'cbl' }
            )
    )
    .addIntegerOption(opt => opt.setName('year').setDescription('Year').setRequired(false))
    .addIntegerOption(opt => opt.setName('month').setDescription('Month (1-12)').setRequired(false))
    .addIntegerOption(opt => opt.setName('limit').setDescription('Max threads').setRequired(false))
    .addStringOption(opt =>
        opt.setName('sort')
            .setDescription('Sort order')
            .addChoices(
                { name: 'Ascending', value: 'asc' },
                { name: 'Descending', value: 'desc' }
            )
    );

const rest = new REST({ version: '10' }).setToken(discordToken);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [exportOldBansCommand.toJSON()] });
        console.log('Slash commands registered.');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
})();

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'exportoldbans') return;
    const serverNum = interaction.options.getInteger('server');
    const banlist = interaction.options.getString('banlist');
    const year = interaction.options.getInteger('year');
    const month = interaction.options.getInteger('month');
    const limit = interaction.options.getInteger('limit');
    const sortOrder = interaction.options.getString('sort') || 'asc';
    const chosen = serverNum ? [serverMap[serverNum]] : serverIds;

    if ((year && (year < 1970 || year > 3000)) || (month && (month < 1 || month > 12)) || (limit && limit <= 0)) {
        return interaction.reply({ content: '❗ Invalid option(s) provided.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const forum = await client.channels.fetch(channelId);
    if (!forum || forum.type !== ChannelType.GuildForum) {
        return interaction.editReply('Error: the configured channel is not a forum.');
    }

    await interaction.editReply('🔄 Fetching historical bans… please wait.');

    let totalPosted = 0;
    outer: for (const sid of chosen) {
        let allBans;
        try {
            const banListId = banlist === 'temp'
                ? 'd1510a40-e86a-11ed-a6e5-65a7748123a6'
                : banlist === 'cbl'
                    ? 'e01313d0-7a37-11ed-bd57-39926c02406c'
                    : null;
            allBans = await fetchAllBans(sid, banListId, sortOrder);
        } catch (err) {
            console.error(`Failed to fetch bans for ${sid}:`, err);
            await interaction.followUp(`❗ Fetch error for server \`${sid}\`: ${err.message}`);
            continue;
        }

        if (!allBans.length) {
            await interaction.followUp(`ℹ️ No bans for server \`${sid}\`.`);
            continue;
        }

        for (const ban of allBans) {
            const createdAt = new Date(ban.attributes.timestamp);
            if (isNaN(createdAt)) continue;
            if (year && createdAt.getUTCFullYear() !== year) continue;
            if (month && (createdAt.getUTCMonth() + 1) !== month) continue;

            try {
                const { embed, playerName, bstTime, banId } = await buildEmbedForBan(ban);
                const claimBtn = new ButtonBuilder()
                    .setCustomId(`claim_ban_${banId}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Primary);
                const failBtn = new ButtonBuilder()
                    .setCustomId(`audit_failed_${banId}`)
                    .setLabel('Audit failed')
                    .setStyle(ButtonStyle.Danger);
                const passBtn = new ButtonBuilder()
                    .setCustomId(`audit_passed_${banId}`)
                    .setLabel('Audit passed')
                    .setStyle(ButtonStyle.Success);
                const row = new ActionRowBuilder().addComponents(claimBtn, failBtn, passBtn);

                const thread = await forum.threads.create({
                    name: `Ban: ${playerName} (${bstTime})`.slice(0, 100),
                    autoArchiveDuration: 1440,
                    message: { embeds: [embed], components: [row] }
                });

                const starter = await thread.fetchStarterMessage().catch(async () => (await thread.messages.fetch({ limit: 1 })).first());
                let claimedBy = null;

                starter.createMessageComponentCollector({ time: 86400000 })
                    .on('collect', async i => {
                        if (i.customId === `claim_ban_${banId}`) {
                            if (!claimedBy) {
                                claimedBy = i.user.id;
                                await thread.members.add(i.user.id);
                                const claimedBtn = ButtonBuilder.from(claimBtn)
                                    .setLabel(`Claimed by ${i.user.tag}`)
                                    .setStyle(ButtonStyle.Success);
                                await i.update({ components: [new ActionRowBuilder().addComponents(claimedBtn, failBtn, passBtn)] });
                            } else if (claimedBy === i.user.id) {
                                claimedBy = null;
                                await thread.members.remove(i.user.id).catch(() => { });
                                await i.update({ components: [new ActionRowBuilder().addComponents(claimBtn, failBtn, passBtn)] });
                            } else {
                                await i.reply({ content: 'Only the claimer can unclaim.', ephemeral: true });
                            }
                        } else if (i.customId === `audit_failed_${banId}`) {
                            // Unban via BattleMetrics API
                            try {
                                await fetch(`https://api.battlemetrics.com/bans/${banId}`, {
                                    method: 'PATCH',
                                    headers: {
                                        'Authorization': `Bearer ${bmToken}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        data: { type: 'ban', id: banId, attributes: { expires: new Date().toISOString() } }
                                    })
                                });
                            } catch (err) {
                                console.error('Failed to unban via BattleMetrics:', err);
                            }
                            await i.update({ content: '🔴 Audit failed: User has been unbanned and thread closed.', components: [] });
                            await thread.setName(`Audit Failed ${thread.name}`);
                            await thread.setLocked(true, 'Audit failed');
                            await thread.setArchived(true, 'Audit failed');
                        } else if (i.customId === `audit_passed_${banId}`) {
                            await i.update({ content: '🟢 Audit passed: Thread closed.', components: [] });
                            await thread.setName(`Audit Passed ${thread.name}`);
                            await thread.setLocked(true, 'Audit passed');
                            await thread.setArchived(true, 'Audit passed');
                        }
                    });

                totalPosted++;
                if (limit && totalPosted >= limit) break outer;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {
                console.error('Thread creation error:', err);
            }
        }
    }

    await interaction.editReply(`✅ Done! Created ${totalPosted} threads.`);
});
function initBanExport({ app }) {
    app.post('/battlemetrics/webhook', async (req, res) => {
        res.status(200).send('OK');
    });
}

module.exports = {
    initBanExport,
};
client.login(discordToken);