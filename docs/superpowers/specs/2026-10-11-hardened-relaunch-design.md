# Hardened relaunch design

Date: 2026-10-11. Branch: `rewrite/hardened-relaunch`. Status: approved in chat (sections 1-5).

## Why

On 2026-10-11 a player got remote code execution on `server.pixl.hackclub.com`
through an SVG uploaded as `image/png` (sharp 0.35.4 / librsvg), dumped every
env var (all stored as plaintext on Orchard), and used `DATABASE_URL` to insert
themselves into `super_admins`. The RCE is fixed on main (`0a183ba7`). This
rewrite removes the structural reasons the incident got as far as it did:
apps that share tokens, a server that trusts any origin, per-route copy-pasted
auth, dev backdoors in production code, admin power grantable from inside the
dashboard, and no audit trail. Pixl holds thousands of teenagers' PII, so every
action must be guarded and logged.

## Section 1 - Apps and domains

| App | Folder | Domain | Talks to |
|---|---|---|---|
| Pixl Dashboard | `apps/pixl-dashboard` (was web-shell + landing + `apps/game/web`) | `pixl.hackclub.com` | server only |
| Pixl Internal Dashboard | `apps/internal-dashboard` (was `apps/dashboard`) | `dash.pixl.hackclub.com` | DB + server (moving it fully behind the server is a later project) |
| Server | `apps/server` | `server.pixl.hackclub.com` | DB |
| Pixo | `apps/pixorpheus` | none (Slack Socket Mode, in-cluster HTTP only) | DB, server, Slack |
| Game | `apps/game` | `play.pixl.hackclub.com` | server only |

Deleted: `apps/landing`, `apps/web-shell` (merged into Pixl Dashboard), and all
of `apps/game/web` (16k lines of hand-written HTML/JS/CSS). The game image
serves only the Godot export.

The game and Pixl Dashboard share nothing: no token, no localStorage, no
postMessage. The game opens plain `https://pixl.hackclub.com/<page>` URLs in a
new tab. Each app has its own login.

## Section 2 - Server guards

### Origins
`ALLOWED_ORIGINS = [config.urls.site, config.urls.play, config.urls.dash]`
(`https://pixl.hackclub.com`, `https://play.pixl.hackclub.com`,
`https://dash.pixl.hackclub.com`). No localhost, no env override.

- A request with an `Origin` header not in the list gets `403` and an
  `origin.rejected` audit row. CORS headers echo the origin only when allowed
  (`Vary: Origin`), `Access-Control-Allow-Headers: Content-Type, Authorization`,
  `Access-Control-Allow-Credentials` is not set (no cookies cross-origin).
- A request with no `Origin` is a server-to-server or non-browser call. It is
  allowed through the origin layer but still needs a user token or a service key
  (below). The Origin check is defense in depth; authentication is the guard.

### Service keys
Header `x-pixl-service-key`. Each caller has its own key, compared with
`timingSafeEqual`:

| Env var on server | Caller | May call |
|---|---|---|
| `SERVICE_KEY_PIXL_DASHBOARD` | Pixl Dashboard backend | `POST /auth/exchange` only |
| `SERVICE_KEY_INTERNAL_DASHBOARD` | Pixl Internal Dashboard | `/api/admin/*` |
| `SERVICE_KEY_PIXO` | Pixo | `/api/admin/*` routes Pixo already uses |

