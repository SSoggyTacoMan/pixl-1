// Per-staff dashboard preferences. This file is plain data and parsing so the
// client settings menu can import it; the DB read/write is in lib/db.ts.

export const THEMES = [
  "system",
  "dark",
  "light",
  "jetbrains",
  "cursor",
  "tokyo-night",
  "dracula",
  "catppuccin",
  "nord",
  "gruvbox",
  "one-dark",
  "rose-pine",
  "solarized-light",
] as const;
// "theme" uses the selected theme's own accent (red for System/Dark/Light).
export const ACCENTS = ["theme", "red", "orange", "green", "cyan", "blue", "purple"] as const;

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

export interface StaffSettings {
  theme: Theme;
  accent: Accent;
  compact: boolean;
  /** Confetti after a review. Off unless someone turns it on. */
  confetti: boolean;
  /** The short sound after a review. On unless someone turns it off. */
  sound: boolean;
  /** Width in px of the review page's right column (see ReviewSplit). */
  reviewPanelWidth: number;
}

// What the settings page shows for each theme. The colours themselves live in
// app/_ui/themes.css; `preview` is only the little card in the picker.
export const THEME_INFO: Record<
  Theme,
  { label: string; note: string; preview: { bg: string; surface: string; text: string; primary: string } }
> = {
  system: {
    label: "System",
    note: "Follows your OS light/dark setting",
    preview: { bg: "#131418", surface: "#f9fafc", text: "#8492a6", primary: "#ec3750" },
  },
  dark: { label: "Dark", note: "Hack Club dark", preview: { bg: "#131418", surface: "#17171d", text: "#f4f4f6", primary: "#ec3750" } },
  light: { label: "Light", note: "Hack Club light", preview: { bg: "#f9fafc", surface: "#ffffff", text: "#1f2d3d", primary: "#ec3750" } },
  jetbrains: { label: "JetBrains", note: "IntelliJ New UI dark", preview: { bg: "#1e1f22", surface: "#2b2d30", text: "#dfe1e5", primary: "#3574f0" } },
  cursor: { label: "Cursor", note: "Cursor dark", preview: { bg: "#141414", surface: "#1c1c1c", text: "#e4e4e4", primary: "#3c9cfc" } },
  "tokyo-night": { label: "Tokyo Night", note: "Night variant", preview: { bg: "#1a1b26", surface: "#1f2335", text: "#c0caf5", primary: "#7aa2f7" } },
  dracula: { label: "Dracula", note: "Classic purple", preview: { bg: "#282a36", surface: "#303241", text: "#f8f8f2", primary: "#bd93f9" } },
  catppuccin: { label: "Catppuccin", note: "Mocha", preview: { bg: "#181825", surface: "#1e1e2e", text: "#cdd6f4", primary: "#cba6f7" } },
  nord: { label: "Nord", note: "Arctic blue", preview: { bg: "#2e3440", surface: "#3b4252", text: "#eceff4", primary: "#88c0d0" } },
  gruvbox: { label: "Gruvbox", note: "Retro dark", preview: { bg: "#282828", surface: "#32302f", text: "#ebdbb2", primary: "#fe8019" } },
  "one-dark": { label: "One Dark", note: "Atom One Dark", preview: { bg: "#21252b", surface: "#282c34", text: "#d7dae0", primary: "#61afef" } },
  "rose-pine": { label: "Rosé Pine", note: "Main", preview: { bg: "#191724", surface: "#1f1d2e", text: "#e0def4", primary: "#ebbcba" } },
  "solarized-light": {
    label: "Solarized Light",
    note: "Warm light",
    preview: { bg: "#fdf6e3", surface: "#fffdf6", text: "#073642", primary: "#268bd2" },
  },
};

export const DEFAULT_STAFF_SETTINGS: StaffSettings = {
  theme: "system",
  accent: "theme",
  compact: false,
  confetti: false,
  sound: true,
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
    sound: r.sound !== false,
    reviewPanelWidth: clampReviewPanelWidth(r.reviewPanelWidth),
  };
}
