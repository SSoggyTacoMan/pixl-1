// Server-only helpers that pull the session token from the cookie and call
// apps/server through lib/server-api-core.ts.
import "server-only";
import { getToken } from "./session";
import { serverFetch, type HttpMethod, type ServerBody, type ServerResult } from "./server-api-core";

export { serverFetch } from "./server-api-core";
export type { ServerResult } from "./server-api-core";

/**
 * For Server Components: GET with the signed-in player's token. Returns null
 * on any failure (no session, non-2xx, bad JSON) so pages can render an
 * empty state instead of crashing.
 */
export async function serverApi<T>(path: string): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  const r = await serverFetch<T>(path, { token });
  return r.ok ? r.data : null;
}

/** Same as serverApi but keeps the error for pages that need to show it. */
export async function serverGet<T>(path: string): Promise<ServerResult<T>> {
  const token = await getToken();
  if (!token) return { ok: false, status: 401, error: "unauthorized" };
  return serverFetch<T>(path, { token });
}

/** For public endpoints (no session needed). */
export async function publicGet<T>(path: string): Promise<T | null> {
  const r = await serverFetch<T>(path);
  return r.ok ? r.data : null;
}

export async function serverSend<T>(
  token: string,
  method: HttpMethod,
  path: string,
  body?: ServerBody,
): Promise<ServerResult<T>> {
  return serverFetch<T>(path, { token, method, body });
}
