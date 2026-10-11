import type { NextFunction, Request, Response } from "express";
import { supabase } from "../db/client.js";
import { sql } from "../db/pgCompat.js";
import { verifySessionToken, type SessionClient } from "./session.js";
import { bearerToken } from "../http/bearer.js";
import { auditRequestThrottled } from "../audit.js";

const UNDEFINED_COLUMN = "42703";
const REVOCATION_CACHE_TTL_MS = 10_000;
const REVOCATION_CACHE_MAX = 50_000;

// Revocation is per (user, client). Three cutoffs live on `users`:
//  - sessions_revoked_at       (0181): every session of the user, both
//                                       clients. Moderation writes this one.
//  - game_sessions_revoked_at  (0216): game sessions only (game logout).
//  - web_sessions_revoked_at   (0216): Pixl Dashboard sessions only (web
//                                       logout).
// A session is revoked when its iat is at or before the later of the
// all-clients cutoff and its own client's cutoff.
export type RevokeScope = SessionClient | "all";

const CLIENT_COLUMN: Record<SessionClient, keyof RevocationRow> = {
  game: "game_sessions_revoked_at",
  web: "web_sessions_revoked_at",
};
const SCOPE_COLUMN: Record<RevokeScope, keyof RevocationRow> = { all: "sessions_revoked_at", ...CLIENT_COLUMN };

export const REVOCATION_COLUMNS = "sessions_revoked_at, game_sessions_revoked_at, web_sessions_revoked_at";
// Before 0216 is applied only the all-clients cutoff exists; it is still
// honored (logout answers 503 until the migration lands).
const LEGACY_REVOCATION_COLUMNS = "sessions_revoked_at";

export type RevocationLookup = { ok: true; revokedAtMs: number | null } | { ok: false };
export type RevocationReader = (userId: string, client: SessionClient) => Promise<RevocationLookup>;
export type RevokeResult = "revoked" | "not_found" | "not_migrated" | "error";

export interface RevocationRow {
  sessions_revoked_at?: unknown;
  game_sessions_revoked_at?: unknown;
  web_sessions_revoked_at?: unknown;
}

export function isSessionRevoked(session: { iat: number }, revokedAtMs: number | null): boolean {
  return revokedAtMs !== null && session.iat <= Math.floor(revokedAtMs / 1000);
}

export function parseRevokedAt(raw: unknown): RevocationLookup {
  if (raw === null || raw === undefined) return { ok: true, revokedAtMs: null };
  const ms = new Date(raw as string | Date).getTime();
  return Number.isNaN(ms) ? { ok: false } : { ok: true, revokedAtMs: ms };
}

// The cutoff that applies to `client`'s sessions: the later of the
// all-clients cutoff and that client's own. Unparseable -> fail closed.
export function effectiveRevokedAt(row: RevocationRow | null | undefined, client: SessionClient): RevocationLookup {
  const all = parseRevokedAt(row?.sessions_revoked_at);
  const own = parseRevokedAt(row?.[CLIENT_COLUMN[client]]);
  if (!all.ok || !own.ok) return { ok: false };
  if (all.revokedAtMs === null) return own;
  if (own.revokedAtMs === null) return all;
  return { ok: true, revokedAtMs: Math.max(all.revokedAtMs, own.revokedAtMs) };
}

type QueryError = { code?: string; message: string };
type ColumnQuery<T> = (columns: string) => PromiseLike<{ data: T | null; error: QueryError | null }>;

// Runs `query` with the per-client columns, falling back to the legacy
// column alone when 0216 isn't applied yet, and to "nothing revoked" when
// even 0181 isn't (the behavior before the game/web split).
export async function selectRevocation<T>(query: ColumnQuery<T>): Promise<{ data: T | null; error: QueryError | null }> {
  let result = await query(REVOCATION_COLUMNS);
  if (result.error?.code === UNDEFINED_COLUMN) result = await query(LEGACY_REVOCATION_COLUMNS);
  if (result.error?.code === UNDEFINED_COLUMN) return { data: null, error: null };
  return result;
}

