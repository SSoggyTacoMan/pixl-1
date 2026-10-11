// Formats the shop's "Xh at $4/h -> Yh at $6/h" hint. The per-hour rates
// arrive precomputed from the Server Component (calc/estimates.ts
// earnRates()); this only divides a price by them for display.
import type { EarnRates } from "../calc/estimates";

function fmtHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
const fmtRate = (usd: number) => "$" + (Number.isInteger(usd) ? usd : usd.toFixed(2));

export function hoursHint(px: number, rates: EarnRates | null | undefined): string {
  if (!rates || !(px > 0) || !(rates.loPxPerHour > 0) || !(rates.hiPxPerHour > 0)) return "";
  return `${fmtHours(px / rates.loPxPerHour)}h at ${fmtRate(rates.loUsd)}/h → ${fmtHours(px / rates.hiPxPerHour)}h at ${fmtRate(rates.hiUsd)}/h`;
}
