// Shapes for GET /api/vault (apps/server/src/routes/vault.ts) plus the pure
// gauge math, kept separate so it can be unit tested.

export interface VaultReward {
  icon?: string;
  label?: string;
}

export interface TopReward {
  first: number;
  second: number;
  third: number;
}

export interface VaultWinner {
  rank: number;
  displayName: string;
  re: number;
}

export interface VaultLevel {
  level: number;
  title: string;
  blurb: string;
  energyRequired: number;
  rewards: VaultReward[];
  unlocked: boolean;
  topReward?: TopReward | null;
  winners?: VaultWinner[];
}

export interface VaultData {
  energy: number;
  pendingEnergy?: number;
  currentLevel: number;
  nextRequired: number | null;
  levels: VaultLevel[];
  chapterLeaderboard?: { displayName: string; re: number }[];
}

export const SEGMENTS = 28;

export const fmt = (n: number | null | undefined) => (n || 0).toLocaleString("en-US");

/** How many of the gauge's segments are lit (same math as the old vault page). */
export function filledSegments(data: Pick<VaultData, "energy" | "nextRequired" | "levels">): number {
  const next = data.nextRequired;
  if (!next) return SEGMENTS;
  const prev = data.levels.filter((l) => l.unlocked).reduce((m, l) => Math.max(m, l.energyRequired), 0);
  const span = Math.max(1, next - prev);
  return Math.round(Math.max(0, Math.min(1, ((data.energy || 0) - prev) / span)) * SEGMENTS);
}

export function hasTopReward(t: TopReward | null | undefined): t is TopReward {
  return !!t && !!(t.first || t.second || t.third);
}
