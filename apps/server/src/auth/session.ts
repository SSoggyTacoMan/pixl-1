import jwt from "jsonwebtoken";

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
})();

// Which app a session belongs to. The game and the Pixl Dashboard each get
// their own token kind: the WebSocket takes only "game", the Pixl Dashboard
// takes only "web", the HTTP API takes both. Decided server-side at
// POST /auth/exchange from who is calling, never from the request body.
export type SessionClient = "game" | "web";
export const SESSION_CLIENTS: readonly SessionClient[] = Object.freeze(["game", "web"]);

export function isSessionClient(value: unknown): value is SessionClient {
  return value === "game" || value === "web";
}

export interface SessionPayload {
  userId: string;
  displayName: string;
  client: SessionClient;
  slackId?: string;
}

export interface VerifiedSession extends SessionPayload {
  iat: number;
  // Expiry (unix seconds), when the token carries one.
  exp?: number;
}

const SESSION_TTL_SEC = 14 * 24 * 3600;

// revocable per (user, client), see revocation.ts
// opts.expiresAtSec re-issues a token that ends when the one it replaces
// would have (e.g. after a rename), so re-issuing never extends a session.
// It can't be later than a fresh token's own 14 days.
// opts.issuedAtSec carries the replaced token's iat over, so a re-issued
// token is revoked by exactly the revocations that revoke the original: a
// fresh iat would let a token re-issued moments after a revocation (from a
// still-cached "not revoked" lookup) outlive it. Never later than now.
export function issueSessionToken(
  payload: SessionPayload,
  opts: { expiresAtSec?: number; issuedAtSec?: number } = {},
): string {
  if (!isSessionClient(payload.client)) throw new Error("issueSessionToken: unknown client");
  const claims: SessionPayload = {
    userId: payload.userId,
    displayName: payload.displayName,
    client: payload.client,
  };
  if (payload.slackId) claims.slackId = payload.slackId;
  const now = Math.floor(Date.now() / 1000);
  let iat: number | undefined;
  if (opts.issuedAtSec !== undefined) {
    if (!(Number.isFinite(opts.issuedAtSec) && opts.issuedAtSec > 0)) throw new Error("issueSessionToken: bad issuedAtSec");
    iat = Math.min(Math.floor(opts.issuedAtSec), now);
  }
  const withIat = iat === undefined ? claims : { ...claims, iat };
  if (opts.expiresAtSec !== undefined) {
    const exp = Math.min(Math.floor(opts.expiresAtSec), now + SESSION_TTL_SEC);
    if (!(exp > now)) throw new Error("issueSessionToken: expiry already passed");
    return jwt.sign({ ...withIat, exp }, JWT_SECRET, { algorithm: "HS256" });
  }
  return jwt.sign(withIat, JWT_SECRET, { algorithm: "HS256", expiresIn: SESSION_TTL_SEC });
}

// A token without a valid `client` claim (everything issued before the
// game/web split) does not verify: its holder signs in once more and gets a
// scoped token.
export function verifySessionToken(token: string): VerifiedSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.displayName !== "string" ||
      !isSessionClient(decoded.client)
    ) {
      return null;
    }
    return {
      userId: decoded.userId,
      displayName: decoded.displayName,
      client: decoded.client,
      ...(typeof decoded.slackId === "string" && decoded.slackId ? { slackId: decoded.slackId } : {}),
      iat: typeof decoded.iat === "number" ? decoded.iat : 0,
      ...(typeof decoded.exp === "number" ? { exp: decoded.exp } : {}),
    };
  } catch {
    return null;
  }
}
