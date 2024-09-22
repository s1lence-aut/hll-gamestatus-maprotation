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

// Set up logging
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

// Define watchdog function
let lastUpdateTime = Date.now();

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

// Define map descriptions (truncated for brevity)
const mapDescriptions = {
    'carentan_offensive_ger': '☀️ Carentan Offensive GER',
    'carentan_offensive_us': '☀️ Carentan Offensive US',
    'carentan_warfare': '☀️ Carentan',
    'carentan_warfare_night': '🌙 Carentan',
    // ... (other map descriptions)
};

// Set up Discord client
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

// Implement client ready event
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

// Implement message handling
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

// Implement map rotation update
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

// Implement current maps update
async function updateCurrentMaps() {
    logger.info('Updating current maps...');
    for (let i = 0; i < activeServers; i++) {
        const url = servers[i];
        const token = tokens[i];
        try {
            const gameState = await getGameState(url, token);
            if (gameState) {
                currentMaps[i] = gameState.current_map || 'N/A';
                nextMaps[i] = gameState.next_map || 'N/A';
                timePlayed[i] = formatGameDuration(gameState);
                await updateEmbed(i, gameState);
                logger.info(`Updated information for server ${i}`);
            } else {
                throw new Error('Invalid game state');
            }
        } catch (error) {
            logger.error(`Error updating maps for server ${i}: ${error.message}`);
            currentMaps[i] = 'Error';
            nextMaps[i] = 'Error';
            timePlayed[i] = 'Error';
            await updateEmbed(i, null);
        }
    }
}

// Implement utility functions
function getRemainingTime(gameState) {
    if (!gameState || !gameState.time_remaining) return 'N/A';

    const remainingTime = gameState.time_remaining;

    if (remainingTime === 0) {
        return "Server inactive";
    }

    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    const seconds = remainingTime % 60;

    if (hours > 0) {
        return `${hours}h${minutes.toString().padStart(2, '0')}min`;
    } else if (minutes > 0) {
        return `${minutes}min ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatGameDuration(gameState) {
    if (!gameState || !gameState.time_remaining) return 'N/A';

    const totalSeconds = 5400; // Assuming 90 minutes total game time
    const playedSeconds = totalSeconds - gameState.time_remaining;

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

// Implement embed update function
async function updateEmbed(serverIndex, gameState) {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (updateMessages[CHANNEL_ID] && updateMessages[CHANNEL_ID][serverIndex]) {
        try {
            const msg = await channel.messages.fetch(updateMessages[CHANNEL_ID][serverIndex]);
            const newEmbed = new EmbedBuilder();

            newEmbed.setColor(embedColors[serverIndex % embedColors.length]);
            newEmbed.setTitle(`📊 ${servernames[serverIndex]} Status`);
            newEmbed.setThumbnail(`https://i.imgur.com/JnUz7dA.png`);

            if (gameState) {
                const currentMap = currentMaps[serverIndex];
                const nextMap = nextMaps[serverIndex];
                const timePlayed = formatGameDuration(gameState);
                const timeRemaining = getRemainingTime(gameState);

                newEmbed.setDescription(`Current rotation:\n${gameState.map_rotation.map(item => mapDescriptions[item] || item).join('\n')}`);
                newEmbed.addFields([
                    { name: '🗺️ Current Map', value: mapDescriptions[currentMap] || currentMap || 'N/A', inline: true },
                    { name: '🔜 Next Map', value: mapDescriptions[nextMap] || nextMap || 'N/A', inline: true },
                    { name: '⏱️ Time Played', value: timePlayed, inline: true },
                    { name: '⏳ Time Remaining', value: timeRemaining, inline: true },
                    { name: '🏆 Score', value: getScoreText(gameState), inline: true },
                    { name: '👥 Player Count', value: getPlayerCountText(gameState), inline: true }
                ]);
            } else {
                newEmbed.setDescription('Unable to fetch server data');
            }

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

// Implement API request function
async function getGameState(url, token) {
    try {
        const response = await fetch(`${url}/api/get_status`, {
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

// Implement map rotation fetching
async function fetchMapRotation() {
    const messages = [];
    for (let i = 0; i < activeServers; i++) {
        const url = servers[i];
        const token = tokens[i];
        const servername = servernames[i];

        try {
            const gameState = await getGameState(url, token);

            if (gameState) {
                const rotationDescription = gameState.map_rotation.map(item => mapDescriptions[item] || item).join('\n');
                currentMaps[i] = gameState.current_map || 'N/A';
                nextMaps[i] = gameState.next_map || 'N/A';

                const timePlayed = formatGameDuration(gameState);
                const timeRemaining = getRemainingTime(gameState);

                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${servername} Status`)
                    .setDescription(`Rotation:\n${rotationDescription}`)
                    .setColor(embedColors[i % embedColors.length])
                    .setThumbnail(`https://i.imgur.com/JnUz7dA.png`)
                    .addFields([
                        { name: '🗺️ Current Map', value: mapDescriptions[currentMaps[i]] || currentMaps[i] || 'N/A', inline: true },
                        { name: '🔜 Next Map', value: mapDescriptions[nextMaps[i]] || nextMaps[i] || 'N/A', inline: true },
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
                throw new Error('Invalid game state data');
            }
        } catch (error) {
            logger.error(`Error fetching data for server ${servername}: ${error.message}`);
            const embed = new EmbedBuilder()
                .setTitle(servername)
                .setDescription(`Fetch error: ${error.message}`)
                .setColor(0xFF0000)
                .setThumbnail(`https://i.imgur.com/JnUz7dA.png`);
            messages.push(embed);
        }
    }
    return messages;
}

// Implement client login and error handling
client.login(TOKEN).then(() => {
    logger.info('Bot is logging in...');
}).catch(error => {
    logger.error('Error during login:', error);
});

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

// Implement message deletion utility
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

// Implement safe update functions
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

// Implement enhanced watchdog and memory logging
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

// Start the bot
client.login(TOKEN).then(() => {
    logger.info('Bot is logging in...');
}).catch(error => {
    logger.error('Error during login:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});
