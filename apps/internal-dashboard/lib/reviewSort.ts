// The review queue's sort tabs, and the cookie that remembers the last one a
// reviewer picked so coming back from a review (or from the nav) doesn't reset
// it to Oldest. proxy.ts sets the cookie whenever /review is opened with a
// valid ?sort=; the queue page falls back to it when the URL has none.
export const REVIEW_SORTS = [
  { key: "oldest", label: "Oldest" },
  { key: "newest", label: "Newest" },
  { key: "hours", label: "Most hours" },
  { key: "hours_asc", label: "Fewest hours" },
  { key: "status", label: "Status" },
] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number]["key"];

export const REVIEW_SORT_COOKIE = "pixl_review_sort";

export function isReviewSort(value: string | null | undefined): value is ReviewSort {
  return REVIEW_SORTS.some((s) => s.key === value);
}

// The queue arrives longest-wait first, so "oldest" is the order as given.
// Ties on hours keep that order (Array.sort is stable), so equal-hours
// projects still show the longest waiter first.
export function sortQueueRows<T extends { hours: number; status: string }>(rows: T[], sort: string | undefined): T[] {
  switch (sort) {
    case "newest":
      return [...rows].reverse();
    case "hours":
      return [...rows].sort((a, b) => b.hours - a.hours);
    case "hours_asc":
      return [...rows].sort((a, b) => a.hours - b.hours);
    case "status":
      return [...rows].sort((a, b) => a.status.localeCompare(b.status));
    default:
      return rows;
  }
}

// Hours bounds typed into the queue's filter. Blank or junk means no bound.
export function parseHoursBound(value: string | null | undefined): number | null {
  const n = Number((value ?? "").trim().replace(",", "."));
  if (!(value ?? "").trim() || !Number.isFinite(n) || n < 0) return null;
  return n;
}

export function filterByHours<T extends { hours: number }>(rows: T[], min: number | null, max: number | null): T[] {
  return rows.filter((p) => (min === null || p.hours >= min) && (max === null || p.hours <= max));
}
