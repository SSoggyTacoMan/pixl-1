import type { IncomingMessage } from "node:http";
import { sql } from "./db/pgCompat.js";
import { clientIpFrom } from "./clientIp.js";

// Server side of the audit_log table (drizzle/0214_audit_log.sql). Every
// write is fire-and-forget: a failed insert goes to stderr and never breaks
// the request that triggered it.
//
// `meta` must never carry tokens, secrets, passwords or decrypted PII - only
// ids, route patterns, status codes and short reason strings.

export type AuditActorType = "player" | "staff" | "service" | "anonymous";
export type AuditResult = "ok" | "denied" | "error";

export interface AuditEvent {
  actorType: AuditActorType;
  actorId?: string | null;
  slackId?: string | null;
  action: string;
  target?: string | null;
  result: AuditResult;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export interface AuditRow {
  app: "server";
  actor_type: AuditActorType;
  actor_id: string | null;
  slack_id: string | null;
  action: string;
  target: string | null;
  result: AuditResult;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
}

export type AuditWriter = (row: AuditRow) => Promise<void>;

const MAX_TEXT = 512;

async function insertRow(row: AuditRow): Promise<void> {
  await sql.unsafe(
    `insert into audit_log (app, actor_type, actor_id, slack_id, action, target, result, ip, user_agent, meta)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      row.app,
      row.actor_type,
      row.actor_id,
      row.slack_id,
      row.action,
      row.target,
      row.result,
      row.ip,
      row.user_agent,
      JSON.stringify(row.meta),
    ],
  );
}

let writer: AuditWriter = insertRow;

// Tests swap the writer to capture rows instead of needing a database.
export function setAuditWriter(next: AuditWriter | null): void {
  writer = next ?? insertRow;
}

function clip(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) : value;
}

export function toAuditRow(event: AuditEvent): AuditRow {
  return {
    app: "server",
    actor_type: event.actorType,
    actor_id: clip(event.actorId),
    slack_id: clip(event.slackId),
    action: event.action,
    target: clip(event.target),
    result: event.result,
    ip: clip(event.ip),
    user_agent: clip(event.userAgent),
    meta: event.meta ?? {},
  };
}

export function audit(event: AuditEvent): void {
  let row: AuditRow;
  try {
    row = toAuditRow(event);
  } catch (err) {
    console.error("[audit] could not build row", event.action, (err as Error).message);
    return;
  }
  Promise.resolve()
    .then(() => writer(row))
    .catch((err: unknown) => {
      console.error("[audit] write failed", row.action, (err as Error)?.message ?? err);
    });
}

// Rejection events (bad origin, bad token, rate limit hits) are driven by the
// caller, so an attacker could otherwise turn them into a write flood against
// audit_log. One row per (action, key) per window is plenty to see it
// happening; the rest are counted and the count rides on the next row.
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX_PER_WINDOW = 10;
const THROTTLE_MAX_KEYS = 50_000;
const throttle = new Map<string, { count: number; resetAt: number; suppressed: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of throttle) if (b.resetAt <= now) throttle.delete(k);
}, THROTTLE_WINDOW_MS).unref();

// Tests share one client IP across files; they reset the window.
export function resetAuditThrottle(): void {
  throttle.clear();
}

export function auditThrottled(key: string, event: AuditEvent, now = Date.now()): boolean {
  const bucketKey = `${event.action}:${key}`;
  let bucket = throttle.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && throttle.size >= THROTTLE_MAX_KEYS) {
      const oldest = throttle.keys().next().value;
      if (oldest !== undefined) throttle.delete(oldest);
    }
    bucket = { count: 0, resetAt: now + THROTTLE_WINDOW_MS, suppressed: bucket?.suppressed ?? 0 };
    throttle.set(bucketKey, bucket);
  }
  bucket.count++;
  if (bucket.count > THROTTLE_MAX_PER_WINDOW) {
    bucket.suppressed++;
    return false;
  }
  const suppressed = bucket.suppressed;
  bucket.suppressed = 0;
  audit(suppressed > 0 ? { ...event, meta: { ...(event.meta ?? {}), suppressed } } : event);
  return true;
}

type RequestLike = Pick<IncomingMessage, "headers" | "socket"> & {
  session?: { userId: string; slackId?: string | null };
  service?: string;
};

// The ip / user agent / actor for a request, shaped for audit(). Identity
// only ever comes from what the auth layer attached (req.session /
// req.service), never from anything the client sent.
export function requestActor(req: RequestLike): Pick<
  AuditEvent,
  "actorType" | "actorId" | "slackId" | "ip" | "userAgent"
> {
  const ua = req.headers["user-agent"];
  const base = {
    ip: clientIpFrom({
      remoteAddress: req.socket?.remoteAddress,
      xForwardedFor: req.headers["x-forwarded-for"],
      cfConnectingIp: req.headers["cf-connecting-ip"],
    }),
    userAgent: typeof ua === "string" ? ua : null,
  };
  if (req.service) return { ...base, actorType: "service", actorId: req.service, slackId: null };
  if (req.session)
    return { ...base, actorType: "player", actorId: req.session.userId, slackId: req.session.slackId ?? null };
  return { ...base, actorType: "anonymous", actorId: null, slackId: null };
}

export function auditRequest(
  req: RequestLike,
  event: Omit<AuditEvent, "actorType" | "actorId" | "slackId" | "ip" | "userAgent"> &
    Partial<Pick<AuditEvent, "actorType" | "actorId" | "slackId">>,
): void {
  const actor = requestActor(req);
  audit({ ...actor, ...stripUndefined(event) } as AuditEvent);
}

// auditRequest for caller-driven rejections, throttled per client IP.
export function auditRequestThrottled(
  req: RequestLike,
  event: Omit<AuditEvent, "actorType" | "actorId" | "slackId" | "ip" | "userAgent"> &
    Partial<Pick<AuditEvent, "actorType" | "actorId" | "slackId">>,
): void {
  const actor = requestActor(req);
  auditThrottled(actor.ip ?? "unknown", { ...actor, ...stripUndefined(event) } as AuditEvent);
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
