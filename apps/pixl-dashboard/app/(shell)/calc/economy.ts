// Payout math for /calc. The ONE place this app touches the economy formulas.
//
// It doesn't re-implement them: rePerHour / reForHours / projectPayoutUsd /
// projectPayoutPx come straight from app/_generated/config.ts, which
// `bun run config:sync` writes from the same template and pixl.json as
// apps/server/src/config.generated.ts (the functions apps/server/src/xp.ts
// credits payouts with). economy.test.ts pins this module against the
// server's copy and a table of server-computed values, so any drift fails CI.
//
// Only imported from Server Components (calc/page.tsx): the browser gets the
// computed numbers, never the formulas (hardened relaunch spec, Section 3).
import {
  config,
  payoutUsdPerHour,
  projectPayoutPx,
  projectPayoutUsd,
  rePerHour,
  reForHours,
} from "@/app/_generated/config";

export { payoutUsdPerHour, projectPayoutPx, projectPayoutUsd, rePerHour, reForHours };

export const economy = config.economy;

export const TIERS = ["T1 Spark", "T2 Signal", "T3 Grid", "T4 Nexus"] as const;

export function clampTier(tier: unknown): number {
  const t = Math.trunc(Number(tier));
  return Number.isFinite(t) ? Math.min(Math.max(t, 1), TIERS.length) : 1;
}

export function clampHours(hours: unknown): number {
  const h = Number(hours);
  return Number.isFinite(h) ? Math.min(Math.max(h, 0), 100_000) : 0;
}

export interface PayoutStats {
  /** Pixels credited, rounded the way the page shows them. */
  px: number;
  /** RE this ship banks, rounded. */
  re: number;
  /** Average dollars per hour, or null for zero hours. */
  avgUsdPerHour: number | null;
}

/** The three numbers the calculator shows, same as the old page's writeStats(). */
export function payoutStats(hours: number, tier: number, reBefore = 0): PayoutStats {
  const usd = projectPayoutUsd(hours, tier, reBefore);
  return {
    px: Math.round(projectPayoutPx(hours, tier, reBefore)),
    re: Math.round(reForHours(hours, tier)),
    avgUsdPerHour: hours > 0 ? usd / hours : null,
  };
}
