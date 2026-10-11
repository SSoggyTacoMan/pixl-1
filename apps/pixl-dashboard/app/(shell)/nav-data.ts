// Sidebar structure. Only the core pages of the hardened relaunch plus docs;
// explore, ideas, vault, timeline, calc, show-n-tell, collectibles, journals,
// refers and the hackatime page are intentionally not ported (no route, not
// in nav) - see docs/superpowers/specs/2026-10-11-hardened-relaunch-design.md.
export interface NavLink {
  slug: string;
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  items: NavLink[];
}

const link = (slug: string, label: string, href = `/${slug}`): NavLink => ({ slug, label, href });

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "PLAY",
    items: [
      link("dashboard", "OVERVIEW"),
      link("projects", "PROJECTS"),
      link("quests", "QUESTS"),
      link("trials", "TRIALS"),
      link("docs", "DOCS", "/docs"),
    ],
  },
  {
    label: "ECONOMY",
    items: [link("shop", "SHOP"), link("orders", "ORDERS")],
  },
  {
    label: "YOU",
    items: [link("report", "REPORT"), link("account", "ACCOUNT")],
  },
];

/** What the mobile dock shows without opening the MORE sheet. */
export const MOBILE_PRIMARY = ["dashboard", "projects", "shop", "account"];

// Whole-pixel rects on a 16x16 grid: [x, y, width, height]. Rendered as React
// <rect> elements (components/pixel-icon.tsx), no HTML strings.
export type Rect = readonly [number, number, number, number];

export const ICONS: Record<string, readonly Rect[]> = {
  dashboard: [[7, 1, 2, 2], [5, 3, 6, 2], [3, 5, 10, 2], [3, 7, 3, 7], [10, 7, 3, 7], [6, 7, 4, 2]],
  docs: [[2, 4, 5, 8], [9, 4, 5, 8], [2, 12, 12, 2]],
  shop: [[5, 1, 6, 2], [5, 3, 2, 2], [9, 3, 2, 2], [3, 5, 10, 9]],
  orders: [[3, 2, 10, 2], [3, 12, 10, 2], [3, 2, 2, 12], [11, 2, 2, 12], [6, 6, 4, 2], [6, 9, 4, 2]],
  projects: [[2, 3, 12, 2], [2, 5, 2, 8], [12, 5, 2, 8], [2, 11, 12, 2]],
  report: [[3, 2, 2, 12], [5, 3, 8, 6]],
  account: [[5, 2, 6, 5], [3, 9, 10, 5]],
  trials: [[2, 3, 12, 2], [2, 11, 12, 2], [2, 3, 2, 10], [12, 3, 2, 10], [7, 5, 2, 1], [7, 7, 2, 1], [7, 9, 2, 1]],
  quests: [[4, 3, 8, 2], [2, 5, 12, 2], [4, 7, 8, 2], [6, 9, 4, 2], [7, 11, 2, 2]],
};

export const MORE_ICON: readonly Rect[] = [
  [2, 2, 3, 3], [7, 2, 3, 3], [12, 2, 2, 3], [2, 7, 3, 3], [7, 7, 3, 3], [12, 7, 2, 3], [2, 12, 3, 2], [7, 12, 3, 2], [12, 12, 2, 2],
];
export const PALETTE_ICON: readonly Rect[] = [
  [4, 2, 8, 2], [2, 4, 2, 7], [12, 4, 2, 6], [4, 11, 7, 2], [10, 10, 2, 2], [5, 5, 2, 2], [9, 5, 2, 2], [5, 8, 2, 2],
];
