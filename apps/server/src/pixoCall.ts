import { audit } from "./audit.js";

// Every server -> Pixo HTTP call goes through callPixo so that Pixo being
// stopped or unreachable can never fail or stall a player action: a short
// timeout, no throw, and the failure is logged and audited (pixo.call_failed).

export const PIXO_TIMEOUT_MS = 5000;

export type PixoFetcher = (input: string, init: RequestInit) => Promise<Response>;

export type PixoCallResult =
  | { readonly ok: true; readonly status: number }
  /** offline: no HTTP answer (refused, DNS, timeout) or a 5xx from Pixo. */
  | { readonly ok: false; readonly offline: boolean; readonly status: number | null; readonly reason: string };

export interface PixoCallDeps {
  readonly fetchImpl?: PixoFetcher;
  readonly report?: (label: string, reason: string, status: number | null) => void;
  readonly timeoutMs?: number;
}

function defaultReport(label: string, reason: string, status: number | null): void {
  console.error(`[pixo] ${label} failed: ${reason}`);
  audit({ actorType: "service", action: "pixo.call_failed", target: label, result: "error", meta: { reason, status } });
}

export async function callPixo(label: string, url: string, init: RequestInit, deps: PixoCallDeps = {}): Promise<PixoCallResult> {
  const fetchImpl = deps.fetchImpl ?? ((u: string, i: RequestInit) => fetch(u, i));
  const report = deps.report ?? defaultReport;
  const safeReport = (reason: string, status: number | null) => {
    try {
      report(label, reason, status);
    } catch {}
  };
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(deps.timeoutMs ?? PIXO_TIMEOUT_MS) });
  } catch (e) {
    const err = e as Error;
    const reason = err?.name === "TimeoutError" || err?.name === "AbortError" ? "timeout" : `unreachable: ${err?.message ?? String(e)}`;
    safeReport(reason, null);
    return { ok: false, offline: true, status: null, reason };
  }
  if (res.ok) return { ok: true, status: res.status };
  const reason = `http ${res.status}`;
  safeReport(reason, res.status);
  return { ok: false, offline: res.status >= 500, status: res.status, reason };
}
