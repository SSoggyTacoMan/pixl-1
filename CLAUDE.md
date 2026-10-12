# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Pixl is a Bun/Turborepo monorepo (`bun` workspaces: `apps/*`, `packages/*`) for a Hack Club YSWS ("You Ship, We Ship") pixel-art multiplayer game. It holds thousands of teenagers' personal data: guard every action, log every action, never trust the client.

| App | Stack | Domain | Purpose |
|---|---|---|---|
| `apps/server` | Bun, Express, `ws`, Postgres (Orchard) | `server.pixl.hackclub.com` | The orchestrator - auth, player state, WebSocket game loop, projects, shop, economy. The only API the game and Pixl Dashboard talk to. |
| `apps/pixl-dashboard` | Next.js 16, React 19, Tailwind 4, shadcn/radix | `pixl.hackclub.com` | **Pixl Dashboard** - landing page (5 locales), signed-in player pages, docs, public forms and shared journals. |
| `apps/internal-dashboard` | Next.js 16, React 19, Tailwind 4, shadcn/radix | `dash.pixl.hackclub.com` | **Pixl Internal Dashboard** - review queue, moderation, shop/fulfillment, tickets, stats. Still talks to Postgres directly (moving it behind the server is planned). |
| `apps/game` | Godot 4 | `play.pixl.hackclub.com` | The 2D multiplayer client. Serves only the Godot web export. |
| `apps/pixorpheus` | Bun, TypeScript, Slack Bolt v4 | none (Slack Socket Mode; in-cluster HTTP only) | Pixo, the Slack bot - tickets, AI chat, moderation DMs, slash commands |
| `packages/config` | JSON + plain ESM | | **Single source of truth** for program facts - name, launch date, Hackatime cutoff, canonical URLs, economy rates. |
| `packages/theme` | JSON + plain ESM | | **Single source of truth** for the LEDGER color palette. |
| `packages/docs-engine` | Bun/TypeScript | | Renders `docs/*.md` for Pixl Dashboard and builds OG preview cards. |
| `packages/map-sync` | Bun/TypeScript | | Copies the game's baked world-map PNGs into the internal dashboard for the NPC spot-picker. |

Everything deploys on Orchard (Kubernetes). Every env var on Orchard must be stored with `secret: true`.

### Boundaries (do not break these)

