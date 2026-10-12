# pixl-server

Backend server for **Pixl**, a multiplayer 2D game (the client is built in Godot).

`pixl-server` powers authentication, realtime multiplayer, social features, and coding-time integrations over HTTP and WebSockets. It is written in TypeScript, runs on Node.js as an ESM application, and uses Postgres (on Orchard) for persistence.

## Features

- **Authentication** - Hack Club OAuth with a single-use code exchange (no tokens in URLs), Bearer-only sessions, deny-by-default routing, per-caller service keys, and an `audit_log` trail.
- **Realtime multiplayer** - movement, chat, proximity voice, emotes, and presence over WebSockets.
- **Instanced lobbies** - in-memory and persisted lobby management with shared rooms and private password-protected lobbies.
- **Scene system** - village, openworld, and house scenes with per-scene persisted player and NPC positions.
- **Friends & DMs** - friend requests, friend pairs, player search, and direct messaging.
- **Projects** - per-user projects linked to Hackatime coding-time tracking.
- **Notifications** - a per-user inbox plus admin broadcast messaging.
- **Moderation** - profanity filtering, a violation log, and bans with a periodic ban-sweep that kicks players banned mid-session.

## Tech Stack

- **Language:** TypeScript (ESM) on Node.js
- **HTTP:** [Express 4](https://expressjs.com/)
- **Realtime:** [`ws`](https://github.com/websockets/ws) WebSocket server
- **Data:** Postgres on Orchard via [`postgres`](https://github.com/porsager/postgres) (postgres.js), behind the chainable query builder in `src/db/pgCompat.ts`
- **Dev runtime:** [`tsx`](https://github.com/privatenumber/tsx) for watch/dev; `tsc` build to `dist/`, run with `node`
- **Package managers:** works with npm or Bun (both lockfiles are present)

## Project Structure

```
src/
├── index.ts                 # Entry point (Express + WS bootstrap)
├── auth/session.ts          # JWT session issue/verify
├── auth/revocation.ts       # Per-user session revocation (HTTP middleware + helpers)
├── db/client.ts             # Postgres query builder export + row types
├── social.ts                # Friend-pair helpers
├── moderation.ts            # Profanity filter, violation log, ban checks
├── hackatime/api.ts         # Hackatime API client
├── ws/
│   ├── gameServer.ts        # WebSocket realtime game server
│   └── lobbies.ts           # In-memory + persisted lobby management
└── routes/
    ├── auth.ts              # Hack Club OAuth login, code exchange, logout, re-auth flows
    ├── hackatime.ts         # Hackatime OAuth connect + stats
    ├── projects.ts          # CRUD for user projects
    ├── notifications.ts     # User inbox + admin broadcast
    ├── profile.ts           # Display-name change (profanity-guarded)
    └── friends.ts           # Friends, requests, player search, profiles
```

## Getting Started

### Prerequisites

- Node.js (with npm) or [Bun](https://bun.sh/)
- A Postgres database (`DATABASE_URL`)

### Install

Using npm:

```bash
npm install
```

Using Bun:

```bash
bun install
```

### Configure environment

Copy the example environment file and fill in the values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) for the full list.

### Run

Development (watch mode):

```bash
npm run dev
```

Build and run in production:

```bash
npm run build
npm start
```

The server listens on `PORT` (default `3000`).

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `JWT_SECRET` | Signing secret for session tokens | - |
| `HCA_CLIENT_ID` | Hack Club OAuth client ID | - |
| `HCA_CLIENT_SECRET` | Hack Club OAuth client secret | - |
| `HCA_REDIRECT_URI` | Hack Club OAuth redirect URI | `https://server.pixl.hackclub.com/auth/hackclub/callback` |
| `HACKATIME_BASE` | Hackatime API base URL | - |
| `HACKATIME_CLIENT_ID` | Hackatime OAuth client ID | - |
| `HACKATIME_CLIENT_SECRET` | Hackatime OAuth client secret | - |
| `HACKATIME_REDIRECT_URI` | Hackatime OAuth redirect URI | `<config.urls.server>/hackatime/callback` |
| `HACKATIME_SCOPES` | Hackatime OAuth scopes | - |
| `SERVICE_KEY_PIXL_DASHBOARD` | `x-pixl-service-key` for the Pixl Dashboard backend; may only call `POST /auth/exchange` (min 32 chars) | - |
| `SERVICE_KEY_INTERNAL_DASHBOARD` | `x-pixl-service-key` for the Internal Dashboard; may call `/api/admin/*` (min 32 chars) | - |
| `SERVICE_KEY_PIXO` | `x-pixl-service-key` for Pixo; may call only the `/api/admin/*` routes listed in `PIXO_ADMIN_ROUTES` (currently none) | - |
| `EXTERNAL_API_KEY` | Shared key used to authenticate server-to-Pixorpheus requests | - |
| `PIXORPHEUS_URL` | Base URL for Pixorpheus; enrolls Slack-linked players in `#pixl` after Hack Club login | - |
| `DATABASE_URL` | Postgres connection string, used at runtime and by the Drizzle tooling | - |
| `PORT` | Port the server listens on | `3000` |

## HTTP API

### Meta

- `GET /` → `{ name, status }`
- `GET /health` → `{ ok: true }`

### Guards

- Origins: only `config.urls.site`, `config.urls.play` and `config.urls.dash` get CORS; any other `Origin` is a 403 (`origin.rejected`). No `Origin` (server-to-server) passes this layer but still has to authenticate.
- Sessions: `Authorization: Bearer <jwt>` only. `?token=` is refused everywhere (400 `token_in_query`). Every route not listed in `src/http/publicRoutes.ts` needs a session; revocation and active-ban checks run on every authenticated request.
- Service keys: `/api/admin/*` answers only to `x-pixl-service-key` (see the env table).
- Writes: every POST/PUT/PATCH/DELETE body/params/query is validated with zod (`src/http/validate.ts`); JSON bodies are capped at 256kb.
- Audit: `src/audit.ts` writes `audit_log` rows (`drizzle/0214_audit_log.sql`) for logins, exchanges, logouts, rejected sessions/keys/origins, rate-limit hits, uploads, every non-GET `/api` request and every service call.

### Authentication

- `GET /auth/hackclub?redirect=<https url on site or play>&state=<opaque>` - begin Hack Club OAuth. Any other redirect is a 400.
- `GET /auth/hackclub/callback` - Hack Club OAuth callback; blocks banned users, asks Pixorpheus to add the linked Slack user to `#pixl`, then redirects to `<redirect>?code=<single-use, 60s>&state=<state>`.
- `POST /auth/exchange` `{ code }` → `{ ok, token, user: { id, displayName, slackId }, isNew, needsLegalName }`. Allowed with `x-pixl-service-key: SERVICE_KEY_PIXL_DASHBOARD`, or from `Origin: config.urls.play` with no key.
- `POST /auth/logout` (Bearer) - revokes the player's sessions.
- `POST /auth/flow/:name` (Bearer) `{ redirect }` → `{ ok, url }`, name is `verify-address` (back with `?addr_verified=1|0`), `resync` (`?hca_synced=<outcome>`) or `legal-name` (`?legal_name=saved|missing`).

### Hackatime

- `POST /api/hackatime/connect` (Bearer) `{ redirect }` → `{ ok, url }`; ends on `<redirect>?hackatime=connected|failed`
- `GET /hackatime/callback`
- `GET /api/hackatime/stats`

### Projects

- `GET /api/projects[/:id]`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

### Notifications

- `POST /api/admin/notifications` - service send (`x-pixl-service-key`); supports per-user or broadcast
- `GET /api/notifications` - user inbox
- `POST /api/notifications/read` - mark as read

### Session revocation

- `POST /api/admin/revoke-sessions` - header `x-pixl-service-key: <SERVICE_KEY_INTERNAL_DASHBOARD>`, body `{ "userId": "<uuid>" }`. Invalidates every session token issued to that user up to now, on HTTP and WebSocket, and closes their live socket. Other users stay signed in and the user can sign in again right away. Answers 503 until `drizzle/0181_session_revocation.sql` is applied.
- Stored as `users.sessions_revoked_at`. A token is rejected when its `iat` is at or before that second, so a login in the same second as the revocation has to be repeated once. Other replicas pick it up within 10s on HTTP (cache TTL) and within 30s for sockets that are already open (sweep); new socket connections check the database directly.
- Deploy order: apply `0181_session_revocation.sql` first (as the app role, it is idempotent and metadata-only), then deploy the server. A server running against a database without the column keeps working and simply revokes nothing.
- Without the API, revoke by hand: `update users set sessions_revoked_at = now() where id = '<uuid>';`

### Profile

- `POST /api/profile/name` - change display name (profanity-guarded)

### Friends & Players

- `GET /api/friends`
- `POST /api/friends/request`
- `POST /api/friends/accept`
- `POST /api/friends/remove`
- `GET /api/players/search?q=`
- `GET /api/players/profile?userId=`

## WebSocket API

Connect at:

```
wss://server.pixl.hackclub.com/ws
```

The upgrade is refused unless `Origin` is `config.urls.play`. The first frame must be `{"type":"auth","token":"<jwt>"}` within 5 s; the server sends nothing before it succeeds, and closes with `4401` when it is missing, malformed, invalid, expired or revoked (`4003` when banned).

### Inbound message types

`move`, `change_scene`, `set_skin`, `chat`, `dm`, `emote`, `lobby_list`, `lobby_create`, `lobby_join`, `lobby_quick_join`, `lobby_join_friend`, `lobby_manage`, `save_npcs`.

Binary frames are relayed as proximity voice.

### Server-emitted message types

`init`, `player_joined`, `player_moved`, `player_left`, `player_skin`, `chat`, `dm`, `emote`, `npc_init`, `lobby_joined`, `lobby_denied`, `lobby_closed`, `lobby_list`.

### Notes

- `village` is a private per-player room (`village:<userId>`).
- Lobbies are shared rooms (`lobby:<CODE>`), capped at 16 players per lobby, with a maximum of 200 lobbies. Private lobbies use a random 8-character password (legacy weaker ones are replaced when lobbies load); wrong guesses are limited to 10/min per account and 30/min per source IP, and a correct password never counts against either.
- Player positions are persisted per `(user, scene)` every 5 seconds.

## Database

Persistence is Postgres on Orchard. Runtime queries go through the postgres.js-backed query builder in `src/db/pgCompat.ts` (no ORM at runtime).

Tables referenced:

- `users`
- `player_state`
- `npc_state`
- `projects`
- `notifications`
- `friends`
- `bans`
- `violations`
- `lobbies`

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `tsx watch src/index.ts` | Run the server in watch mode |
| `build` | `tsc -p tsconfig.json` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run the compiled server |
| `db:generate` | `drizzle-kit generate` | Generate Drizzle migrations |
| `db:migrate` | `drizzle-kit migrate` | Apply Drizzle migrations |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio |

## Notes / Known Limitations

- Drizzle tooling (`drizzle-orm` / `drizzle-kit`, `drizzle.config.ts`, and the `db:*` scripts) is scaffolded and points at `./src/db/schema.ts`, but that schema file does not exist yet. As a result the migration tooling is **not functional as-is**. Authoring `src/db/schema.ts` is a planned follow-up; until then, runtime persistence relies entirely on the pgCompat query builder.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Pixl.
