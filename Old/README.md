# Discord Ban Bot

A Discord bot that integrates with BattleMetrics to handle bans via slash commands, buttons, and automated polling.

## Features
- /ban and /unban commands
- Creates Discord channels for bans
- Buttons: Pass, Remove Ban, Update Ban
- Auto closes channels when resolved
- Polls BattleMetrics every 60 seconds for new bans
- Logs all actions to #ban-logs channel

## Setup
1. Copy `.env.example` to `.env` and fill in your values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Register slash commands:
   ```bash
   npm run register
   ```
4. Start the bot:
   ```bash
   npm start
   ```