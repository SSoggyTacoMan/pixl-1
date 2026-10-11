import jwt from "jsonwebtoken";

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
})();

export interface SessionPayload {
  userId: string;
  displayName: string;
  // Optional: tokens issued before it was added still verify.
  slackId?: string;
}

export interface VerifiedSession extends SessionPayload {
  iat: number;
}

// revocable per user, see revocation.ts
export function issueSessionToken(payload: SessionPayload): string {
  const claims: SessionPayload = { userId: payload.userId, displayName: payload.displayName };
  if (payload.slackId) claims.slackId = payload.slackId;
  return jwt.sign(claims, JWT_SECRET, { algorithm: "HS256", expiresIn: "14d" });
}

export function verifySessionToken(token: string): VerifiedSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.displayName !== "string"
    ) {
      return null;
    }
    return {
      userId: decoded.userId,
      displayName: decoded.displayName,
      ...(typeof decoded.slackId === "string" && decoded.slackId ? { slackId: decoded.slackId } : {}),
      iat: typeof decoded.iat === "number" ? decoded.iat : 0,
    };
  } catch {
    return null;
  }
}
