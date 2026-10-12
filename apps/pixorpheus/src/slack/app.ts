import { App } from "@slack/bolt";
import express from "express";
import { requireSlackEnv } from "./requiredEnv.js";

const { token, appToken } = requireSlackEnv();

// Slack side: Socket Mode, no HTTP receiver and no /slack/events route.
export const app = new App({ token, appToken, socketMode: true });

// In-cluster HTTP side (PORT, default 3000): the /api/external/* endpoints
// apps/server and apps/internal-dashboard call, the shop/GitHub webhooks and
// a health check. Nothing Slack-facing is served here. Started in index.ts.
export const http = express();
http.disable("x-powered-by");
http.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});
