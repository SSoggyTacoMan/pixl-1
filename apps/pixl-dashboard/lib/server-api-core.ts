// Pure request building for apps/server calls, kept free of next/headers so
// it can be unit tested and shared by route handlers, Server Components and
// Server Actions alike. Every call to apps/server goes through here: the
// token only ever travels as `Authorization: Bearer`, never in a URL.
import { config } from "@/app/_generated/config";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ServerBody =
  | { kind: "json"; value: unknown }
  | { kind: "raw"; value: Blob | ArrayBuffer | Uint8Array; contentType: string };

export interface ServerRequestOptions {
  method?: HttpMethod;
  token?: string | null;
  serviceKey?: string | null;
  body?: ServerBody;
}

export const SERVER_ORIGIN = config.urls.server;

/**
 * Rejects anything that isn't a plain absolute path on apps/server: no
 * scheme, no protocol-relative `//host`, no `..` segments, no backslashes.
 * Callers interpolate ids into paths, so this is the backstop against an id
 * that smuggles in a different route.
 */
export function assertServerPath(path: string): void {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /(^|\/)\.\.?(\/|$|\?)/.test(path) ||
    /[\s\u0000-\u001f]/.test(path) ||
    // WHATWG URL treats "%2e"/".%2E"/"%2e%2e" as dot segments, and an encoded
    // "/" or "\" can be decoded into a separator further down the stack. No
    // legitimate caller needs any of them in the path (encodeURIComponent
    // never emits %2e), so the path part refuses them outright.
    /%(2e|2f|5c)/i.test(pathPart(path))
  ) {
    throw new Error(`invalid server path: ${String(path)}`);
  }
}

/** The part of a request target before any query string or fragment. */
function pathPart(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

export function buildServerRequest(
  path: string,
  opts: ServerRequestOptions = {},
): { url: string; init: RequestInit } {
  assertServerPath(path);
  const url = new URL(path, SERVER_ORIGIN);
  if (url.origin !== new URL(SERVER_ORIGIN).origin) throw new Error("server origin mismatch");
  // Backstop for anything the string checks miss: if URL parsing rewrote the
  // path at all (dot-segment collapsing, re-encoding), the request would hit
  // a different route than the caller wrote, so refuse it.
  if (url.pathname !== pathPart(path)) throw new Error(`invalid server path: ${path}`);

  const headers = new Headers();
  headers.set("accept", "application/json");
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  if (opts.serviceKey) headers.set("x-pixl-service-key", opts.serviceKey);

  let body: BodyInit | undefined;
  if (opts.body?.kind === "json") {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body.value ?? {});
  } else if (opts.body?.kind === "raw") {
    headers.set("content-type", opts.body.contentType);
    body = opts.body.value as BodyInit;
  }

  return {
    url: url.toString(),
    init: {
      method: opts.method ?? (body === undefined ? "GET" : "POST"),
      headers,
      body,
      // Always per-user data: Next's fetch cache must never serve one
      // player's response to another.
      cache: "no-store",
      redirect: "manual",
    },
  };
}

export type ServerResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: unknown };

/** Error code from a server JSON body ({ error } / { message }), or a status fallback. */
export function errorCode(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string" && d.error) return d.error;
    if (typeof d.message === "string" && d.message) return d.message;
    // Some routes (e.g. referral apply) explain a failure only in `reason`.
    if (typeof d.reason === "string" && d.reason) return d.reason;
  }
  if (status === 0) return "server_unreachable";
  return `http_${status}`;
}

export async function serverFetch<T>(
  path: string,
  opts: ServerRequestOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ServerResult<T>> {
  const { url, init } = buildServerRequest(path, opts);
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch {
    return { ok: false, status: 0, error: "server_unreachable" };
  }
  let data: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  // Some apps/server routes answer 200 with { ok: false, error }.
  const flaggedFail =
    data !== null && typeof data === "object" && (data as { ok?: unknown }).ok === false;
  if (!res.ok || flaggedFail) {
    return { ok: false, status: res.status, error: errorCode(data, res.status), data };
  }
  return { ok: true, status: res.status, data: data as T };
}
