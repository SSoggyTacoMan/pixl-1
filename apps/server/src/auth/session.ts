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
}

// revocable per (user, client), see revocation.ts
export function issueSessionToken(payload: SessionPayload): string {
  if (!isSessionClient(payload.client)) throw new Error("issueSessionToken: unknown client");
  const claims: SessionPayload = {
    userId: payload.userId,
    displayName: payload.displayName,
    client: payload.client,
  };
  if (payload.slackId) claims.slackId = payload.slackId;
  return jwt.sign(claims, JWT_SECRET, { algorithm: "HS256", expiresIn: "14d" });
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
    };
  } catch {
    return null;
  }
}
