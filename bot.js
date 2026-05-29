import { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus, Routes } from "discord.js";
import { joinVoiceChannel, VoiceConnectionStatus, entersState, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType } from "@discordjs/voice";
import { Readable } from "stream";
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

const SILENCE = Buffer.from([0xf8, 0xff, 0xfe]);

function silenceStream() {
  const s = new Readable({ read() {} });
  const t = setInterval(() => s.push(SILENCE), 20);
  s.once("close", () => clearInterval(t));
  return s;
}

function playSilence(conn, tag) {
  try {
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    conn.subscribe(player);
    const loop = () => {
      try { player.play(createAudioResource(silenceStream(), { inputType: StreamType.Opus })); }
      catch { setTimeout(loop, 5000); }
    };
    player.on(AudioPlayerStatus.Idle, loop);
    player.on("error", () => setTimeout(loop, 3000));
    loop();
    console.log(`[${tag}] Silence active.`);
  } catch (e) {
    console.log(`[${tag}] Silence unavailable:`, e.message);
  }
}

function startBot(token, channelId, idx) {
  const tag = `Bot#${idx + 1}`;
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  let conn = null, connecting = false, timer = null;
  const reconnect = (ms = 3000) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; join(); }, ms);
  };
  async function join() {
    if (connecting) return;
    connecting = true;
    try {
      const ch = await client.channels.fetch(channelId);
      if (!ch?.isVoiceBased()) { connecting = false; reconnect(15000); return; }
      console.log(`[${tag}] Joining: ${ch.name}`);
      if (conn) { try { conn.removeAllListeners(); conn.destroy(); } catch {} conn = null; }
      conn = joinVoiceChannel({ channelId: ch.id, guildId: ch.guild.id, adapterCreator: ch.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
      conn.on(VoiceConnectionStatus.Disconnected, async () => {
        try { await Promise.race([entersState(conn, VoiceConnectionStatus.Signalling, 4000), entersState(conn, VoiceConnectionStatus.Connecting, 4000)]); }
        catch { connecting = false; reconnect(2000); }
      });
      conn.on(VoiceConnectionStatus.Destroyed, () => { conn = null; connecting = false; reconnect(2000); });
      conn.on("error", () => { connecting = false; reconnect(5000); });
      await entersState(conn, VoiceConnectionStatus.Ready, 30000);
      console.log(`[${tag}] In VC!`);
      playSilence(conn, tag);
    } catch (e) {
      console.error(`[${tag}] Failed:`, e.message);
      reconnect(10000);
    } finally { connecting = false; }
  }
  client.once("ready", async () => {
    console.log(`[${tag}] Logged in as ${client.user.tag}`);
    const presence = () => client.user.setPresence({ status: PresenceUpdateStatus.Online, activities: [{ name: "🛒 Visit krms.rmz.gg", type: ActivityType.Streaming, url: "https://twitch.tv/placeholder" }] });
    presence();
    setInterval(presence, 4 * 60 * 1000);
    try { await client.rest.patch(Routes.user(), { body: { bio: "Store\nkrms.rmz.gg\ndiscord.gg/krm" } }); } catch {}
    await join();
    setInterval(() => {
      const s = conn?.state?.status;
      if (s !== VoiceConnectionStatus.Ready && s !== VoiceConnectionStatus.Signalling && s !== VoiceConnectionStatus.Connecting && !connecting && !timer) reconnect(1000);
    }, 15000);
  });
  client.on("voiceStateUpdate", (o, n) => {
    if (n.id !== client.user.id) return;
    if (o.channelId === channelId && n.channelId !== channelId) { console.log(`[${tag}] Kicked — rejoining...`); reconnect(1000); }
  });
  client.on("error", e => console.error(`[${tag}]`, e.message));
  client.login(token).catch(e => console.error(`[${tag}] Login failed:`, e.message));
}

process.on("unhandledRejection", e => console.error("Unhandled:", e));
BOTS.forEach(({ token, channelId }, i) => setTimeout(() => startBot(token, channelId, i), i * 2000));
