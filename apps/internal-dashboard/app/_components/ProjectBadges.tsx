import type { ReactNode } from "react";
import { Badge as KitBadge, StatusBadge as KitStatusBadge, type Tone as KitTone } from "@/app/_ui/ui";

// Project badges shared by the review, project and player pages.

type Tone = "gray" | "green" | "amber" | "rose" | "blue" | "violet";

const TONE: Record<Tone, KitTone> = {
  gray: "neutral",
  green: "success",
  amber: "warning",
  rose: "danger",
  blue: "info",
  violet: "purple",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <KitBadge tone={TONE[tone]}>{children}</KitBadge>;
}

export const StatusBadge = KitStatusBadge;

const LEVEL_NAMES = ["Spark", "Signal", "Grid", "Nexus"];

export function LevelBadge({ level }: { level: number }) {
  const idx = Math.min(Math.max(Math.round(level) || 1, 1), 4);
  return (
    <KitBadge tone="info">
      T{idx} {LEVEL_NAMES[idx - 1]}
    </KitBadge>
  );
}

const TYPE_LABELS: Record<string, string> = {
  web: "Web playable",
  windows: "Windows",
  mac: "Mac",
  linux: "Linux",
  cross_platform: "Cross-platform",
  python: "Python",
  android: "Android",
  ios: "iOS",
  hardware: "Hardware",
  cad: "CAD models",
  other: "Other / not sure",
};

// The kind of thing the maker shipped, so a reviewer knows how to run/judge it.
export function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  return <KitBadge>{TYPE_LABELS[type] ?? type}</KitBadge>;
}

// Reviewer-nominated standout project. Cosmetic only, see toggleProjectPeak.
export function BeaconBadge() {
  return (
    <KitBadge tone="yellow" icon="rep">
      Beacon
    </KitBadge>
  );
}

// Hardware-only funding ask, set by the player via needs_funding. See the
// funding panel in review/[id]/page.tsx for the BOM / cart screenshot detail.
export function FundingBadge({ needsFunding, fundingUsd }: { needsFunding: boolean; fundingUsd?: number | null }) {
  if (!needsFunding) return null;
  return (
    <KitBadge tone="success">Funding: {fundingUsd ? `$${Number(fundingUsd).toFixed(2)}` : "requested"}</KitBadge>
  );
}

export function ShipBadges({ project }: { project: { is_update: boolean; used_ai: boolean; other_ysws: boolean } }) {
  return (
    <>
      {project.is_update && <KitBadge tone="info">Update</KitBadge>}
      {project.used_ai && <KitBadge tone="purple">AI used</KitBadge>}
      {project.other_ysws && <KitBadge tone="warning">Other YSWS disclosed</KitBadge>}
    </>
  );
}
