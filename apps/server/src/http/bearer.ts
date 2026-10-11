import type { IncomingHttpHeaders } from "node:http";

// The session token comes from `Authorization: Bearer <jwt>` and nowhere
// else: never the query string, never the body, never a cookie.
export function bearerToken(req: { headers: IncomingHttpHeaders }): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer[ ]+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
