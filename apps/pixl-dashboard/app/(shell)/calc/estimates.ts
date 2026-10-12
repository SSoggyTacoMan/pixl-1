// Payout estimates for the project editor and the shop, built on the
// test-pinned economy re-export in ./economy.ts (byte-identical to
// apps/server). Only imported from Server Components: the browser receives
// the resulting numbers (a rate, a px estimate), never the formulas.
import { economy, payoutUsdPerHour } from "./economy";

const finite = (n: unknown, fallback = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
};

/** The player's current $/hour rate, from their lifetime RE (wallet.re). */
export function usdPerHourFor(re: unknown): number {
  return payoutUsdPerHour(Math.max(finite(re), 0));
}

export interface ProjectEstimate {
  /** Hackatime + journal seconds currently on the project. */
  trackedSeconds: number;
  /** Hours already paid out on a prior approval (0 for a first ship). */
  approvedHours: number;
  /** Hours this ship would newly bank. */
  netHours: number;
  /** Rough pixels for netHours at the current rate. */
  px: number;
  usdPerHour: number;
}

/**
 * Same estimate the old page's estimatePayout() showed ("≈N PX EST." and
 * "Xh NEW"): net new hours at the player's flat current rate. Rough on
 * purpose (the review may deflate hours and the rate may ramp), and the UI
 * says so. null when nothing is tracked yet.
 */
export function projectEstimate(input: {
  htSeconds: unknown;
  journalSeconds: unknown;
  approvedHours: unknown;
  re: unknown;
}): ProjectEstimate | null {
  const trackedSeconds = Math.max(finite(input.htSeconds), 0) + Math.max(finite(input.journalSeconds), 0);
  if (trackedSeconds <= 0) return null;
  const approvedHours = Math.max(finite(input.approvedHours), 0);
  const netHours = Math.max(trackedSeconds / 3600 - approvedHours, 0);
  const usdPerHour = usdPerHourFor(input.re);
  return { trackedSeconds, approvedHours, netHours, px: Math.round((netHours * usdPerHour) / economy.pixelValueUsd), usdPerHour };
}

export interface EarnRates {
  /** Starting $/hour and the pixels that earns per hour. */
  loUsd: number;
  loPxPerHour: number;
  /** Top $/hour and its pixels per hour. */
  hiUsd: number;
  hiPxPerHour: number;
}

/** The shop's "Xh at $4/h → Yh at $6/h" hint rates (base and max payout). */
export function earnRates(): EarnRates {
  return {
    loUsd: economy.basePayoutUsd,
    loPxPerHour: economy.basePayoutUsd / economy.pixelValueUsd,
    hiUsd: economy.maxPayoutUsd,
    hiPxPerHour: economy.maxPayoutUsd / economy.pixelValueUsd,
  };
}
