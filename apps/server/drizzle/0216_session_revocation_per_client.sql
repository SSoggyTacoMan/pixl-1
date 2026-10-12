-- Separate game and Pixl Dashboard sessions (hardened relaunch). Every
-- session JWT now carries a `client` claim ("game" or "web"), and revocation
-- is per (user, client):
--   sessions_revoked_at       (0181) - every session of the user, both
--                                      clients. Moderation (admin
--                                      revoke-sessions) keeps writing this.
--   game_sessions_revoked_at  (new)  - game sessions only: game logout.
--   web_sessions_revoked_at   (new)  - Pixl Dashboard sessions only: web
--                                      logout.
-- A token is rejected when its iat is at or before the later of
-- sessions_revoked_at and its own client's column. NULL means never revoked.
--
-- Apply BEFORE deploying the server that writes these. Until then the server
-- still honors sessions_revoked_at for both clients, but POST /auth/logout
-- answers 503 because it has nowhere to record a per-client logout.
-- Metadata-only change, no table rewrite. Run as the app role. Idempotent.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS game_sessions_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS web_sessions_revoked_at timestamptz;

COMMIT;
