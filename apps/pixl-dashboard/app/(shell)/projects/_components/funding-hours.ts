// The funding-amount note under the hardware funding field. usdPerHour is
// the player's current rate, computed server side (calc/estimates.ts) and
// passed down as a number; this only divides the requested amount by it.
export function fundingHoursText(usd: number, usdPerHour: number | null | undefined): string {
  if (!(usd > 0) || !usdPerHour || !(usdPerHour > 0)) return "";
  const hours = usd / usdPerHour;
  return `~${hours.toFixed(1)}h shipped at your current rate ($${usdPerHour.toFixed(2)}/hr) covers this. Rate rises as you earn more Restoration Energy, so this is an estimate.`;
}