- **The game and Pixl Dashboard share nothing.** No token handoff, no localStorage, no postMessage. The game only opens plain `https://pixl.hackclub.com/<page>` URLs from an allowlist in `apps/game/scripts/web_pages.gd`. Each app has its own login.
- **The server only accepts browser requests from** `config.urls.site`, `config.urls.play` and `config.urls.dash` (`apps/server/src/http/origins.ts`). No localhost, no env override, no dev bypasses (the `ALLOW_*` flags were deleted on purpose - don't reintroduce them).
- **Tokens never go in URLs.** Session tokens travel only in `Authorization: Bearer`; `?token=` is rejected. Login returns a single-use 60 s code that the client exchanges (`POST /auth/exchange`).
- **Deny by default.** Every `/api` route needs a session unless it is listed in `apps/server/src/http/publicRoutes.ts`. Handlers read identity only from `req.session`, never from query, body or headers.
- **Service-to-service calls** use `x-pixl-service-key`, one key per caller (`SERVICE_KEY_PIXL_DASHBOARD`, `SERVICE_KEY_INTERNAL_DASHBOARD`, `SERVICE_KEY_PIXO`), see `apps/server/src/http/serviceKeys.ts`.
- **Admin power comes only from env.** Internal-dashboard owners are `ADMIN_SLACK_IDS`; the only table-backed roles are reviewers (`admins` rows, review permissions only), ticket helpers (`helpers`) and fulfillers (`fulfillers`). There are no super admins, sub-admins, moderators or report viewers - don't add a way to grant power from inside the app.
- **Audit everything** into the `audit_log` table (migration `0214`): the server through `src/audit.ts`, the internal dashboard through `guardedAction` / `guardedRoute` in `lib/guard.ts`. Never put tokens, secrets or decrypted PII in `meta`.
- **Every mutation is guarded.** Internal dashboard: every `'use server'` export is a `guardedAction(name, requirement, fn)` (a test enforces it). Pixl Dashboard: every mutation is a Server Action through `guardedAction(name, schema, handler)` that validates with zod and calls exactly one server endpoint. Server: every write route has a zod schema via `validate()`.
- **Untrusted uploads**: images are checked by magic bytes (PNG/JPEG/WebP only) before they reach `sharp` (`apps/server/src/imageValidation.ts`, `apps/internal-dashboard/lib/imageSniff.ts`). The Oct 2026 incident was an SVG labelled `image/png` reaching librsvg.

See `docs/superpowers/specs/2026-10-11-hardened-relaunch-design.md` for the full design and the reasons behind it.

## Commands

Run from the repo root unless noted. This repo uses Bun - see the Bun-specific guidance below.

```bash
bun install                                  # install all workspaces

bun run dev                                  # run all apps' dev servers concurrently
bun run pixl-dashboard                       # turbo dev --filter=@pixl/pixl-dashboard
bun run internal-dashboard                   # turbo dev --filter=@pixl/internal-dashboard
bun run build                                # turbo build (all apps)
bun run config:sync                          # regenerate committed config copies (packages/config)
bun run theme:sync                           # regenerate committed theme/palette copies (packages/theme)
bun run docs:build                           # regenerate doc OG cards (packages/docs-engine)
bun run previews:build                       # regenerate OG cards for hand-authored Pixl Dashboard pages
bun run map:sync                             # copy the game's baked world-map PNGs into the internal dashboard
bun run npcs:bake                            # bun run apps/server/src/scripts/bake-npcs.ts

bun run --cwd apps/server dev                # game server, tsx watch on src/index.ts
bun run --cwd apps/server build              # tsc build to dist/
bun run --cwd apps/server test               # bun test (*.db.test.ts need PIXL_TEST_DATABASE_URL)

bun run --cwd apps/pixl-dashboard dev        # next dev -p 4901
bun run --cwd apps/pixl-dashboard typecheck  # tsc --noEmit
bun run --cwd apps/pixl-dashboard test       # bun test

bun run --cwd apps/internal-dashboard dev        # next dev -p 4900
bun run --cwd apps/internal-dashboard typecheck  # tsc --noEmit
bun run --cwd apps/internal-dashboard test       # bun test

bun run --cwd apps/pixorpheus start          # Slack bot, Bun-native, no build step
bun run --cwd apps/pixorpheus typecheck      # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) typechecks and tests the server, both dashboards and Pixo against a throwaway Postgres, checks the standalone Docker lockfiles are in sync, and runs `osv-scanner`. Dependabot (`.github/dependabot.yml`) opens weekly grouped updates.

`apps/server` and `apps/internal-dashboard` build in Docker from their own folder with `bun install --frozen-lockfile` against their **own** `bun.lock`. When you change their dependencies, update that standalone lockfile too (copy `package.json` + `bun.lock` to a temp dir, `bun install`, verify `--frozen-lockfile`, copy back) - updating only the root `bun.lock` ships the old versions.

### Environment

Each app has its own `.env` (see each `.env.example`). Bun auto-loads `.env` - don't add `dotenv` to Bun-run apps (`apps/server` still imports `dotenv/config` in some files; follow existing conventions there). Nothing has a localhost default; URLs come from `packages/config`.

### `packages/config` (shared program facts)

Never hardcode the launch date, the Hackatime cutoff, a pixl.hackclub.com URL or the economy rates in an app - they live in `packages/config/pixl.json`.

- Nothing imports `@pixl/config` at runtime - each app builds from its own root, so every consumer reads a **generated, git-committed copy** produced by `bun run config:sync`. Never hand-edit the generated files.
- **TS apps**: `server`/`pixorpheus` import `../config.generated.js` (the `.js` extension is required, they run as ESM); the two dashboards import `app/_generated/config`.
- **Godot** (`apps/game/scripts/pixl_config.gd`) reads the generated `apps/game/pixl.json`.
- Dates are ISO-8601 **UTC**. Format them with `timeZone: "UTC"`.

Launch-state copy (Pixo's persona/FAQ, the Slack welcome messages) switches itself via `hasLaunched()`.

### `packages/theme` (LEDGER palette)

`palette.json` is the one place the palette lives. Run `bun run theme:sync` after editing it; it rewrites `apps/game/theme.json` and the marker blocks in `apps/pixl-dashboard/app/globals.css` (both generated, never hand-edit). `godot.light` doesn't exist yet.

### `packages/docs-engine` (docs)

Pixl Dashboard renders `docs/*.md` through this package's `render()`/`buildTokens()` (a workspace import - the Pixl Dashboard Dockerfile uses a repo-root build context so it resolves). `bun run docs:build` writes OG cards. Source files are `<order>-<slug>.md`; `{{token}}` placeholders come from `pixl.json`, and unknown tokens fail the build.

### `packages/map-sync`

`bun run map:sync` copies the game's baked world-map PNGs into `apps/internal-dashboard` for the NPC spot pickers. Re-run after re-baking a world map.

## Architecture notes

### `apps/server`
- Entry point `src/index.ts`; routes under `src/routes/*`. The request pipeline is in `src/http/`: `origins.ts` (CORS allowlist), `gate.ts` / `requireSession.ts` / `bearer.ts` (deny-by-default auth), `publicRoutes.ts`, `serviceKeys.ts`, `validate.ts` (zod), `clientKey.ts` (rate-limit keys).
- `routes/auth.ts`: `GET /auth/hackclub?redirect=&state=` -> Hack Club Auth -> single-use code (`src/auth/loginCodes.ts`) -> `POST /auth/exchange`; `POST /auth/logout`; `POST /auth/flow/:name` (`verify-address`, `resync`, `legal-name`); `POST /api/hackatime/connect`. Logout currently revokes all of a user's sessions (game and web).
- `forms` backs public, no-account application forms verified by Slack ID; questions are editable from the internal dashboard.
- Real-time game state: `src/ws/gameServer.ts` and `src/ws/lobbies.ts`. The WS only accepts the play origin; the first frame must be `{"type":"auth","token":...}` within 5 s or it closes with 4401, and nothing is sent before auth.
- `src/auth/session.ts` issues and validates JWT sessions (`JWT_SECRET`, 14 days). `src/audit.ts` writes `audit_log`.
- Migrations live in `apps/server/drizzle/` as sequentially numbered raw SQL files. Multiple contributors push migrations concurrently (numbers have collided before), so check the current highest number right before adding one.
- Cross-cutting: `src/xp.ts` (leveling), `src/moderation.ts` / `src/imageModeration.ts`, `src/rateLimit.ts`, `src/hackatime/api.ts`, `src/shipsArchive.ts`, `src/ysws/doubleDip.ts`, `src/imageValidation.ts`.

### `apps/game` (Godot client)
- A Godot 4 project, not a Bun app. Don't `bun install` it.
- `serve.ts` and the Dockerfile serve only the Godot web export. `scripts/network_manager.gd` sends `Authorization: Bearer`, authenticates the WS with its first frame, and logs in with the code flow (`scripts/web_login.gd`). Login is web-only.
- `scripts/web_pages.gd` opens allowlisted Pixl Dashboard pages as plain URLs. Add a path there when a new player page should be reachable from the game.
- The minimap and world map draw a **baked** PNG per world (`assets/map/*.png` + `bounds.json`) from `scripts/tools/world_map_baker.gd`. Re-bake after moving tilemaps (`godot --script scripts/tools/bake_world_map_cli.gd`, needs a real display).

### `apps/pixl-dashboard` and `apps/internal-dashboard` (Next.js 16)
- **Next.js 16** with React 19 and Tailwind 4 - training-data knowledge is likely stale. **Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code** and heed deprecations (e.g. middleware is `proxy.ts`).
- **Pixl Dashboard** (`apps/pixl-dashboard`, port 4901): landing page at `/` with locales under `app/[lang]` (dictionary arrays referenced by position in `Shop.tsx`/`Sidequests.tsx` must stay index-aligned across locales); signed-in pages in the `(shell)` route group; public `/docs`, `/form` and `/journals`. The session is the httpOnly `pixl_session` cookie, verified locally with `JWT_SECRET` (must match the server). Server Components read through `lib/server-api.ts` (Bearer from the cookie); mutations are Server Actions behind `lib/guarded-action.ts`. No economy formulas client-side except tested modules that mirror the server byte-for-byte. Per-request nonce CSP in `proxy.ts`. Player markdown renders through `components/markdown.tsx` (React elements, no HTML strings). The Docker image uses `output: "standalone"` with a repo-root context.
- **Pixl Internal Dashboard** (`apps/internal-dashboard`, port 4900): roles in `lib/roles.ts`, guards in `lib/guard.ts` (`requirePage`, `guardedAction`, `guardedRoute`), audit writer `lib/audit.ts`. Calls the server with `SERVICE_KEY_INTERNAL_DASHBOARD`. Image uploads go through the server's `/api/admin/uploads`.

### `apps/pixorpheus` (Slack bot)
- Bun-native TypeScript, no build step - a single Bolt v4 process organized by feature under `src/`. Slack connects over Socket Mode (`SLACK_APP_TOKEN`, required at startup), so Pixo has no public hostname; the Express app in `src/slack/app.ts` (`http`, port 3000) only serves in-cluster `/api/external/*`, `/webhooks/*` and `/healthz`. Ticket moderation lives in the internal dashboard, which resolves tickets through `src/external/ticketApi.ts`.
- Tickets start from `SLACK_HELP_CHANNEL` messages and are answered in that thread; staff reply and resolve them from the internal dashboard's tickets page. There is no private ticket log channel, and Slack channel membership never grants a permission (helpers = `helpers` table, admins = `SLACK_ADMIN_USER_IDS`).
- `models.json` lists the OpenRouter models available to AI features. See `apps/pixorpheus/README.md` for commands.
- Every player DM the internal dashboard and server send goes through `POST /api/external/dm` (`src/external/dmApi.ts`, rules in `dmRelay.ts`): `EXTERNAL_API_KEY` (timing-safe, fails closed), Slack user ids only, no `<!...>` or `<scheme:...>` syntax, 3000-char cap, per-user/global/daily in-memory rate limits. Callers default to Pixo's in-cluster address `http://pixl-pixorpheus.ysws-pixl.svc.cluster.local:3000`. Pixo may be stopped: every server/dashboard call to it goes through `callPixo` (`apps/server/src/pixoCall.ts`, `apps/internal-dashboard/lib/pixoCall.ts`) - 5 s timeout, never throws, failures logged and audited as `pixo.call_failed` - and no player or staff action may wait on or fail because of Pixo.

## Bun usage

Default to Bun over Node.js/npm/yarn/pnpm across this repo (this applies to `apps/server` too, even though its `package.json` scripts currently invoke `tsx`/`node`/`drizzle-kit` directly - don't rewrite those scripts unprompted, but use `bun` for anything new).

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest`/`vitest`
- `bun build <file>` instead of `webpack`/`esbuild`
- `bun install` instead of `npm`/`yarn`/`pnpm install`
- `bun run <script>` instead of `npm run`/`yarn run`/`pnpm run`
- `bunx <package>` instead of `npx <package>`
- Bun auto-loads `.env` - don't add `dotenv` to new Bun code.
- `Bun.serve()` for HTTP/WebSocket servers (supports routes, WS, HTTPS) instead of `express` in new Bun code.
- `bun:sqlite` instead of `better-sqlite3`; `Bun.redis` instead of `ioredis`; `Bun.sql` instead of `pg`/`postgres.js`; built-in `WebSocket` instead of `ws`.
- `Bun.file` over `node:fs` readFile/writeFile.
- `Bun.$\`cmd\`` instead of `execa`.

For HTML-import-based frontends (not used by the Next.js apps here, but the default for any new Bun frontend): `Bun.serve()` serving an `index.html` that `<script type="module" src="./frontend.tsx">`s a React entrypoint, no Vite. See `node_modules/bun-types/docs/**.mdx` for the full Bun API reference.

## Communication style: Gen Z Developer Mode

You are still an elite software engineer first. This section only governs tone in chat, not code.

**Personality**
- Talk naturally and casually, like a smart Gen Z programmer. Slang (`yo`, `fr`, `ngl`, `lowkey`, `cooked`, `W`, `L`, `based`, 💀, 🙏, 🔥) is fine but never forced into every sentence, natural over cringe.
- React honestly: bug fixed → `W`; nasty bug → `bro we were COOKED`; clever fix → `that's actually kinda fire`; bad code → say it's bad straight up, no corporate hedging.
- Match the user's energy - if they go serious, drop the slang.

**Coding behavior stays unchanged**
- Inspect the existing codebase before assuming. Follow existing architecture/conventions. Don't rewrite working code unprompted. Verify with tests/typecheck/build before claiming something works.

**Scope**
- Casual register + emojis are for chat prose only. Code, commit messages, UI copy, and docs stay clean and emoji-free - see the no-emojis and casual-commits conventions already in play for this repo.

**Final response format** (when it's a real task, not chit-chat)

**What I changed**
- short bullet

**Why**
- brief explanation

**Checks**
- tests/build/typecheck results

Core rule: speak like Gen Z, think like a senior engineer. For destructive commands or risky changes, drop the goofiness and warn clearly.
