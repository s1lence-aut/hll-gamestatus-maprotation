import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const servers = process.env.RCON_SERVERS ? process.env.RCON_SERVERS.split(',') : [];
const tokens = process.env.RCON_TOKENS ? process.env.RCON_TOKENS.split(',') : [];
const servernames = process.env.RCON_SERVERNAMES ? process.env.RCON_SERVERNAMES.split(',') : [];

const activeServers = Math.min(servers.length, tokens.length, servernames.length);

const embedColors = [
    0xFF5733, 0x33FF57, 0x3357FF, 0xFF33F5, 0xFFFF33
];

// Commit 2: Set up logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// Commit 3: Define watchdog function
function watchdog() {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTime;

    if (timeSinceLastUpdate > 5 * 60 * 1000) {
        logger.warn('Watchdog: No updates for 5 minutes, restarting update processes');
        safeUpdateMapRotation();
        safeUpdateCurrentMaps();
    }

    lastUpdateTime = currentTime;
}

setInterval(watchdog, 60000);

// Commit 4: Define map descriptions and thumbnails
const thumbnails = [
    'https://i.imgur.com/JnUz7dA.png',
    'https://i.imgur.com/nHnVIcv.png',
    'https://i.imgur.com/yFS7P0S.png',
    'https://i.imgur.com/63mnJjE.png'
];

