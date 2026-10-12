import express from "express";
import { app, http } from "../slack/app.js";
import { DmRateLimiter, relayDm } from "./dmRelay.js";

// Delivers every player-facing DM the internal dashboard (dmUser() in
// apps/internal-dashboard/lib/slack.ts) and the game server (moderation.ts,
// shipNotify.ts) send, so players see them coming from Pixo, one consistent
// identity. Contract: POST { userId, message } with x-api-key =
// EXTERNAL_API_KEY; 200 { ok: true } or { error }. The checks live in
// dmRelay.ts (users only, no Slack control syntax, length and rate limits).
const limiter = new DmRateLimiter({
  globalPerMinute: 60,
  perUserPerMinute: 5,
  dailyGlobal: Number(process.env.PIXO_DM_DAILY_LIMIT) || 1000,
});

setInterval(() => limiter.sweep(), 60_000).unref();

http.post("/api/external/dm", express.json(), async (req, res) => {
  const result = await relayDm(
    {
      apiKey: process.env.EXTERNAL_API_KEY,
      botToken: process.env.SLACK_BOT_TOKEN,
      providedKey: req.headers["x-api-key"],
      body: req.body,
    },
    limiter,
    async (channel, text) => {
      await app.client.chat.postMessage({ channel, text });
    },
  );
  res.status(result.status).json(result.body);
});
