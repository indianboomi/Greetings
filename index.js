require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const requiredEnv = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "WELCOME_CHANNEL_ID",
  "GOODBYE_CHANNEL_ID"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

const inviteFile = path.join(__dirname, "invites.json");
const inviteCache = new Map();
let inviterCounts = {};

function loadCounts() {
  try {
    inviterCounts = JSON.parse(fs.readFileSync(inviteFile, "utf8"));
  } catch {
    inviterCounts = {};
  }
}

function saveCounts() {
  fs.writeFileSync(inviteFile, JSON.stringify(inviterCounts, null, 2));
}

function getInviteCount(userId) {
  return inviterCounts[userId] || 0;
}

const commands = [
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("See how many members you have invited")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Check another user's invite count")
        .setRequired(false)
    )
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log("Slash command registered.");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  loadCounts();

  // Cache invite use counts so we can identify which invite was used.
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      inviteCache.set(
        guild.id,
        new Map(invites.map(invite => [invite.code, invite.uses ?? 0]))
      );
    } catch (error) {
      console.warn(`Cannot read invites in ${guild.name}. Check the bot's permissions.`);
    }
  }

  try {
    await registerCommands();
  } catch (error) {
    console.error("Could not register slash commands:", error);
  }
});

client.on("inviteCreate", async invite => {
  const cached = inviteCache.get(invite.guild.id) || new Map();
  cached.set(invite.code, invite.uses ?? 0);
  inviteCache.set(invite.guild.id, cached);
});

client.on("inviteDelete", async invite => {
  const cached = inviteCache.get(invite.guild.id);
  if (cached) cached.delete(invite.code);
});

client.on("guildMemberAdd", async member => {
  // Find the invite whose use count increased.
  let inviter = null;
  try {
    const before = inviteCache.get(member.guild.id) || new Map();
    const currentInvites = await member.guild.invites.fetch();
    const usedInvite = currentInvites.find(
      invite => (invite.uses ?? 0) > (before.get(invite.code) ?? 0)
    );

    if (usedInvite?.inviter) {
      inviter = usedInvite.inviter;
      inviterCounts[inviter.id] = getInviteCount(inviter.id) + 1;
      saveCounts();

      // Optional dedicated invite-log channel.
      if (process.env.INVITE_LOG_CHANNEL_ID) {
        const logChannel = await member.guild.channels
          .fetch(process.env.INVITE_LOG_CHANNEL_ID)
          .catch(() => null);

        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({
            content: `📨 ${member} joined using an invite from **${inviter.tag}**. They now have **${getInviteCount(inviter.id)}** tracked invite(s).`
          }).catch(console.error);
        }
      }
    }

    inviteCache.set(
      member.guild.id,
      new Map(currentInvites.map(invite => [invite.code, invite.uses ?? 0]))
    );
  } catch (error) {
    console.warn("Invite tracking failed. Check Manage Server permission:", error.message);
  }

  const channel = await member.guild.channels.fetch(process.env.WELCOME_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn("Welcome channel not found. Check WELCOME_CHANNEL_ID.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Welcome to the server! 🎉")
    .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! We're glad you're here.`)
    .addFields(
      { name: "Member", value: `${member.user.tag}`, inline: true },
      { name: "Invited by", value: inviter ? `${inviter.tag}` : "Unknown invite", inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);
});

client.on("guildMemberRemove", async member => {
  const channel = await member.guild.channels.fetch(process.env.GOODBYE_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn("Goodbye channel not found. Check GOODBYE_CHANNEL_ID.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("Goodbye! 👋")
    .setDescription(`**${member.user.tag}** has left **${member.guild.name}**. Take care!`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${member.guild.memberCount} members remaining` })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "invites") return;

  const target = interaction.options.getUser("user") || interaction.user;
  const count = getInviteCount(target.id);

  await interaction.reply({
    content: `📨 **${target.tag}** has invited **${count}** member(s).`,
    ephemeral: true
  });
});

client.on("error", console.error);
process.on("unhandledRejection", error => console.error("Unhandled rejection:", error));

client.login(process.env.DISCORD_TOKEN);
