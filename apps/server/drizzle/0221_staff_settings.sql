-- Per-staff internal dashboard preferences (theme, accent color, compact mode,
-- confetti). One row per Slack id, so they follow the person across browsers.
-- Cosmetic only: nothing here grants or changes a permission.
CREATE TABLE IF NOT EXISTS staff_settings (
  slack_id text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
