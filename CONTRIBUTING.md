# Contributing to Pixl

Thanks for wanting to help build Pixl. This repo is a Bun/Turborepo monorepo with five real apps (`server`, `game`, `landing`, `dashboard`, `pixorpheus`) - see the [README](README.md) for what each one does before you dive in.

## Getting set up

1. Fork the repository and clone your fork
2. `bun install` from the repo root
3. Copy `.env.example` → `.env` in `apps/server` and `apps/dashboard` and fill in the values you have access to (see [README → Environment Variables](README.md#environment-variables)). If you don't have database/Slack credentials, ask in the Pixl Slack channel - most contributions to `landing` or `game` don't need a full backend running
4. Run the app(s) you're working on: `bun run --cwd apps/<app> dev` (see [README → Run](README.md#run))

## Conventions

- **Default to Bun**, not Node/npm/yarn/pnpm, for anything new - `bun <file>`, `bun test`, `bun install`, `bunx <package>`. The exception is `apps/pixorpheus`, which is plain CommonJS Node.js on purpose; don't try to convert it.
- **`apps/landing` and `apps/dashboard` run Next.js 16** with React 19 and Tailwind 4 - recent enough that a lot of training-data knowledge of Next.js is stale. Read `node_modules/next/dist/docs/` for the relevant guide before writing Next.js code, and heed any deprecation warnings.
- **`apps/game` is a Godot 4 project** (GDScript), not a Bun/TypeScript app. Open it with the Godot 4 editor; don't try to `bun install` or `bun run` it.
- **Database migrations** live in `apps/server/drizzle/` as sequentially numbered raw SQL files (e.g. `0047_...sql`). Schema changes go through `bun run --cwd apps/server db:generate` first; hand-written/data-only migrations just take the next free number. Check `git log`/the current highest number right before you add one - this repo has multiple contributors pushing migrations, so numbers can move between when you last pulled and when you're ready to commit.
- **Shared code across the 4 landing locales** (`en`/`fr`/`es`/`pt`, under `apps/landing/app/[lang]/dictionaries/`) must stay index-aligned with anything in `Shop.tsx`/`Sidequests.tsx` that references them by position. If you add/remove/reorder an item, do it identically across all 4 dictionaries plus the component - mismatched indices silently show the wrong name/price on the wrong image.
- **Don't add abstractions, config flags, or "just in case" error handling** for things the codebase doesn't already need. Match the existing style in the file you're editing over introducing a new pattern.

## Making a change

1. Create a feature branch: `git checkout -b feat/short-description`
2. Make your change, keeping it scoped to what you set out to do
3. Test it - run the relevant app and actually exercise the change (a type-check passing isn't the same as the feature working)
4. Commit with a clear message describing *why*, not just *what*
5. Push and open a Pull Request against `main`, describing what changed and how you tested it

## Reporting bugs / requesting features

Open a GitHub issue, or drop it in the Pixl help channel on Slack if you're part of the community already - Pixorpheus (the Slack bot) turns that into a tracked ticket automatically.

## Questions

If something in the codebase doesn't make sense, it's more likely under-documented than intentionally obscure - ask rather than guessing, either as a GitHub issue or in Slack.
