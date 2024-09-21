# HLL Gamestatus + Maprotation

The HLL Server Status Bot is a Discord bot designed to provide real-time updates on Hell Let Loose game server status. It fetches and displays information about current and upcoming maps, player counts, game scores, and more for multiple servers.

## Features

- Real-time updates of server status
- Support for multiple game servers
- Displays current map, next map, time played, time remaining, score, and player count
- Automatic map rotation updates
- Watchdog function to ensure bot responsiveness
- Memory usage logging for monitoring
- Customizable update intervals


## Setup

### Prerequisites

- Node.js (v18 or newer)
- npm (Node Package Manager)
- A Discord bot token
- HLL CRCON API credentials for fetching player data

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/s1lence-aut/hll-gamestatus-maprotation.git
   cd hll-gamestatus-maprotation

2. Generate a .env File

EXAMPLE:

   ```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here

# RCON Server Configuration | SINGLE SERVER
RCON_SERVERS=http://server1.example.com:8080
RCON_TOKENS=server1_token_here
RCON_SERVERNAMES=Server 1
# RCON Server Configuration | MULTI SERVER
RCON_SERVERS=http://server1.example.com:8080,http://server2.example.com:8080
RCON_TOKENS=server1_token_here,server2_token_here
RCON_SERVERNAMES=Server 1,Server 2
   
### File Format

This project uses ES Modules and is structured with the `.mjs` file extension.
