// Pure helpers + copy for the referrals page.

export interface ReferralMe {
  ok?: boolean;
  code: string;
  canApply: boolean;
  referralWindowHours: number;
  boost: { shipsUsed: number; shipsRemaining: number } | null;
  referrals: { total: number; rewarded: number; pixelsEarned: number };
}

// Display copy carried over verbatim from the old refers page. The payouts
// themselves are computed and paid by apps/server; nothing here does math.
export const TIERS = [
  { hrs: "2H", amt: "+6px", usd: "~$0.60" },
  { hrs: "5H", amt: "+13px", usd: "~$1.30" },
  { hrs: "10H", amt: "+23px", usd: "~$2.30" },
  { hrs: "25H", amt: "+50px", usd: "~$5.00" },
  { hrs: "50H", amt: "+74px", usd: "~$7.40" },
  { hrs: "100H", amt: "+133px", usd: "~$13.30" },
] as const;

/** Uppercased, trimmed, limited to the code alphabet's shape. */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function referralLink(site: string, code: string): string {
  return `${site}/refers?code=${encodeURIComponent(code)}`;
}

export type ApplyCardState = "boost-active" | "boost-used" | "apply" | "expired";

export function applyCardState(me: Pick<ReferralMe, "boost" | "canApply">): ApplyCardState {
  if (me.boost) return me.boost.shipsRemaining > 0 ? "boost-active" : "boost-used";
  return me.canApply ? "apply" : "expired";
}

/**
 * apps/server explains apply failures in a `reason` field that the shared
 * fetch helper doesn't surface, so status-only codes get a readable fallback.
 */
export function applyError(code: string | null | undefined): string {
  if (!code) return "Couldn't apply that code.";
  if (code === "http_404") return "That referral code doesn't exist.";
  if (code === "http_400")
    return "Couldn't apply that code. Codes only work once, within your first hours on Pixl, and not your own.";
  if (code === "rate_limited") return "Slow down a little and try again shortly.";
  if (code === "unauthorized") return "Your session expired. Log in again.";
  if (/\s/.test(code) && code.length < 300) return code;
  return "Couldn't apply that code right now.";
}
