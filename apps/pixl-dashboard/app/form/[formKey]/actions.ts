"use server";

// Public, no-account form actions. Not guardedAction (that requires a
// session): these are zod-validated, call exactly one apps/server endpoint
// each, and write the same structured log line. apps/server's forms routes
// require an Origin on the apex host (isTrustedOrigin), so this server sends
// the site origin explicitly, plus this app's service key and the visitor's
// IP (lib/form-forwarding.ts) so the server's per-IP rate limits key on the
// visitor rather than on this app.
import { headers } from "next/headers";
import { z } from "zod";
import { config } from "@/app/_generated/config";
import { formForwardHeaders } from "@/lib/form-forwarding";
import { buildServerRequest } from "@/lib/server-api-core";

export type FormActionResult = { ok: true } | { ok: false; error: string };

const formKey = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i);
const slackId = z.string().trim().regex(/^[UW][A-Z0-9]{6,}$/);

const requestSchema = z.object({ formKey, slackId });
const submitSchema = z.object({
  formKey,
  slackId,
  code: z.string().trim().regex(/^\d{6}$/),
  answers: z.record(z.string().max(64), z.string().max(4000)).refine((a) => Object.keys(a).length <= 50),
  website: z.string().max(200),
});

function log(action: string, slack: string | null, result: string, error: string | null) {
  console.log(
    JSON.stringify({ app: "pixl-dashboard", action, userId: null, slackId: slack, result, error, at: new Date().toISOString() }),
  );
}

async function post(path: string, body: unknown): Promise<FormActionResult> {
  const serviceKey = process.env.SERVICE_KEY_PIXL_DASHBOARD;
  if (!serviceKey) {
    // Without the key apps/server ignores the forwarded IP and every visitor
    // shares one rate-limit bucket, so refuse rather than degrade silently.
    console.error("SERVICE_KEY_PIXL_DASHBOARD is not set - public forms cannot submit");
    return { ok: false, error: "server_unreachable" };
  }
  const { url, init } = buildServerRequest(path, { method: "POST", body: { kind: "json", value: body } });
  const h = formForwardHeaders(init.headers, await headers(), { origin: config.urls.site, serviceKey });
  try {
    const res = await fetch(url, { ...init, headers: h });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) return { ok: false, error: json.error || `http_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "server_unreachable" };
  }
}

export async function requestFormCode(input: z.input<typeof requestSchema>): Promise<FormActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    log("form.request_code", null, "invalid", "invalid_input");
    return { ok: false, error: "invalid_input" };
  }
  const { formKey: key, slackId: id } = parsed.data;
  const r = await post(`/api/forms/${encodeURIComponent(key)}/request-code`, { slackId: id });
  log("form.request_code", id, r.ok ? "ok" : "error", r.ok ? null : r.error);
  return r;
}

export async function submitForm(input: z.input<typeof submitSchema>): Promise<FormActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    log("form.submit", null, "invalid", "invalid_input");
    return { ok: false, error: "invalid_input" };
  }
  const { formKey: key, ...body } = parsed.data;
  const r = await post(`/api/forms/${encodeURIComponent(key)}/submit`, body);
  log("form.submit", body.slackId, r.ok ? "ok" : "error", r.ok ? null : r.error);
  return r;
}