Replaces `ADMIN_API_KEY` / `x-admin-key` and `?key=` on admin routes. A request
whose service key doesn't match is `401` + `auth.service_key_rejected`.
(`EXTERNAL_API_KEY` stays: it authenticates the server's outbound calls to Pixo.)

### Authentication: deny by default
- One `requireSession` middleware mounted for all of `/api`. The token comes
  ONLY from `Authorization: Bearer <jwt>`. `?token=` is removed everywhere
  (HTTP and WS). Existing JWT format, 14-day expiry, revocation and ban checks
  are kept.
- Public routes are listed in one file, `apps/server/src/http/publicRoutes.ts`:
  `GET /`, `GET /health`, `/auth/*` (the OAuth endpoints themselves),
  `GET /hackatime/callback`, `GET /api/news`,
  `GET /api/journals/public/:projectId/:token`, `GET /api/shop/item/:id/public`,
  `GET /api/explore/players`, `GET /api/explore/players/:id/public`,
  `/api/forms/*`. Anything not on that list needs a session.
- `req.session` (`{ userId, displayName, slackId? }`) is the only identity a
  handler may use. Handlers never read identity from query, body or headers.

### Input validation
Every POST/PUT/PATCH/DELETE route validates `req.body` / `req.params` /
`req.query` with a zod schema before the handler runs (a small `validate()`
helper). JSON body limit 256kb (upload route keeps its own raw limit).

### Login without tokens in URLs
1. Client sends the browser to
   `GET /auth/hackclub?redirect=<url>&state=<opaque>`. `redirect` must be an
   absolute `https://` URL whose origin is `config.urls.site` or
   `config.urls.play`; anything else is `400`. `state` is echoed back untouched
   (clients bind it to a cookie / local nonce for CSRF protection).
2. Hack Club Auth -> `GET /auth/callback` -> the server creates a single-use
   code (32 random bytes, base64url, expires in 60 s, held in memory) and
   redirects to `<redirect>?code=<code>&state=<state>`.
3. The client exchanges it: `POST /auth/exchange` with JSON `{ code }` returns
   `{ token, user: { id, displayName, slackId }, isNew, needsLegalName }`.
   Pixl Dashboard calls it from its backend with `x-pixl-service-key`; the game
   calls it from `play.pixl.hackclub.com` (allowed origin). A code works once.
4. `POST /auth/logout` (Bearer) revokes the token.

The other redirect flows (`/auth/verify-address`, `/auth/resync`,
`/auth/legal-name`, Hackatime connect) start with a Bearer-authenticated
`POST` that returns the URL to navigate to, and return to a `redirect` checked
against the same allowlist. No flow puts a session token in a URL.

### Backdoors removed (code deleted, not just disabled)
`ALLOW_DEMO_LOGIN` and `/auth/demo`, `ALLOW_LOCAL_REDIRECT`,
`WEB_REDIRECT_HOSTS`, the `http://localhost:7777/callback` desktop fallback, any
other localhost / 127.0.0.1 URL in server code.

### WebSocket
`wss://server.pixl.hackclub.com/ws` with no query token. The upgrade is
rejected unless `Origin` is `config.urls.play`. The first message must be
`{ "type": "auth", "token": "<jwt>" }` within 5 s or the socket is closed with
code 4401. Same revocation/ban checks as HTTP.

### Audit log
Table `audit_log` (migration `0214_audit_log.sql`):

```sql
create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  app         text not null,          -- 'server' | 'internal-dashboard' | 'pixl-dashboard'
  actor_type  text not null,          -- 'player' | 'staff' | 'service' | 'anonymous'
  actor_id    text,                   -- users.id, or service name
  slack_id    text,
  action      text not null,          -- dotted verb, e.g. 'auth.login', 'shop.buy'
  target      text,                   -- e.g. 'project:123'
  result      text not null,          -- 'ok' | 'denied' | 'error'
  ip          text,
  user_agent  text,
  meta        jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_slack_idx on audit_log (slack_id, at desc);
create index audit_log_action_idx on audit_log (action, at desc);
```

`meta` never contains tokens, secrets, passwords or decrypted PII. Writes are
fire-and-forget (a failed audit insert is logged to stderr, never breaks the
request). The server logs: `auth.login`, `auth.login_failed`, `auth.exchange`,
`auth.logout`, `auth.session_rejected`, `auth.service_key_rejected`,
`origin.rejected`, `ratelimit.hit`, `upload.*`, every non-GET `/api` request
(`http.<method>` with route pattern as target), every admin/service call, WS
`ws.connect` / `ws.auth_failed`.

## Section 3 - Pixl Dashboard (`pixl.hackclub.com`)

Built from `apps/pixl-dashboard` (was web-shell). Next.js 16, React 19,
Tailwind 4, shadcn/radix, LEDGER tokens from `packages/theme`.

Routes:
- `/` landing (moved from `apps/landing`, 5 locales kept).
- Signed in (sidebar shell): `/dashboard`, `/projects`, `/projects/[id]`,
  `/shop`, `/shop/[id]`, `/orders`, `/quests`, `/trials`, `/account`,
  `/report`.
- Public: `/docs/[slug]`, `/form/[formKey]`.
- Auth: `/api/auth/login` (sets an httpOnly `pixl_login_state` cookie, redirects
  to the server), `/api/auth/callback` (checks `state` against the cookie,
  exchanges `code` with the service key, sets the session cookie),
  `/api/auth/logout` (revokes on the server, clears the cookie).
- Not ported yet (no route, not in the sidebar): explore, ideas, vault,
  timeline, calc, show-n-tell, collectibles, journals, refers.

Data flow:
- Session cookie `pixl_session`: httpOnly, Secure, SameSite=Lax, 14 days,
  verified on every request against the server's JWT (shared `JWT_SECRET`).
- Reads: Server Components call the server with `Authorization: Bearer` from
  the cookie. The browser never sees the token.
- Writes: Server Actions, each wrapped in one `guardedAction(schema, fn)` that
  requires a session, validates input with zod, calls one server endpoint,
  returns a typed result, and writes a `pixl-dashboard` audit row.
- The generic `/api/proxy/[...path]` forwarder is deleted.
- No economy formulas in the browser; pages display server-computed values.

## Section 4 - Pixl Internal Dashboard (`dash.pixl.hackclub.com`)

Roles:
| Role | Source | Can do |
|---|---|---|
| Owner | `ADMIN_SLACK_IDS` env only | everything, incl. managing reviewers/helpers/fulfillers |
| Reviewer | `admins` table, review perms only | review queue (+ `second_pass`, `review_hardware_only`, `review_software_only`, `edit_submission`, `no_review` markers) |
| Ticket helper | `helpers` table | tickets |
| Fulfiller | `fulfillers` table | fulfillment queue |

Removed: `super_admins`, `moderators`, `report_viewers` tables; every
non-review permission on `admins` rows; the Sponsor role (sponsors keep
review + second_pass); UI for granting super/sub-admin/moderator/viewer.
Reports and ban decisions are owner-only. Migration
`0215_owner_only_admins.sql` drops the tables and strips the perms (take a DB
backup before running it in prod).

Login gate: owner, reviewer, helper or fulfiller.

Guarding and logging: every exported server action goes through one
`guardedAction(requirement, fn)` wrapper that checks the role/permission and
writes an `audit_log` row (`app = 'internal-dashboard'`, Slack ID, action,
target, result, IP, user agent). Login, logout, failed login, access denied and
page views are logged. `team_log` writes move to `audit_log`.

Calls to the server use `x-pixl-service-key` (`SERVICE_KEY_INTERNAL_DASHBOARD`).

## Section 5 - Game, CI, rollout

Game:
- `web_pages.gd` only opens `https://pixl.hackclub.com/<page>` (allowlisted
  core paths, no query string) in a new tab (`noopener`). No token write, no
  postMessage, no `window.__pixlWeb`. `sign_out()` clears only the game session.
- HTTP calls send `Authorization: Bearer`; WS authenticates with the first
  message; login uses the code flow (`redirect` = the play origin, `state` = a
  local nonce, then `POST /auth/exchange`).
- Desktop localhost login is removed. Web is the supported platform.
- Docker / `serve.ts` serve only the Godot export.

CI and dependencies:
- GitHub Actions on every PR and push: install, typecheck, tests, `osv-scanner`
  (fails on high/critical).
- Dependabot: weekly version updates per workspace `package.json`, Dockerfiles,
  GitHub Actions; security updates as they come.
- All deps to latest patch/minor now; majors later.

Rollout: everything stays offline. Build on the branch, verify locally against a
DB copy (never prod), owner reviews and merges, then on Orchard: DB backup ->
migrations -> new `pixl-dashboard` deployment takes `pixl.hackclub.com` ->
delete `landing` and `web-shell` deployments -> all env vars secret -> start ->
smoke test -> lift the Cloudflare block.

Later (separate specs): remaining player pages, Internal Dashboard behind the
server, major dependency upgrades, wider cleanup. (The standalone DM relay
was folded into Pixo's `POST /api/external/dm` on this branch.)
