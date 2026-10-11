import type { Request } from "express";
import { verifySessionToken } from "../auth/session.js";
import { clientIpFrom, normalizeIp, rateLimitIpKey, requestIpKey } from "../clientIp.js";
import { bearerToken } from "./bearer.js";
import { matchServiceKey, serviceKeyHeader } from "./serviceKeys.js";

// The client a request is on behalf of, for rate limiting and audit.
//
// The Pixl Dashboard's backend calls this server server-to-server for every
// visitor, so its own address says nothing about who is asking. When (and
// only when) the request carries its valid service key, the visitor's IP it
// put as the leftmost X-Forwarded-For entry is trusted. Everyone else gets
// the ingress-derived client IP (never a client-supplied header).
export function clientIpFor(req: Request): string {
  if (matchServiceKey(serviceKeyHeader(req)) === "pixl-dashboard") {
    const xff = req.headers["x-forwarded-for"];
    const first = (Array.isArray(xff) ? xff.join(",") : xff ?? "").split(",")[0]?.trim();
    const forwarded = normalizeIp(first);
    if (forwarded) return forwarded;
  }
  return clientIpFrom({
    remoteAddress: req.socket.remoteAddress,
    xForwardedFor: req.headers["x-forwarded-for"],
    cfConnectingIp: req.headers["cf-connecting-ip"],
  });
}

// Global rate-limit bucket: a verified session is limited per player (the
// Pixl Dashboard's Server Components all arrive from one address), anything
// else per client IP as above.
export function rateLimitKeyFor(req: Request): string {
  const token = bearerToken(req);
  const session = token ? verifySessionToken(token) : null;
  if (session) return `user:${session.userId}`;
  if (matchServiceKey(serviceKeyHeader(req)) === "pixl-dashboard") return rateLimitIpKey(clientIpFor(req));
  return requestIpKey(req);
}
