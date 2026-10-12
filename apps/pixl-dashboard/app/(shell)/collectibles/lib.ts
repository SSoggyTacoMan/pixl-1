export interface CollectibleItem {
  id: number | string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  cost: number;
  owned: boolean;
}

export interface CollectiblesResponse {
  balance?: number;
  collectibles?: CollectibleItem[];
}

/** Width of the progress bar toward a collectible, 0-100. */
export function progressPct(balance: number, cost: number, owned: boolean): number {
  if (owned) return 100;
  const b = Math.max(0, Number(balance) || 0);
  const c = Math.max(1, Number(cost) || 0);
  return Math.max(0, Math.min(100, (b / c) * 100));
}
