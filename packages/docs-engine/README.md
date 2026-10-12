# @pixl/docs-engine

Builds an Open Graph preview card per `docs/*.md` page into
`apps/pixl-dashboard/public/docs/<slug>/og.png`. The pages themselves are
rendered at request time by `apps/pixl-dashboard` (it imports `src/markdown.ts`).

```bash
bun run docs:build      # from the repo root
```

## Writing docs

One file per page in `docs/`, named `<order>-<slug>.md`. The number sets the nav
order, the slug becomes the URL: `150-energy.md` → `/docs/energy/`.

```markdown
---
title: Restoration Energy and levels
group: Build & ship
description: One sentence. This is what Slack shows under the link.
---

# Restoration Energy and levels

^ A leading paragraph, rendered as the page lead.

## A section heading

- a list item
```

Beyond normal markdown:

- `^ ` at the start of a paragraph marks it as the page lead.
- `::: note Title` / `::: warn Title` … `:::` produce callouts.
- A pipe table becomes the three-column fact grid.
- `{{token}}` is replaced from `packages/config/pixl.json` at build time, so no
  page can quote a stale rate. Run `bun run docs:build` after editing
  `pixl.json`. Unknown tokens fail the build.

Available tokens: `basePx` `maxPx` `baseUsd` `maxUsd` `reCap` `maxLevel`
`t1`–`t4` `cutoff` `band1From`/`To`/`Per`/`Total` (and `band2`, `band3`).

## Output

Everything under `apps/pixl-dashboard/public/docs/<slug>/` is generated.

The preview cards are drawn by `src/png.ts` (a small PNG encoder) and
`src/font.ts` (a 5x7 bitmap font) rather than a rasterizer dependency, so the
build has nothing native in it.