const mapDescriptions = {
    'carentan_offensive_ger': '☀️ Carentan Offensive GER',
    'carentan_offensive_us': '☀️ Carentan Offensive US',
    'carentan_warfare': '☀️ Carentan',
    'carentan_warfare_night': '🌙 Carentan',
    'driel_offensive_ger': '☀️ Driel Offensive GER',
    'driel_offensive_us': '☀️ Driel Offensive US',
    'driel_warfare': '☀️ Driel',
    'driel_warfare_night': '🌙 Driel',
    'DRL_S_1944_Day_P_Skirmish': '☀️ Driel Tag Skirmish',
    'DRL_S_1944_Night_P_Skirmish': '🌙 Driel Night Skirmish',
    'DRL_S_1944_P_Skirmish': '☀️ Driel Skirmish',
    'ELA_S_1942_Night_P_Skirmish': '🌙 El Alamein Skirmish',
    'ELA_S_1942_P_Skirmish': '☀️ El Alamein Skirmish',
    'elalamein_offensive_CW': '☀️ El Alamein Offensive CW',
    'elalamein_offensive_ger': '☀️ El Alamein Offensive GER',
    'elalamein_warfare': '☀️ El Alamein',
    'elalamein_warfare_night': '🌙 El Alamein',
    'foy_offensive_ger': '☀️ Foy Offensive GER',
    'foy_offensive_us': '☀️ Foy Offensive US',
    'foy_warfare': '☀️ Foy',
    'foy_warfare_night': '🌙 Foy',
    'hill400_offensive_ger': '☀️ Hill 400 Offensive GER',
    'hill400_offensive_US': '☀️ Hill 400 Offensive US',
    'hill400_warfare': '☀️ Hill 400',
    'hurtgenforest_offensive_ger': '☀️ Hürtgenwald Offensive GER',
    'hurtgenforest_offensive_US': '☀️ Hürtgenwald Offensive US',
    'hurtgenforest_warfare_V2': '☀️ Hürtgenwald',
    'hurtgenforest_warfare_V2_night': '🌙 Hürtgenwald',
    'kharkov_offensive_ger': '☀️ Charkow Offensive GER',
    'kharkov_offensive_rus': '☀️ Charkow Offensive RUS',
    'kharkov_warfare': '☀️ Charkow',
    'kharkov_warfare_night': '🌙 Charkow',
    'kursk_offensive_ger': '☀️ Kursk Offensive GER',
    'kursk_offensive_rus': '☀️ Kursk Offensive RUS',
    'kursk_warfare': '☀️ Kursk',
    'kursk_warfare_night': '🌙 Kursk',
    'mortain_offensiveger_day': '☀️ Mortain Offensive GER',
    'mortain_offensiveger_overcast': '☁️ Mortain Offensive GER',
    'mortain_offensiveUS_day': '☀️ Mortain Offensive US',
    'mortain_offensiveUS_overcast': '☁️ Mortain Offensive US',
    'mortain_skirmish_day': '☀️ Mortain Tag Skirmish',
    'mortain_skirmish_overcast': '☁️ Mortain Skirmish',
    'mortain_warfare_day': '☀️ Mortain',
    'mortain_warfare_evening': '☀️ Mortain',
    'mortain_warfare_overcast': '☁️ Mortain',
    'omahabeach_offensive_ger': '☀️ Omaha Beach Offensive GER',
    'omahabeach_offensive_us': '☀️ Omaha Beach Offensive US',
    'omahabeach_warfare': '☀️ Omaha Beach',
    'purpleheartlane_offensive_ger': '🌧️ Purple Heart Lane Offensive GER',
    'purpleheartlane_offensive_us': '🌧️ Purple Heart Lane Offensive US',
    'purpleheartlane_warfare': '🌧️ Purple Heart Lane',
    'purpleheartlane_warfare_night': '🌙 Purple Heart Lane',
    'remagen_offensive_ger': '☀️ Remagen Offensive GER',
    'remagen_offensive_us': '☀️ Remagen Offensive US',
    'remagen_warfare': '☀️ Remagen',
    'remagen_warfare_night': '🌙 Remagen',
    'SMDM_S_1944_Day_P_Skirmish': '☀️ St. Marie du Mont Skirmish',
    'SMDM_S_1944_Night_P_Skirmish': '🌙 St. Marie du Mont Skirmish',
    'SMDM_S_1944_Rain_P_Skirmish': '🌧️ St. Marie du Mont Skirmish',
    'stalingrad_offensive_ger': '🌙 Stalingrad Offensive GER',
    'stalingrad_offensive_rus': '☀️ Stalingrad Offensive RUS',
    'stalingrad_warfare': '☀️ Stalingrad',
    'stalingrad_warfare_night': '🌙 Stalingrad',
    'stmariedumont_off_ger': '☀️ St. Marie du Mont Offensive GER',
    'stmariedumont_off_us': '☀️ St. Marie du Mont Offensive US',
    'stmariedumont_warfare': '☀️ St. Marie du Mont',
    'stmariedumont_warfare_night': '🌙 St. Marie du Mont',
    'stmereeglise_offensive_ger': '☀️ St. Mere Eglise Offensive GER',
    'stmereeglise_offensive_us': '☀️ St. Mere Eglise Offensive US',
    'stmereeglise_warfare': '☀️ St. Mere Eglise',
    'stmereeglise_warfare_night': '🌙 St. Mere Eglise',
    'omahabeach_warfare_night': '🌙 Omaha Beach',
    'utahbeach_warfare_night': '🌙 Utah Beach',
    'utahbeach_offensive_us': '☀️ Utah Beach Offensive US',
    'utahbeach_offensive_ger': '☀️ Utah Beach Offensive GER',
    'utahbeach_warfare': '☀️ Utah Beach'
};

// Commit 5: Set up Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let updateMessages = {};
let currentMaps = {};
let nextMaps = {};
let timePlayed = {};

