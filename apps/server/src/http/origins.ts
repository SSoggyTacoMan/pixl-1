import type { NextFunction, Request, Response } from "express";
import { config } from "../config.generated.js";
import { auditRequestThrottled } from "../audit.js";

// The only browser origins allowed to talk to this server. No localhost and
// no env override: a dev build talks to a dev server, never to this list.
export const ALLOWED_ORIGINS: readonly string[] = Object.freeze([
  config.urls.site,
  config.urls.play,
  config.urls.dash,
]);

export function isAllowedOrigin(origin: string | undefined | null): boolean {
  return typeof origin === "string" && ALLOWED_ORIGINS.includes(origin);
}

// Security headers on every response, plus the origin allowlist:
// - an Origin header that isn't on the list is a 403 and an origin.rejected
//   audit row;
// - an allowed Origin is echoed back (never "*"), with Vary: Origin;
// - no Origin at all is a server-to-server / non-browser call, which passes
//   this layer but still has to authenticate (see gate.ts).
// Access-Control-Allow-Credentials is deliberately never set: nothing here
// rides on cookies.
export function originGuard() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.header("Vary", "Origin");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Referrer-Policy", "no-referrer");
    // This is a pure JSON API, never HTML, a locked-down CSP/frame policy
    // costs nothing and closes off any accidental HTML error response as an
    // XSS/clickjacking vector.
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.header("Strict-Transport-Security", "max-age=15552000; includeSubDomains");

    const origin = req.headers.origin;
    if (origin !== undefined) {
      if (!isAllowedOrigin(origin)) {
        auditRequestThrottled(req, {
          action: "origin.rejected",
          target: req.method,
          result: "denied",
          meta: { origin: String(origin).slice(0, 200) },
        });
        res.status(403).json({ ok: false, error: "origin_not_allowed" });
        return;
      }
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
