# KRM Discord Bot — Free 24/7 Deployment on Render.com

## Step 1 — Upload to GitHub (free)

1. Go to [github.com](https://github.com) and create a free account
2. Click **New repository** → name it `krm-bot` → click **Create**
3. Upload the contents of this folder:
   - Click **uploading an existing file**
   - Drag in `Dockerfile`, `package.json`, and the `src/` folder
   - Click **Commit changes**

---

## Step 2 — Deploy on Render (free, no credit card)

1. Go to [render.com](https://render.com) and sign up free
2. Click **New → Web Service**
3. Connect your GitHub → select `krm-bot`
4. Set these settings:
   - **Runtime:** Docker
   - **Branch:** main
5. Scroll to **Environment Variables** and add:
   ```
   DISCORD_BOT_TOKEN     = paste_your_first_token
   DISCORD_BOT_TOKEN_2   = paste_your_second_token
   DISCORD_BOT_TOKEN_3   = paste_your_third_token
   ```
6. Click **Create Web Service** — wait ~3 minutes for it to build

---

## Step 3 — Keep it awake 24/7 (free pinger)

Render's free tier sleeps after 15 minutes of no traffic. Fix it for free:

1. Go to [uptimerobot.com](https://uptimerobot.com) → sign up free
2. Click **Add New Monitor**:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** KRM Bot
   - **URL:** paste your Render app URL (e.g. `https://krm-bot.onrender.com`)
   - **Monitoring Interval:** every 5 minutes
3. Click **Create Monitor**

UptimeRobot pings your bot every 5 minutes → Render never sleeps → bots stay in VC 24/7 forever, completely free.