// Commit 6: Implement client ready event
client.once('ready', async () => {
    logger.info(`Logged in as ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel && channel.isTextBased()) {
            logger.info('Channel found and is text-based.');

            await deleteOldMessages(channel);
            await updateMapRotation();
            logger.info('Initial map rotation updated.');

            setInterval(updateMapRotation, 600000);
            setInterval(updateCurrentMaps, 60000);
            logger.info('Intervals set for updates.');
        } else {
            logger.error('Channel not found or is not text-based.');
        }
    } catch (error) {
        logger.error('Error in ready event handler:', error);
    }
});

// Commit 7: Implement message handling
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!start') {
        logger.info('Received !start command');
        if (!updateMessages[CHANNEL_ID]) {
            await updateMapRotation();
            setInterval(updateMapRotation, 3600000);
            setInterval(updateCurrentMaps, 30000);
            logger.info('Updates started via !start command');
        } else {
            logger.info('Updates already running');
        }
    }
});

// Commit 8: Implement map rotation update
async function updateMapRotation() {
    logger.info('Updating map rotation...');
    const messages = await fetchMapRotation();
    if (messages) {
        const channel = await client.channels.fetch(CHANNEL_ID);
        for (let i = 0; i < messages.length; i++) {
            const embed = messages[i];
            if (updateMessages[CHANNEL_ID] && updateMessages[CHANNEL_ID][i]) {
                const msg = await channel.messages.fetch(updateMessages[CHANNEL_ID][i]);
                await msg.edit({ embeds: [embed] });
            } else {
                const sentMessage = await channel.send({ embeds: [embed] });
                if (!updateMessages[CHANNEL_ID]) updateMessages[CHANNEL_ID] = [];
                updateMessages[CHANNEL_ID][i] = sentMessage.id;
            }
        }
        logger.info('Map rotation updated successfully');
    } else {
        logger.info('No messages to update for map rotation');
    }
}

// Commit 9: Implement current maps update
async function updateCurrentMaps() {
    logger.info('Updating current maps...');
    for (let i = 0; i < activeServers; i++) {
        const url = servers[i];
        const token = tokens[i];
        try {
            const [currentMap, nextMap, gameState] = await Promise.all([
                getCurrentMap(url, token),
                getNextMap(url, token),
                getGameState(url, token)
            ]);
            currentMaps[i] = currentMap || 'N/A';
            nextMaps[i] = nextMap || 'N/A';
            timePlayed[i] = formatGameDuration(gameState);
            await updateEmbed(i);
            logger.info(`Updated information for server ${i}`);
        } catch (error) {
            logger.error(`Error updating maps for server ${i}: ${error.message}`);
            currentMaps[i] = 'Error';
            nextMaps[i] = 'Error';
            timePlayed[i] = 'Error';
            await updateEmbed(i);
        }
    }
}

// Commit 10: Implement utility functions
function getRemainingTime(gameState) {
    if (!gameState || !gameState.raw_time_remaining) return 'N/A';

    const remainingTime = gameState.raw_time_remaining;

    if (remainingTime === "0:00:00") {
        return "Server inactive";
    }

    const [hours, minutes, seconds] = remainingTime.split(':').map(Number);

    if (hours > 0) {
        return `${hours}h${minutes.toString().padStart(2, '0')}min`;
    } else if (minutes > 0) {
        return `${minutes}min ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatGameDuration(gameState) {
    if (!gameState || !gameState.raw_time_remaining) return 'N/A';

    const playedTime = convertRemainingToPlayed(gameState.raw_time_remaining);
    return playedTime === "Server inactive" ? playedTime : playedTime;
}

function convertRemainingToPlayed(remainingTime) {
    if (remainingTime === "0:00:00") {
        return "Server inactive";
    }

    const totalSeconds = 5400;
    const [hours, minutes, seconds] = remainingTime.split(':').map(Number);
    const remainingSeconds = hours * 3600 + minutes * 60 + seconds;
    const playedSeconds = totalSeconds - remainingSeconds;

    const playedHours = Math.floor(playedSeconds / 3600);
    const playedMinutes = Math.floor((playedSeconds % 3600) / 60);

    if (playedHours > 0) {
        return `${playedHours}h${playedMinutes.toString().padStart(2, '0')}min`;
    } else {
        return `${playedMinutes}min`;
    }
}

function getScoreText(gameState) {
    if (gameState && 'allied_score' in gameState && 'axis_score' in gameState) {
        return `<:allied:1271771966906302536> ${gameState.allied_score} - ${gameState.axis_score} <:axis:1271771914100277279>`;
    }
    return 'N/A';
}

function getPlayerCountText(gameState) {
    if (gameState && 'num_allied_players' in gameState && 'num_axis_players' in gameState) {
        return `<:allied:1271771966906302536> ${gameState.num_allied_players} - ${gameState.num_axis_players} <:axis:1271771914100277279>`;
    }
    return 'N/A';
}

// Commit 11: Implement embed update function
async function updateEmbed(serverIndex) {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (updateMessages[CHANNEL_ID] && updateMessages[CHANNEL_ID][serverIndex]) {
        try {
            const msg = await channel.messages.fetch(updateMessages[CHANNEL_ID][serverIndex]);
            const existingEmbed = msg.embeds[0];
            const newEmbed = new EmbedBuilder();

            newEmbed.setColor(embedColors[serverIndex % embedColors.length]);
            newEmbed.setTitle(`📊 ${servernames[serverIndex]} Status`);
            newEmbed.setThumbnail(thumbnails[serverIndex % thumbnails.length]);

            const rotationText = existingEmbed.description || 'Rotation information not available';
            newEmbed.setDescription(rotationText);

            const currentMap = currentMaps[serverIndex];
            const nextMap = nextMaps[serverIndex];
            const gameState = await getGameState(servers[serverIndex], tokens[serverIndex]);

            const timePlayed = formatGameDuration(gameState);
            const timeRemaining = getRemainingTime(gameState);

            newEmbed.addFields([
                { name: '🗺️ Current Map', value: mapDescriptions[currentMap] || currentMap || 'N/A', inline: true },
                { name: '🔜 Next Map', value: mapDescriptions[nextMap] || nextMap || 'N/A', inline: true },
                { name: '⏱️ Time Played', value: timePlayed, inline: true },
                { name: '⏳ Time Remaining', value: timeRemaining, inline: true },
                { name: '🏆 Score', value: getScoreText(gameState), inline: true },
                { name: '👥 Player Count', value: getPlayerCountText(gameState), inline: true }
            ]);

            newEmbed.setFooter({
                text: 'Last Update',
                iconURL: 'https://i.imgur.com/9Iaiwje.png'
            });
            newEmbed.setTimestamp();

            await msg.edit({ embeds: [newEmbed] });
            logger.info(`Updated embed for server ${serverIndex}`);
        } catch (error) {
            logger.error(`Error updating embed for server ${serverIndex}: ${error.message}`);
        }
    }
}

// Commit 12: Implement enhanced watchdog and memory logging
let lastUpdateTime = Date.now();

function enhancedWatchdog() {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTime;

    if (timeSinceLastUpdate > 5 * 60 * 1000) {
        logger.warn('Watchdog: No updates for 5 minutes, restarting update processes');
        safeUpdateMapRotation();
        safeUpdateCurrentMaps();
    }

    if (!client.ws.ping) {
        logger.error('Watchdog: Discord WebSocket disconnected, attempting to reconnect');
        client.destroy();
        client.login(TOKEN);
    }

    lastUpdateTime = currentTime;
}

setInterval(enhancedWatchdog, 60000);

function logMemoryUsage() {
    const used = process.memoryUsage();
    logger.info('Memory Usage:', {
        rss: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
        external: `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`,
    });
}

setInterval(logMemoryUsage, 15 * 60 * 1000);

// Commit 13: Implement safe update functions
async function safeUpdateMapRotation() {
    try {
        await updateMapRotation();
        lastUpdateTime = Date.now();
    } catch (error) {
        logger.error('Error in updateMapRotation', { error: error.message, stack: error.stack });
    }
}

async function safeUpdateCurrentMaps() {
    try {
        await updateCurrentMaps();
        lastUpdateTime = Date.now();
    } catch (error) {
        logger.error('Error in updateCurrentMaps', { error: error.message, stack: error.stack });
    }
}

// Commit 14: Implement API request functions
async function getCurrentMap(url, token) {
    try {
        const response = await fetch(`${url}/get_map`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            return data.result;
        } else {
            logger.error(`Error ${response.status} fetching current map`);
            return null;
        }
    } catch (error) {
        logger.error(`Error fetching current map: ${error.message}`);
        return null;
    }
}

async function getNextMap(url, token) {
    try {
        const response = await fetch(`${url}/get_next_map`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            return data.result;
        } else {
            logger.error(`Error ${response.status} fetching next map`);
            return null;
        }
    } catch (error) {
logger.error(`Error fetching next map: ${error.message}`);
        return null;
    }
}

async function getGameState(url, token) {
    try {
        const response = await fetch(`${url}/get_gamestate`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            return data.result;
        } else {
            logger.error(`Error ${response.status} fetching game state`);
            return null;
        }
    } catch (error) {
        logger.error(`Error fetching game state: ${error.message}`);
        return null;
    }
}

// Commit 15: Implement map rotation fetching
async function fetchMapRotation() {
    const messages = [];
    for (let i = 0; i < activeServers; i++) {
        const url = servers[i];
        const token = tokens[i];
        const servername = servernames[i];

        try {
            const [rotationResponse, currentMap, nextMap, gameState] = await Promise.all([
                fetch(`${url}/get_map_rotation`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.json()),
                getCurrentMap(url, token),
                getNextMap(url, token),
                getGameState(url, token)
            ]);

            if (rotationResponse.result) {
                const rotationDescription = rotationResponse.result.map(item => mapDescriptions[item] || item).join('\n');
                currentMaps[i] = currentMap || 'N/A';
                nextMaps[i] = nextMap || 'N/A';

                const timePlayed = formatGameDuration(gameState);
                const timeRemaining = getRemainingTime(gameState);

                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${servername} Status`)
                    .setDescription(`Rotation:\n${rotationDescription}`)
                    .setColor(embedColors[i % embedColors.length])
                    .setThumbnail(thumbnails[i % thumbnails.length])
                    .addFields([
                        { name: '🗺️ Current Map', value: mapDescriptions[currentMap] || currentMap || 'N/A', inline: true },
                        { name: '🔜 Next Map', value: mapDescriptions[nextMap] || nextMap || 'N/A', inline: true },
                        { name: '⏱️ Time Played', value: timePlayed, inline: true },
                        { name: '⏳ Time Remaining', value: timeRemaining, inline: true },
                        { name: '🏆 Score', value: getScoreText(gameState), inline: true },
                        { name: '👥 Player Count', value: getPlayerCountText(gameState), inline: true }
                    ]);

                embed.setFooter({
                    text: 'Last Update',
                    iconURL: 'https://i.imgur.com/9Iaiwje.png'
                });
                embed.setTimestamp();

                messages.push(embed);
            } else {
                throw new Error('Invalid rotation data');
            }
        } catch (error) {
            logger.error(`Error fetching data for server ${servername}: ${error.message}`);
            const embed = new EmbedBuilder()
                .setTitle(servername)
                .setDescription(`Fetch error: ${error.message}`)
                .setColor(0xFF0000)
                .setThumbnail(thumbnails[i % thumbnails.length]);
            messages.push(embed);
        }
    }
    return messages;
}

// Commit 16: Implement client login and error handling
client.login(TOKEN).then(() => {
    logger.info('Bot is logging in...');
}).catch(error => {
    logger.error('Error during login:', error);
});

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

// Commit 17: Implement message deletion utility
async function deleteOldMessages(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const now = Date.now();
    const messagesToDelete = messages.filter(msg => now - msg.createdTimestamp > 14 * 24 * 60 * 60 * 1000);

    for (const message of messagesToDelete.values()) {
        await message.delete();
    }

    const messagesToBulkDelete = messages.filter(msg => now - msg.createdTimestamp <= 14 * 24 * 60 * 60 * 1000);
    if (messagesToBulkDelete.size > 0) {
        await channel.bulkDelete(messagesToBulkDelete);
    }

    logger.info('Old messages deleted.');
}

// Final commit: Add comments and clean up code
// This script is a Discord bot that provides real-time updates on game server status.
// It fetches information about current and next maps, player counts, and game scores.
// The bot uses environment variables for configuration and Winston for logging.
// Regular updates are performed to keep the information current.
// A watchdog function ensures the bot stays responsive and reconnects if necessary.
// Memory usage is logged periodically for monitoring purposes.
// The script is designed to be run as a long-lived process, continuously updating
// Discord messages with the latest game server information.