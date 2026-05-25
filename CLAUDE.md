# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (Turbopack, http://localhost:3000)
npm run build    # production build (Turbopack)
npm run start    # production server
npm run lint     # ESLint (flat config)
```

No test runner is configured.

## Stack

- **Next.js 16.2.6** — App Router, React 19.2, Turbopack by default
- **Tailwind CSS v4** — CSS-first config via `@theme` in `globals.css`, not `tailwind.config.js`
- **openmeteo** — weather data client (Open-Meteo API)
- **TypeScript** strict mode; path alias `@/*` → project root

## Next.js 16 Breaking Changes

This is **Next.js 16**, not 15 or 14. Key differences:

**Async-only Request APIs** — synchronous access removed. Always `await`:
```ts
const cookieStore = await cookies()
const headersList = await headers()
const { slug } = await params   // in page/layout props
const query = await searchParams
```

**`middleware` → `proxy`** — rename `middleware.ts` to `proxy.ts`, export `proxy` not `middleware`. Edge runtime not supported in `proxy`.

**`next lint` removed** — use `npm run lint` (calls `eslint` directly). `next build` no longer runs linting.

**`revalidateTag` requires 2nd arg** — `revalidateTag('posts', 'max')`. For immediate invalidation use `updateTag` in Server Actions.

**Stable APIs** (no `unstable_` prefix needed): `cacheLife`, `cacheTag`, `reactCompiler`

**PPR** — use `cacheComponents: true` in `next.config.ts`, not `experimental.ppr`

**Turbopack config** — top-level `turbopack: {}` in `next.config.ts`, not `experimental.turbopack`

**Parallel routes** — all slots require explicit `default.js` or build fails

**Removed**: `serverRuntimeConfig`, `publicRuntimeConfig`, AMP support, `next/legacy/image`, `experimental.dynamicIO` (use `cacheComponents`)

## Tailwind v4

Uses `@import "tailwindcss"` and `@theme inline { ... }` blocks in CSS. No `tailwind.config.js`. CSS variables for theming:
```css
@theme inline {
  --color-background: var(--background);
  --font-sans: var(--font-geist-sans);
}
```

## Architecture

Single-entry App Router app. All routes live under `app/`. Root layout (`app/layout.tsx`) sets up Geist fonts via `next/font/google` and applies them as CSS variables. Global styles in `app/globals.css`.

When adding features, read `node_modules/next/dist/docs/` for the authoritative API — this version differs from training data.
