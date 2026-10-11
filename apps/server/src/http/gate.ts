import type { NextFunction, Request, RequestHandler, Response } from "express";
import { auditRequest, auditRequestThrottled, type AuditResult } from "../audit.js";
import { isPublicRoute, normalizePath } from "./publicRoutes.js";
import { requireSession, type RequireSessionDeps } from "./requireSession.js";

// Deny by default. Mounted once in index.ts, after adminServiceGate:
// - a request a service key already authenticated (req.service) passes;
// - anything else under /api/admin is refused (adminServiceGate should have
//   answered it already, this is the backstop);
// - a route in publicRoutes.ts passes with no identity;
// - everything else needs a valid Bearer session (requireSession).
// A session token in the query string is refused outright, wherever it is
// sent, so no client can drift back to putting tokens in URLs.
export function authGate(deps: RequireSessionDeps = {}): RequestHandler {
  const session = requireSession(deps);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (typeof req.query?.token !== "undefined") {
      auditRequestThrottled(req, {
        action: "auth.session_rejected",
        target: req.method,
        result: "denied",
        meta: { reason: "token_in_query" },
      });
      res.status(400).json({ ok: false, error: "token_in_query" });
      return;
    }
    if (req.service) return next();
    const path = normalizePath(req.path);
    if (path === "/api/admin" || path.startsWith("/api/admin/")) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
    if (isPublicRoute(req.method, req.path)) return next();
    session(req, res, next);
  };
}

function resultFor(status: number): AuditResult {
  if (status < 400) return "ok";
  if (status === 401 || status === 403) return "denied";
  return "error";
}

// Writes one audit row per finished non-GET /api request, and per service
// (admin) call of any method: action `http.<method>`, target the matched
// route pattern (never the raw URL, which can carry ids or worse), and only
// the status code in meta. Registered before the auth gate so refused
// requests are recorded too.
export function auditApiRequests(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    const path = normalizePath(req.path);
    const isApi = path === "/api" || path.startsWith("/api/");
    const isRead = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (!isApi) return next();
    res.on("finish", () => {
      if (isRead && !req.service) return;
      const route = (req.route as { path?: unknown } | undefined)?.path;
      auditRequest(req, {
        action: `http.${method.toLowerCase()}`,
        target: typeof route === "string" ? `${req.baseUrl ?? ""}${route}` : "unmatched",
        result: resultFor(res.statusCode),
        meta: { status: res.statusCode },
      });
    });
    next();
  };
}
