// Shop buy / trophy-claim error copy (ported from the old shop/item page),
// using the whitelisted numbers guardedAction copies out of the server body.
import type { ActionDetails } from "@/lib/guarded-action-core";
import { humanizeError } from "@/lib/errors";

const px = (n: number) => Math.round(n).toLocaleString("en-US");

const BUY_ERRORS: Record<string, string> = {
  insufficient: "Not enough pixels for that.",
  not_for_sale: "That one isn't for sale.",
  sold_out: "That option just sold out, pick another.",
  unavailable: "That item isn't available right now.",
  // 403 from buy: the item is gated behind a Beacon nomination or an
  // approved Trial project.
  locked: "That item is still locked for you. It unlocks with a Beacon nomination or an approved Trial project.",
  wrong_region: "That item doesn't ship to your region.",
  not_eligible: "Not yet, you haven't reached the XP for this trophy.",
};

export function shopError(code: string, details?: ActionDetails): string {
  const d = details ?? {};
  if (code === "insufficient" && d.price != null && d.balance != null) {
    return `Not enough pixels for that: it costs ${px(d.price)} and you have ${px(d.balance)}.`;
  }
  if (code === "not_eligible" && d.xp != null && d.need != null) {
    return `Not yet, you're at ${Math.floor(d.xp)} / ${d.need} XP.`;
  }
  if (code === "wrong_region" && d.region && d.itemRegion) {
    const mine = d.region.replaceAll("_", " ").toUpperCase();
    const theirs = d.itemRegion.replaceAll("_", " ").toUpperCase();
    return `This one is sold in ${theirs}, but your delivery address is in ${mine}. Switch your shop region to ${mine} (top of the shop) to buy it.`;
  }
  if (code === "wrong_region" && d.region) {
    return `That item doesn't ship to your region (${d.region.toUpperCase()}).`;
  }
  return BUY_ERRORS[code] ?? humanizeError(code);
}
