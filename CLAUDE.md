# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Build & Development Commands

- `deno task dev` — Start dev server (Vite + HMR, requires `--unstable-kv`)
- `deno task check` — Format check + lint + type check
  (`deno fmt --check && deno lint && deno check`)
- `deno task build` — Production build via Vite
- `deno task preview` — Serve production build
- `deno task db:seed` — Seed database with demo user (reads `.env`)
- `deno task db:view` — Inspect KV database contents
- `deno test` — Run tests

## Architecture

**Stack**: Deno + Fresh 2 (SSR + Islands) + Preact + Deno KV + Tailwind CSS v4

**Fresh Islands Architecture**: Pages in `routes/` are server-rendered. Only
components in `islands/` are hydrated on the client. Use islands solely for
interactive components needing event listeners or hooks; prefer server-rendered
`components/` for static content.

**Data flow**: Routes/API handlers → Repository classes (`database/*.repo.ts`) →
Deno KV singleton (`database/db.ts`). Never access `Deno.openKv()` directly in
routes.

**State management**: Islands use `@preact/signals` for reactive state.
`hooks/useShoppingList.ts` is the core shopping list hook, using a custom
debounced merge scheduler (`utils/debounce-update.ts`) for optimistic UI updates
with batched PATCH requests.

**Routing**: File-system based. `routes/api/*.ts` return JSON responses.
`routes/*.tsx` return pages. Dynamic segments use `[id]` folders.
`_middleware.ts` handles cookie-based session auth (24h expiry) with redirect to
`/login` for unauthorized page requests and 401 for API requests.

**KV key pattern**: `[collection_name, id]` (e.g., `["items", "uuid"]`). IDs via
`crypto.randomUUID()`.

## Coding Conventions

- **Imports**: Use `@/` alias for project root (e.g.,
  `import { db } from "@/database/db.ts"`)
- **Styling**: Tailwind utility classes in `class` attribute (not `className`)
- **JSX**: Preact JSX with `jsx: "precompile"` — use `class` not `className`
- **Types**: Strictly typed props and interfaces. DTOs for create/update
  operations in `models/`
- **Design patterns in use**: Render Props (see `components/list.tsx`),
  Container/Presentational, Compound components, HOC
- **Commits**: Follow the
  [Conventional Commits](https://www.conventionalcommits.org/) specification.
  Format: `<type>[optional scope]: <description>` — e.g. `feat: add search`,
  `fix(auth): handle expired tokens`, `chore: update deps`. Common types:
  `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`.

## Deployment

Deployed on Deno Deploy (`fredericdev/happie-fresh`). Local dev uses file-based
KV at `data/kv.db`; production uses remote Deno KV.
