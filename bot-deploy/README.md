# KRM Discord Bot — Deployment Guide

## Deploy on Railway (Recommended — Free)

1. Go to [railway.app](https://railway.app) and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
   - If you don't have a GitHub repo: click **Deploy from local** and upload this `bot-deploy` folder
3. Set environment variables (Settings → Variables):
   ```
   DISCORD_BOT_TOKEN=your_first_token
   DISCORD_BOT_TOKEN_2=your_second_token
   DISCORD_BOT_TOKEN_3=your_third_token
   ```
4. Railway will auto-detect the Dockerfile and deploy
5. Done — bots run 24/7 forever

---

## Deploy on Render (Free)

1. Go to [render.com](https://render.com) and sign up
2. Click **New → Web Service**
3. Upload this folder or connect GitHub
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables (same as above)
6. Deploy

---

## Deploy on any VPS / Linux server

```bash
# Copy this folder to your server, then:
cd bot-deploy
npm install
DISCORD_BOT_TOKEN=xxx DISCORD_BOT_TOKEN_2=xxx DISCORD_BOT_TOKEN_3=xxx npm start
```

To keep it running permanently with PM2:
```bash
npm install -g pm2
DISCORD_BOT_TOKEN=xxx DISCORD_BOT_TOKEN_2=xxx DISCORD_BOT_TOKEN_3=xxx pm2 start "npm start" --name krm-bot
pm2 save
pm2 startup
```
