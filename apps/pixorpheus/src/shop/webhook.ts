import crypto from "crypto";
import express from "express";
import { app, http } from "../slack/app.js";
import { diffLines, region, render, requestIdFrom, RecentIds, type Bucket, type WebhookPayload } from "./format.js";

const seenRequestIds = new RecentIds();

// Where shop-change notifications go. Defaults to the #shop-changes channel
// the team asked for; override with SHOP_NOTIFY_CHANNEL if it ever moves.
const SHOP_CHANNEL = process.env.SHOP_NOTIFY_CHANNEL || "C0BA5SAEZQS";

// When the same edit is applied to several regions (e.g. the dashboard's
// "apply name & description to every region" box), the DB trigger fires one
// webhook per region, all within a few ms. Buffer briefly and collapse
// identical changes into a single message that lists the regions.
const AGGREGATION_WINDOW_MS = 2000;

const buckets = new Map<string, Bucket>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, AGGREGATION_WINDOW_MS);
}

function enqueue(key: string, seed: () => Bucket, reg: string, price?: number): void {
  let b = buckets.get(key);
  if (!b) {
    b = seed();
    buckets.set(key, b);
  }
  b.regions.add(reg);
  if (price != null) b.prices.set(reg, price);
  scheduleFlush();
}

async function flush(): Promise<void> {
  const pending = [...buckets.values()];
  buckets.clear();

  for (const b of pending) {
    try {
      await app.client.chat.postMessage({ channel: SHOP_CHANNEL, text: render(b) });
    } catch (e: any) {
      console.error("[shop-webhook] post failed:", e?.message ?? e);
    }
  }
}

function handleShopChange(payload: WebhookPayload): void {
  if (payload.table !== "shop_items") return;

  if (payload.type === "INSERT" && payload.record) {
    const r = payload.record;
    enqueue(
      `INSERT::${r.name}`,
      () => ({ kind: "INSERT", name: r.name, regions: new Set(), lines: [], prices: new Map() }),
      region(r),
      r.price,
    );
    return;
  }

  if (payload.type === "DELETE" && payload.old_record) {
    const r = payload.old_record;
    enqueue(
      `DELETE::${r.name}`,
      () => ({ kind: "DELETE", name: r.name, regions: new Set(), lines: [], prices: new Map() }),
      region(r),
    );
    return;
  }

  if (payload.type === "UPDATE" && payload.record && payload.old_record) {
    const lines = diffLines(payload.old_record, payload.record);
    if (lines.length === 0) return; // no meaningful field changed
    const r = payload.record;
    // Key by the new name + the exact diff, so the SAME edit across regions
    // merges, while a region-specific price change stays its own message.
    const key = `UPDATE::${r.name}::${lines.join("|")}`;
    enqueue(
      key,
      () => ({ kind: "UPDATE", name: r.name, regions: new Set(), lines, prices: new Map() }),
      region(r),
    );
    return;
  }
}

// Shop-change notifications POST JSON here, protected by a shared secret
// sent as a custom header (set SHOP_WEBHOOK_SECRET on both this bot and the
// internal dashboard, which sends it). The secret is required,
// without it configured, the endpoint refuses all requests rather than
// accepting unverified ones.
//
// Known limitation: a static shared secret has no timestamp or body
// signature, so a captured request can be replayed. Requests carrying an id
// (x-pixl-request-id / x-request-id / idempotency-key / body.request_id) are
// deduplicated; moving the sender (internal dashboard) to a timestamped HMAC
// is the real fix and needs a coordinated change on both sides.
http.post("/webhooks/shop", express.json({ limit: "1mb" }), (req, res) => {
  const secret = process.env.SHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[shop-webhook] SHOP_WEBHOOK_SECRET is not set; refusing request");
    return res.status(503).send("Service misconfigured");
  }
  const provided = req.headers["x-shop-webhook-secret"];
  const providedBuf = Buffer.from(typeof provided === "string" ? provided : "");
  const secretBuf = Buffer.from(secret);
  if (providedBuf.length !== secretBuf.length || !crypto.timingSafeEqual(providedBuf, secretBuf)) {
    return res.status(401).send("Invalid secret");
  }
  const requestId = requestIdFrom(req.headers, req.body);
  if (requestId && seenRequestIds.checkAndRecord(requestId)) {
    return res.status(200).send("duplicate");
  }
  res.status(200).send("ok");
  try {
    handleShopChange(req.body as WebhookPayload);
  } catch (e: any) {
    console.error("[shop-webhook]", e?.message ?? e);
  }
});
