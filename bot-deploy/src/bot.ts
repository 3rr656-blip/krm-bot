import {
  Client,
  GatewayIntentBits,
  ActivityType,
  PresenceUpdateStatus,
  Routes,
} from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";
import { Readable } from "stream";

const BOTS = [
  { token: process.env["DISCORD_BOT_TOKEN"],   channelId: "1500222726206525450" },
  { token: process.env["DISCORD_BOT_TOKEN_2"], channelId: "1500222743000649969" },
  { token: process.env["DISCORD_BOT_TOKEN_3"], channelId: "1508421560946397295" },
].filter((b): b is { token: string; channelId: string } => !!b.token);

if (BOTS.length === 0) {
  console.error("No bot tokens found. Set DISCORD_BOT_TOKEN, DISCORD_BOT_TOKEN_2, DISCORD_BOT_TOKEN_3");
  process.exit(1);
}

console.log(`Starting ${BOTS.length} bots...`);

const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

function makeSilenceStream(): Readable {
  const stream = new Readable({ read() {} });
  const interval = setInterval(() => stream.push(SILENCE_FRAME), 20);
  stream.once("close", () => clearInterval(interval));
  stream.once("end", () => clearInterval(interval));
  return stream;
}

function startSilencePlayer(connection: ReturnType<typeof joinVoiceChannel>, tag: string) {
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  connection.subscribe(player);

  function playLoop() {
    const resource = createAudioResource(makeSilenceStream(), { inputType: StreamType.Opus });
    player.play(resource);
  }

  player.on(AudioPlayerStatus.Idle, () => playLoop());
  player.on("error", () => playLoop());
  playLoop();
  console.log(`[${tag}] Silence player active.`);
}

function createBot(token: string, channelId: string, index: number) {
  const tag = `Bot#${index + 1}`;

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  let currentConnection: ReturnType<typeof joinVoiceChannel> | null = null;
  let isConnecting = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleReconnect(delayMs = 3000) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectToVoice(); }, delayMs);
  }

  async function connectToVoice() {
    if (isConnecting) return;
    isConnecting = true;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isVoiceBased()) {
        console.error(`[${tag}] Not a voice channel`);
        isConnecting = false;
        scheduleReconnect(15_000);
        return;
      }
      const vc = channel as import("discord.js").VoiceChannel;
      console.log(`[${tag}] Joining: ${vc.name} in ${vc.guild.name}`);

      if (currentConnection) {
        try { currentConnection.removeAllListeners(); currentConnection.destroy(); } catch {}
        currentConnection = null;
      }

      currentConnection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(currentConnection!, VoiceConnectionStatus.Signalling, 4_000),
            entersState(currentConnection!, VoiceConnectionStatus.Connecting, 4_000),
          ]);
        } catch {
          isConnecting = false;
          scheduleReconnect(2000);
        }
      });

      currentConnection.on(VoiceConnectionStatus.Destroyed, () => {
        currentConnection = null; isConnecting = false; scheduleReconnect(2000);
      });

      currentConnection.on("error", () => { isConnecting = false; scheduleReconnect(5000); });

      await entersState(currentConnection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`[${tag}] In voice channel!`);
      startSilencePlayer(currentConnection, tag);
    } catch (err) {
      console.error(`[${tag}] Failed to join:`, err);
      scheduleReconnect(10_000);
    } finally {
      isConnecting = false;
    }
  }

  client.once("ready", async () => {
    console.log(`[${tag}] Logged in as ${client.user?.tag}`);

    client.user?.setPresence({
      status: PresenceUpdateStatus.Online,
      activities: [{ name: "🛒 Visit krms.rmz.gg", type: ActivityType.Streaming, url: "https://twitch.tv/placeholder" }],
    });
    setInterval(() => {
      client.user?.setPresence({
        status: PresenceUpdateStatus.Online,
        activities: [{ name: "🛒 Visit krms.rmz.gg", type: ActivityType.Streaming, url: "https://twitch.tv/placeholder" }],
      });
    }, 4 * 60 * 1000);

    try {
      await client.rest.patch(Routes.user(), { body: { bio: "Store\nkrms.rmz.gg\ndiscord.gg/krm" } });
    } catch {}

    await connectToVoice();

    setInterval(() => {
      const s = currentConnection?.state?.status;
      const ok = s === VoiceConnectionStatus.Ready || s === VoiceConnectionStatus.Signalling || s === VoiceConnectionStatus.Connecting;
      if (!ok && !isConnecting && !reconnectTimer) scheduleReconnect(1000);
    }, 15_000);
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.id !== client.user?.id) return;
    if (oldState.channelId === channelId && newState.channelId !== channelId) {
      console.log(`[${tag}] Moved/kicked — rejoining...`);
      scheduleReconnect(1000);
    }
  });

  client.on("error", (err) => console.error(`[${tag}] Error:`, err.message));
  client.login(token).catch((err) => console.error(`[${tag}] Login failed:`, err.message));
}

process.on("unhandledRejection", (err) => console.error("Unhandled:", err));

BOTS.forEach(({ token, channelId }, i) => {
  setTimeout(() => createBot(token, channelId, i), i * 2000);
});