export async function lookupSessionRevokedAt(userId: string, client: SessionClient): Promise<RevocationLookup> {
  const { data, error } = await selectRevocation((columns) =>
    supabase.from("users").select(columns).eq("id", userId).maybeSingle(),
  );
  if (error) {
    console.error("Failed to check session revocation", error.message);
    return { ok: false };
  }
  return effectiveRevokedAt(data as RevocationRow | null, client);
}

// scope "all" (the default) revokes both clients: moderation, admin
// revoke-sessions. A client scope is a logout from that client only.
export async function revokeUserSessions(
  userId: string,
  nowMs = Date.now(),
  scope: RevokeScope = "all",
): Promise<RevokeResult> {
  const column = SCOPE_COLUMN[scope];
  if (!column) return "error";
  const at = new Date(nowMs).toISOString();
  try {
    const rows = await sql.unsafe(
      `update users
       set ${column} = greatest(coalesce(${column}, $1::timestamptz), $1::timestamptz)
       where id = $2::uuid
       returning id`,
      [at, userId],
    );
    return rows.length > 0 ? "revoked" : "not_found";
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === UNDEFINED_COLUMN) return "not_migrated";
    console.error("Failed to revoke sessions", (err as Error).message);
    return "error";
  }
}

export function createRevocationCache(
  lookup: RevocationReader,
  ttlMs = REVOCATION_CACHE_TTL_MS,
  now: () => number = Date.now,
  maxEntries = REVOCATION_CACHE_MAX,
) {
  const cache = new Map<string, { revokedAtMs: number | null; at: number }>();
  const keyFor = (userId: string, client: SessionClient) => `${client}:${userId}`;

  async function get(userId: string, client: SessionClient): Promise<RevocationLookup> {
    const key = keyFor(userId, client);
    const cached = cache.get(key);
    if (cached && now() - cached.at < ttlMs) return { ok: true, revokedAtMs: cached.revokedAtMs };
    let fresh: RevocationLookup;
    try {
      fresh = await lookup(userId, client);
    } catch {
      return { ok: false };
    }
    if (!fresh.ok) return fresh;
    if (cache.size >= maxEntries) {
      for (const [id, entry] of cache) if (now() - entry.at >= ttlMs) cache.delete(id);
      for (const id of cache.keys()) {
        if (cache.size < maxEntries) break;
        cache.delete(id);
      }
    }
    cache.set(key, { revokedAtMs: fresh.revokedAtMs, at: now() });
    return fresh;
  }

  // Drops both clients' entries for the user.
  function forget(userId: string): void {
    cache.delete(keyFor(userId, "game"));
    cache.delete(keyFor(userId, "web"));
  }

  return { get, forget, size: () => cache.size };
}

const sharedCache = createRevocationCache(lookupSessionRevokedAt);

export const forgetCachedRevocation = sharedCache.forget;

export interface EnforceSessionRevocationDeps {
  revokedAt?: RevocationReader;
  verify?: (token: string) => ReturnType<typeof verifySessionToken>;
}

export function enforceSessionRevocation(deps: EnforceSessionRevocationDeps = {}) {
  const revokedAt = deps.revokedAt ?? sharedCache.get;
  const verify = deps.verify ?? verifySessionToken;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // requireSession has normally verified the Bearer token already.
    const token = req.session ? null : bearerToken(req);
    const session = req.session ?? (token ? verify(token) : null);
    if (!session) return next();
    let state: RevocationLookup;
    try {
      state = await revokedAt(session.userId, session.client);
    } catch {
      state = { ok: false };
    }
    if (!state.ok) {
      res.setHeader("Retry-After", "5");
      res.status(503).json({ ok: false, error: "session_check_unavailable" });
      return;
    }
    if (isSessionRevoked(session, state.revokedAtMs)) {
      auditRequestThrottled(req, {
        action: "auth.session_rejected",
        actorType: "player",
        actorId: session.userId,
        target: req.method,
        result: "denied",
        meta: { reason: "revoked", client: session.client },
      });
      res.status(401).json({ ok: false, error: "session_revoked" });
      return;
    }
    next();
  };
}
