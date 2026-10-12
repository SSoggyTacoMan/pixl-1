// Every dashboard -> Pixo HTTP call goes through callPixo so that Pixo being
// stopped or unreachable can never fail a staff action: a short timeout, no
// throw, and the failure is logged and audited (pixo.call_failed) instead.
// Callers decide what to do with { ok: false } - fall back, or tell staff
// "Pixo is offline" - but the request path always completes.

export const PIXO_TIMEOUT_MS = 5000;
export const PIXO_OFFLINE_MESSAGE = "Pixo is offline right now.";

export type PixoCallResult =
  | { readonly ok: true; readonly status: number; readonly res: Response }
  /** offline: no HTTP answer at all (refused, DNS, timeout) or a 5xx from Pixo. */
  | { readonly ok: false; readonly offline: boolean; readonly status: number | null; readonly res: Response | null; readonly reason: string };

export interface PixoCallDeps {
  readonly fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  readonly report?: (label: string, reason: string, status: number | null) => void | Promise<void>;
  readonly timeoutMs?: number;
}

async function defaultReport(label: string, reason: string, status: number | null): Promise<void> {
  console.error(`[pixo] ${label} failed: ${reason}`);
  try {
    const { audit } = await import("./audit");
    await audit({ action: "pixo.call_failed", result: "error", actorType: "service", target: label, meta: { reason, status } });
  } catch {
    // Auditing is best-effort, like the call itself.
  }
}

/** Never throws. A non-2xx 4xx answer is returned as { ok: false, offline: false } with the response. */
export async function callPixo(label: string, url: string, init: RequestInit, deps: PixoCallDeps = {}): Promise<PixoCallResult> {
  const fetchImpl = deps.fetchImpl ?? ((u: string, i: RequestInit) => fetch(u, i));
  const report = deps.report ?? defaultReport;
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(deps.timeoutMs ?? PIXO_TIMEOUT_MS) });
  } catch (e) {
    const err = e as Error;
    const reason = err?.name === "TimeoutError" || err?.name === "AbortError" ? "timeout" : `unreachable: ${err?.message ?? String(e)}`;
    try {
      await report(label, reason, null);
    } catch {}
    return { ok: false, offline: true, status: null, res: null, reason };
  }
  if (res.ok) return { ok: true, status: res.status, res };
  const reason = `http ${res.status}`;
  try {
    await report(label, reason, res.status);
  } catch {}
  return { ok: false, offline: res.status >= 500, status: res.status, res, reason };
}

/**
 * Cheap reachability probe for pages that want to show "Pixo is offline"
 * up front. Not audited (it runs on page views); never throws.
 */
export async function pixoStatus(baseUrl: string, deps: PixoCallDeps = {}): Promise<"online" | "offline" | "not_configured"> {
  if (!process.env.EXTERNAL_API_KEY) return "not_configured";
  const r = await callPixo("healthz", `${baseUrl}/healthz`, { method: "GET" }, { timeoutMs: 2000, report: () => {}, ...deps });
  return r.ok ? "online" : "offline";
}
