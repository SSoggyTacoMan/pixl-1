import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { supabase } from "../db/client.js";
import { fetchHackatimeStats, fetchProjectActivitySummary, HACKATIME_CUTOFF } from "../hackatime/api.js";
import { config } from "../config.generated.js";
import { checkRedirect } from "../auth/loginCodes.js";
import { validate, v } from "../http/validate.js";
import { audit, auditRequest, requestActor } from "../audit.js";

// OAuth app config - set these as env vars on the server (never in the repo).
const BASE = (process.env.HACKATIME_BASE ?? "https://hackatime.hackclub.com").replace(/\/$/, "");
const CLIENT_ID = process.env.HACKATIME_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.HACKATIME_CLIENT_SECRET ?? "";
const REDIRECT_URI =
  process.env.HACKATIME_REDIRECT_URI ?? `${config.urls.server}/hackatime/callback`;
const SCOPES = process.env.HACKATIME_SCOPES ?? "profile read";

function configured(): boolean {
  return CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;
}

// Pending Hackatime OAuth round trips, keyed by a random single-use `state`
// (never anything derived from the session token). The callback consumes
// the entry, so a state can't be replayed, and sends the browser back to the
// allowlisted redirect the client asked for.
interface PendingConnect {
  userId: string;
  redirect: string;
  expiresAt: number;
}
const CONNECT_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_CONNECTS = 20_000;
const pendingConnects = new Map<string, PendingConnect>();

setInterval(() => {
  const now = Date.now();
  for (const [state, p] of pendingConnects) if (p.expiresAt <= now) pendingConnects.delete(state);
}, 60_000).unref();

export function startConnect(userId: string, redirect: string, now = Date.now()): string {
  while (pendingConnects.size >= MAX_PENDING_CONNECTS) {
    const oldest = pendingConnects.keys().next().value;
    if (oldest === undefined) break;
    pendingConnects.delete(oldest);
  }
  const state = randomBytes(32).toString("base64url");
  pendingConnects.set(state, { userId, redirect, expiresAt: now + CONNECT_TTL_MS });
  return state;
}

export function consumeConnect(state: string, now = Date.now()): PendingConnect | null {
  const p = pendingConnects.get(state);
  if (!p) return null;
  pendingConnects.delete(state);
  return p.expiresAt > now ? p : null;
}

function page(message: string): string {
  return (
    `<!doctype html><meta charset="utf-8">` +
    `<body style="margin:0;background:#141009;color:#f4e3c2;font-family:monospace;` +
    `display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">` +
    `<div style="font-size:18px;max-width:420px;padding:24px">${message}</div></body>`
  );
}

function back(redirect: string, outcome: "connected" | "failed"): string {
  const dest = new URL(redirect);
  dest.searchParams.set("hackatime", outcome);
  return dest.toString();
}

const router = Router();

// Start the OAuth flow. Bearer-authenticated; returns the Hackatime consent
// URL for the client to navigate to. The round trip ends on `redirect`
// (an allowlisted https URL on the Pixl Dashboard or the game) with
// ?hackatime=connected|failed.
router.post(
  "/api/hackatime/connect",
  validate({ query: v.noQuery, body: z.object({ redirect: z.string().max(2000) }) }),
  (req, res) => {
    if (!configured()) return res.status(503).json({ ok: false, error: "hackatime_not_configured" });
    const session = req.session;
    if (!session) return res.status(401).json({ ok: false });
    const redirect = checkRedirect(req.body.redirect);
    if (!redirect) return res.status(400).json({ ok: false, error: "invalid_redirect" });

    const state = startConnect(session.userId, redirect);
    const url =
      `${BASE}/oauth/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&state=${encodeURIComponent(state)}`;
    res.json({ ok: true, url });
  },
);

// HackTime redirects back here with a code; exchange it for an access token and
// store it on the user.
router.get(
  "/hackatime/callback",
  validate({ query: z.object({ code: z.string().max(2000).optional(), state: z.string().max(200).optional() }) }),
  async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const pending = state ? consumeConnect(state) : null;
    if (!code || !pending) {
      auditRequest(req, { action: "hackatime.connect", target: "hackatime", result: "denied", meta: { reason: "invalid_state" } });
      return res.status(400).send(page("Connection failed: invalid request."));
    }
    const { userId, redirect } = pending;
    const done = (result: "ok" | "error", reason?: string) =>
      audit({
        ...requestActor(req),
        actorType: "player",
        actorId: userId,
        action: "hackatime.connect",
        target: `user:${userId}`,
        result,
        ...(reason ? { meta: { reason } } : {}),
      });

    try {
      const tokenRes = await fetch(`${BASE}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) {
        done("error", "token_rejected");
        return res.redirect(back(redirect, "failed"));
      }

      const data = (await tokenRes.json()) as { access_token?: string };
      if (!data.access_token) {
        done("error", "no_token");
        return res.redirect(back(redirect, "failed"));
      }

      const { data: updated, error } = await supabase
        .from("users")
        .update({ hackatime_token: data.access_token })
        .eq("id", userId)
        .select("id");
      if (error || !updated || updated.length === 0) {
        console.error("[hackatime] failed to save token", { userId, error: error?.message, matched: updated?.length ?? 0 });
        done("error", "save_failed");
        return res.redirect(back(redirect, "failed"));
      }

      console.log("[hackatime] token saved for", userId);
      done("ok");
      res.redirect(back(redirect, "connected"));
    } catch (e) {
      console.error("[hackatime] callback failed", (e as Error).message);
      done("error", "exception");
      res.redirect(back(redirect, "failed"));
    }
  },
);

// Current connection state + per-project time for the logged-in user.
router.get("/api/hackatime/stats", async (req, res) => {
  const session = req.session;
  if (!session) return res.status(401).json({ ok: false });

  const { data } = await supabase
    .from("users")
    .select("hackatime_token, slack_id")
    .eq("id", session.userId)
    .single();
  const row = data as { hackatime_token?: string; slack_id?: string } | null;
  const htToken = row?.hackatime_token ?? null;
  const slackId = row?.slack_id ?? null;
  const stats = await fetchHackatimeStats(htToken);
  // A project whose hours cutoff a reviewer extended (projects.hours_extended_since)
  // counts from that earlier date instead, so its page asks for ?since=<unix> to
  // show the numbers it will actually be credited. Display-only (ship re-reads
  // the stored date itself), and only ever earlier than the event cutoff.
  const sinceRaw = Number(req.query.since);
  const since =
    Number.isFinite(sinceRaw) && sinceRaw > 0 && sinceRaw < HACKATIME_CUTOFF
      ? Math.floor(sinceRaw)
      : HACKATIME_CUTOFF;
  // Flag projects with any activity before the event cutoff so the picker can
  // warn "only time after the cutoff counts" before the player links one. Capped
  // to the top 40 by tracked time so a prolific account doesn't fan out into
  // dozens of Hackatime API calls.
  if (stats.connected && slackId) {
    const toCheck = [...stats.projects].sort((a, b) => b.seconds - a.seconds).slice(0, 40);
    const summaries = await Promise.all(
      toCheck.map((p) => fetchProjectActivitySummary(slackId, htToken, p.name, since)),
    );
    const byName = new Map(toCheck.map((p, i) => [p.name, summaries[i]]));
    stats.projects = stats.projects.map((p) => {
      const s = byName.get(p.name);
      if (!s) return p;
      return {
        ...p,
        beforeCutoff: s.firstActivity != null && s.firstActivity < since,
        secondsSinceCutoff: s.secondsSinceCutoff,
      };
    });
  }
  res.json({ ok: true, stats });
});

export default router;
