import { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus, Routes } from "discord.js";
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from "@discordjs/voice";
import http from "http";

const PORT = Number(process.env.PORT ?? 3000);

http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("KRM Bot alive!");
}).listen(PORT, "0.0.0.0", () => console.log(`[Health] Listening on port ${PORT}`));

const BOTS = [
  { token: process.env.DISCORD_BOT_TOKEN,   channelId: "1500222726206525450" },
  { token: process.env.DISCORD_BOT_TOKEN_2, channelId: "1500222743000649969" },
  { token: process.env.DISCORD_BOT_TOKEN_3, channelId: "1508421560946397295" },
].filter(b => b.token);

if (BOTS.length === 0) { console.error("No tokens found"); process.exit(1); }
console.log(`Starting ${BOTS.length} bots...`);

function startBot(token, channelId, idx) {
  const tag = `Bot#${idx + 1}`;
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  let conn = null, connecting = false, timer = null;
  const reconnect = (ms = 5000) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; join(); }, ms);
  };
  async function join() {
    if (connecting) return;
    connecting = true;
    try {
      const ch = await client.channels.fetch(channelId);
      if (!ch?.isVoiceBased()) { connecting = false; reconnect(30000); return; }
      console.log(`[${tag}] Joining: ${ch.name}`);
      if (conn) { try { conn.removeAllListeners(); conn.destroy(); } catch {} conn = null; }
      conn = joinVoiceChannel({ channelId: ch.id, guildId: ch.guild.id, adapterCreator: ch.guild.voiceAdapterCreator, selfDeaf: true, selfMute: true });
      conn.on(VoiceConnectionStatus.Disconnected, async () => {
        try { await Promise.race([entersState(conn, VoiceConnectionStatus.Signalling, 5000), entersState(conn, VoiceConnectionStatus.Connecting, 5000)]); }
        catch { connecting = false; reconnect(3000); }
      });
      conn.on(VoiceConnectionStatus.Destroyed, () => { conn = null; connecting = false; reconnect(3000); });
      conn.on("error", (e) => { console.error(`[${tag}] Conn error:`, e.message); connecting = false; reconnect(5000); });
      await entersState(conn, VoiceConnectionStatus.Ready, 30000);
      console.log(`[${tag}] Locked in VC — staying permanently.`);
    } catch (e) {
      console.error(`[${tag}] Failed to join:`, e.message);
      reconnect(15000);
    } finally { connecting = false; }
  }
  client.once("ready", async () => {
    console.log(`[${tag}] Logged in as ${client.user.tag}`);
    const setPresence = () => client.user.setPresence({ status: PresenceUpdateStatus.Online, activities: [{ name: "🛒 Visit krms.rmz.gg", type: ActivityType.Streaming, url: "https://twitch.tv/placeholder" }] });
    setPresence();
    setInterval(setPresence, 4 * 60 * 1000);
    try { await client.rest.patch(Routes.user(), { body: { bio: "Store\nkrms.rmz.gg\ndiscord.gg/krm" } }); } catch {}
    await join();
    setInterval(() => {
      const s = conn?.state?.status;
      if (s !== VoiceConnectionStatus.Ready && s !== VoiceConnectionStatus.Signalling && s !== VoiceConnectionStatus.Connecting && !connecting && !timer) { console.log(`[${tag}] Not in VC — rejoining...`); reconnect(1000); }
    }, 20000);
  });
  client.on("voiceStateUpdate", (o, n) => {
    if (n.id !== client.user?.id) return;
    if (o.channelId === channelId && n.channelId !== channelId) { console.log(`[${tag}] Removed from VC — rejoining...`); reconnect(2000); }
  });
  client.on("error", e => console.error(`[${tag}] Client error:`, e.message));
  client.login(token).catch(e => { console.error(`[${tag}] Login failed:`, e.message); process.exit(1); });
}

process.on("unhandledRejection", e => console.error("Unhandled rejection:", e));
BOTS.forEach(({ token, channelId }, i) => setTimeout(() => startBot(token, channelId, i), i * 3000));
