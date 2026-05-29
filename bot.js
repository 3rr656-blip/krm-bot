import { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus, Routes } from "discord.js";
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from "@discordjs/voice";
import http from "http";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

if (process.env.BOT_INDEX !== undefined) {
  const idx = parseInt(process.env.BOT_INDEX);
  const token = process.env.BOT_TOKEN;
  const channelId = process.env.BOT_CHANNEL;
  if (!token || !channelId) { console.error("Missing BOT_TOKEN or BOT_CHANNEL"); process.exit(1); }
  runBot(token, channelId, idx);
} else {
  const PORT = Number(process.env.PORT ?? 3000);
  http.createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("KRM Bots alive!");
  }).listen(PORT, "0.0.0.0", () => console.log(`[Main] Health server on port ${PORT}`));

  const BOTS = [
    { token: process.env.DISCORD_BOT_TOKEN,   channelId: "1500222726206525450" },
    { token: process.env.DISCORD_BOT_TOKEN_2, channelId: "1500222743000649969" },
    { token: process.env.DISCORD_BOT_TOKEN_3, channelId: "1508421560946397295" },
  ].filter(b => b.token);

  if (BOTS.length === 0) { console.error("[Main] No bot tokens found"); process.exit(1); }
  console.log(`[Main] Launching ${BOTS.length} isolated bot processes...`);

  BOTS.forEach(({ token, channelId }, i) => {
    const launch = () => {
      console.log(`[Main] Starting Bot#${i + 1}...`);
      const child = spawn("node", [__filename], {
        env: { ...process.env, BOT_INDEX: String(i), BOT_TOKEN: token, BOT_CHANNEL: channelId },
        stdio: "inherit",
      });
      child.on("error", e => console.error(`[Main] Bot#${i + 1} error:`, e.message));
      child.on("exit", code => {
        console.log(`[Main] Bot#${i + 1} exited (code ${code}) — restarting in 5s...`);
        setTimeout(launch, 5000);
      });
    };
    setTimeout(launch, i * 4000);
  });
}

function runBot(token, channelId, idx) {
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
      conn.on("error", e => { console.error(`[${tag}] Conn error:`, e.message); connecting = false; reconnect(5000); });
      await entersState(conn, VoiceConnectionStatus.Ready, 30000);
      console.log(`[${tag}] Locked in VC permanently.`);
    } catch (e) {
      console.error(`[${tag}] Join failed:`, e.message);
      reconnect(15000);
    } finally { connecting = false; }
  }
  client.once("ready", async () => {
    console.log(`[${tag}] Online as ${client.user.tag}`);
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
    if (o.channelId === channelId && n.channelId !== channelId) { console.log(`[${tag}] Removed — rejoining...`); reconnect(2000); }
  });
  client.on("error", e => console.error(`[${tag}] Error:`, e.message));
  process.on("unhandledRejection", e => console.error(`[${tag}] Unhandled:`, e));
  client.login(token).catch(e => { console.error(`[${tag}] Login failed:`, e.message); process.exit(1); });
}
