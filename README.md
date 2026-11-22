# Greetings Discord Bot

A Discord.js v14 bot with:
- Welcome messages in a dedicated channel
- Goodbye messages in a separate dedicated channel
- Basic invite tracking and an `/invites` slash command

## Requirements
- Node.js 18 or newer
- A Discord application and bot
- Bot invited to your server with the required permissions

## Setup
1. Download or clone this repository.
2. Run `npm install`.
3. Copy `.env.example` to a file named `.env` and fill in all channel IDs, including the invite-log channel.
4. Fill in the values in `.env`:
   - `DISCORD_TOKEN`: your bot token
   - `CLIENT_ID`: your Discord application ID
   - `GUILD_ID`: your server ID (optional, but useful for quick command updates)
   - `WELCOME_CHANNEL_ID`: channel for welcome messages
   - `GOODBYE_CHANNEL_ID`: channel for goodbye messages
   - `INVITE_LOG_CHANNEL_ID`: channel for invite tracking logs
5. Enable **Server Members Intent** in the Discord Developer Portal under Bot > Privileged Gateway Intents.
6. Invite the bot with the `bot` and `applications.commands` scopes. Give it View Channel, Send Messages, Embed Links, and Manage Server permissions.
7. Start it with `npm start`.

## Invite tracking notes
Invite tracking needs permission to view server invites (Manage Server is the straightforward permission to grant). Counts are stored in `invites.json` on the machine running the bot. Back up that file if your hosting provider uses temporary storage. Vanity URL joins, deleted invites, and simultaneous joins may not always identify an inviter correctly.

**Keep your .env private. Never commit your bot token to GitHub.**
