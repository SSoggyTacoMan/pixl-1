import crypto from "crypto";
import { isSlackUserId } from "../slack/pixlMembership.js";

// The rules behind POST /api/external/dm (dmApi.ts), kept free of Bolt so they
// can be tested without booting the bot. This used to live in a separate
// relay service (apps/pixo-dm); every check it enforced is here.

export const MAX_MESSAGE_LENGTH = 3000;

// Slack control syntax a DM from the dashboard or server never needs:
// mass-pings and special tokens (<!channel>, <!here|x>, <!subteam^...>) and
// angle-bracket links of any scheme (<https://evil|pixl.hackclub.com> can
// disguise where a link goes, <mailto:...>, <slack://...>). Plain URLs still
// work, Slack auto-links them and shows the real address.
const FORBIDDEN_MESSAGE_PATTERNS = [/<\s*!/i, /<\s*[a-z][a-z0-9+.-]*:/i];

export type DmCheck =
  | { readonly ok: true; readonly target: string; readonly text: string }
  | { readonly ok: false; readonly status: 400; readonly error: string };

/** Validates a { userId, message } body. Users only (U.../W...), never channels. */
export function validateDmRequest(body: unknown): DmCheck {
  const fields = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const { userId, message } = fields;
  if (typeof userId !== "string" || typeof message !== "string" || !userId.trim() || !message.trim())
    return { ok: false, status: 400, error: "Missing userId or message" };

  const target = userId.trim();
  if (!isSlackUserId(target)) return { ok: false, status: 400, error: "Invalid Slack user ID" };

  const text = message.trim();
  if (text.length > MAX_MESSAGE_LENGTH)
    return { ok: false, status: 400, error: `message exceeds ${MAX_MESSAGE_LENGTH} characters` };
  if (FORBIDDEN_MESSAGE_PATTERNS.some((re) => re.test(text)))
    return { ok: false, status: 400, error: "message contains Slack control syntax" };

  return { ok: true, target, text };
}

/** Constant-time compare of the caller's x-api-key against the configured key. */
export function apiKeyMatches(provided: unknown, key: string): boolean {
  const providedBuf = Buffer.from(typeof provided === "string" ? provided : "");
  const keyBuf = Buffer.from(key);
  return providedBuf.length === keyBuf.length && crypto.timingSafeEqual(providedBuf, keyBuf);
}

export interface DmRateLimits {
  readonly globalPerMinute: number;
  readonly perUserPerMinute: number;
  readonly dailyGlobal: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pruneOld(hits: number[], now: number, windowMs: number): number[] {
  while (hits.length && now - hits[0] > windowMs) hits.shift();
  return hits;
}

/**
 * In-memory limits (they reset on restart): a global per-minute cap, a
 * per-user per-minute cap, and a daily global ceiling that bounds the total
 * blast radius if the API key ever leaks - the per-minute caps alone still
 * allow a slow campaign spread across many real users.
 */
export class DmRateLimiter {
  private globalHits: number[] = [];
  private dailyHits: number[] = [];
  private readonly perUserHits = new Map<string, number[]>();

  constructor(private readonly limits: DmRateLimits) {}

  /** Records the send and returns false, or returns true when over a limit. */
  isRateLimited(userId: string, now: number = Date.now()): boolean {
    pruneOld(this.globalHits, now, MINUTE_MS);
    if (this.globalHits.length >= this.limits.globalPerMinute) return true;
    pruneOld(this.dailyHits, now, DAY_MS);
    if (this.dailyHits.length >= this.limits.dailyGlobal) return true;
    const userHits = pruneOld(this.perUserHits.get(userId) ?? [], now, MINUTE_MS);
    if (userHits.length >= this.limits.perUserPerMinute) return true;
    this.globalHits.push(now);
    this.dailyHits.push(now);
    userHits.push(now);
    this.perUserHits.set(userId, userHits);
    return false;
  }

  /** Drops users whose hits have all aged out, so the map doesn't grow forever. */
  sweep(now: number = Date.now()): void {
    for (const [userId, hits] of this.perUserHits) {
      if (pruneOld(hits, now, MINUTE_MS).length === 0) this.perUserHits.delete(userId);
    }
  }

  get trackedUsers(): number {
    return this.perUserHits.size;
  }
}

export interface DmRelayRequest {
  readonly apiKey: string | undefined;
  readonly botToken: string | undefined;
  readonly providedKey: unknown;
  readonly body: unknown;
}

export interface DmRelayResponse {
  readonly status: number;
  readonly body: { ok: true } | { error: string };
}

/**
 * The whole endpoint minus Express: fail closed when unconfigured, then the
 * key, then the body, then the rate limits, and only then a Slack call.
 */
export async function relayDm(
  req: DmRelayRequest,
  limiter: DmRateLimiter,
  send: (channel: string, text: string) => Promise<void>,
): Promise<DmRelayResponse> {
  if (!req.apiKey || !req.botToken) return { status: 503, body: { error: "Service not configured" } };
  if (!apiKeyMatches(req.providedKey, req.apiKey)) return { status: 401, body: { error: "Invalid API key" } };

  const checked = validateDmRequest(req.body);
  if (!checked.ok) return { status: checked.status, body: { error: checked.error } };
  if (limiter.isRateLimited(checked.target)) return { status: 429, body: { error: "Rate limit exceeded" } };

  try {
    // channel: a user id opens (or reuses) the DM, no separate open call needed.
    await send(checked.target, checked.text);
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error("[external-dm] send failed:", (e as Error)?.message ?? e);
    return { status: 502, body: { error: "delivery_failed" } };
  }
}
