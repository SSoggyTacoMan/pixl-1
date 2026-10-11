import { Badge } from "@/components/ui/primitives";
import type { BlackoutEntry } from "../types";

export const BLACKOUT_CHIPS: Record<string, [string, "gold" | "green" | "red"]> = {
  entered: ["BLACKOUT: ENTERED", "gold"],
  shipped: ["BLACKOUT: SHIPPED", "gold"],
  awaiting_review: ["BLACKOUT: IN REVIEW", "gold"],
  eligible: ["BLACKOUT: ELIGIBLE", "green"],
  ineligible: ["BLACKOUT: NOT ELIGIBLE", "red"],
  approved: ["BLACKOUT: APPROVED", "green"],
  needs_changes: ["BLACKOUT: FIX WINDOW", "gold"],
};

export function BlackoutChip({ entry }: { entry?: BlackoutEntry }) {
  const c = entry && BLACKOUT_CHIPS[entry.label];
  return c ? <Badge tone={c[1]}>{c[0]}</Badge> : null;
}
