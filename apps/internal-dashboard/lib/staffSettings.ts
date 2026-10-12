// Per-staff dashboard preferences. This file is plain data and parsing so the
// client settings menu can import it; the DB read/write is in lib/db.ts.

export const THEMES = ["system", "dark", "light"] as const;
export const ACCENTS = ["red", "orange", "green", "cyan", "blue", "purple"] as const;

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

export interface StaffSettings {
  theme: Theme;
  accent: Accent;
  compact: boolean;
  /** Confetti and a sound after a review. Off unless someone turns it on. */
  confetti: boolean;
  /** Width in px of the review page's right column (see ReviewSplit). */
  reviewPanelWidth: number;
}

export const DEFAULT_STAFF_SETTINGS: StaffSettings = {
  theme: "system",
  accent: "red",
  compact: false,
  confetti: false,
  reviewPanelWidth: 460,
};

export const REVIEW_PANEL_MIN = 360;
export const REVIEW_PANEL_MAX = 1000;

export function clampReviewPanelWidth(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_STAFF_SETTINGS.reviewPanelWidth;
  return Math.min(REVIEW_PANEL_MAX, Math.max(REVIEW_PANEL_MIN, n));
}

// Anything unknown or malformed falls back to the default for that field, so a
// stored row can never put the dashboard in a state the CSS doesn't know.
export function parseStaffSettings(raw: unknown): StaffSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_STAFF_SETTINGS.theme,
    accent: ACCENTS.includes(r.accent as Accent) ? (r.accent as Accent) : DEFAULT_STAFF_SETTINGS.accent,
    compact: r.compact === true,
    confetti: r.confetti === true,
    reviewPanelWidth: clampReviewPanelWidth(r.reviewPanelWidth),
  };
}
