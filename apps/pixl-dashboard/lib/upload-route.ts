// Image uploads as a dedicated route handler (app/api/uploads/image/route.ts)
// instead of a Server Action, so the global Server Action body limit can stay
// at 1MB (next.config.ts) while only this one endpoint accepts up to 15MB.
// Kept dependency-injected like lib/guarded-action-core.ts so it's unit
// tested. Same guarantees as a guarded action: same-origin, verified session,
// validated input, exactly one apps/server call, one structured log line.
import { sameOrigin } from "./auth-flow";
import type { ActionLogLine } from "./guarded-action-core";
import { serverFetch } from "./server-api-core";
import type { SessionPayload } from "./session";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 15_000_000; // apps/server/src/routes/uploads.ts MAX_IMAGE_BYTES

export interface UploadDeps {
  getAuth: () => Promise<{ token: string; session: SessionPayload } | null>;
  fetchImpl?: typeof fetch;
  log: (line: ActionLogLine) => void;
  now?: () => Date;
}

type Outcome = { ok: true; url: string } | { ok: false; error: string };

function reply(status: number, body: Outcome): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Reads at most `max` bytes; null if the body is larger (stops reading early). */
export async function readCapped(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function handleImageUpload(req: Request, deps: UploadDeps): Promise<Response> {
  const at = (deps.now ?? (() => new Date()))().toISOString();
  const base = { app: "pixl-dashboard" as const, action: "upload.image", target: null, at };
  const anon = { userId: null, slackId: null };

  if (!sameOrigin(req.headers.get("origin"), new URL(req.url).origin)) {
    deps.log({ ...base, ...anon, result: "denied", status: null, error: "bad_origin" });
    return reply(403, { ok: false, error: "bad_origin" });
  }

  const auth = await deps.getAuth();
  if (!auth) {
    deps.log({ ...base, ...anon, result: "denied", status: null, error: "unauthorized" });
    return reply(401, { ok: false, error: "unauthorized" });
  }
  const who = { userId: auth.session.userId, slackId: auth.session.slackId ?? null };
  const invalid = (status: number, error: string) => {
    deps.log({ ...base, ...who, result: "invalid", status: null, error });
    return reply(status, { ok: false, error });
  };

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) return invalid(415, "unsupported_type");

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return invalid(413, "file_too_large");

  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(req.body, MAX_IMAGE_BYTES);
  } catch {
    return invalid(400, "invalid_input");
  }
  if (bytes === null) return invalid(413, "file_too_large");
  if (bytes.byteLength === 0) return invalid(400, "empty_body");

  const res = await serverFetch<{ url?: unknown }>(
    "/api/uploads",
    { method: "POST", token: auth.token, body: { kind: "raw", value: bytes, contentType: type } },
    deps.fetchImpl,
  );
  if (!res.ok) {
    const result = res.status === 401 || res.status === 403 ? "denied" : "error";
    deps.log({ ...base, ...who, result, status: res.status, error: res.error });
    if (res.status === 401) return reply(401, { ok: false, error: "unauthorized" });
    const status = res.status >= 400 && res.status < 600 ? res.status : 502;
    return reply(status, { ok: false, error: res.error });
  }
  const url = typeof res.data?.url === "string" ? res.data.url : "";
  deps.log({ ...base, ...who, result: url ? "ok" : "error", status: res.status, error: url ? null : "cdn_failed" });
  return url ? reply(200, { ok: true, url }) : reply(502, { ok: false, error: "cdn_failed" });
}
