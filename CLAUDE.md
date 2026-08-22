# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Product Vision

**Happie** is a household manager — a shared platform that helps families
collaborate on the daily ins and outs of living together. The target audience is
households with parents and children. The core ethos is making routine household
tasks feel collaborative and shared, rather than a burden on one person.

The **shopping list** is the first module, but the platform is designed to grow.
Future modules could include meal planning, shared to-do lists, smart home
integrations, and more. Avoid designs that are tightly coupled to the shopping
list domain — new features should feel like cohesive modules within a broader
household platform.

UX must be accessible to all ages (including children): clear language, simple
interactions, and a warm approachable tone — not clinical or
productivity-tool-ish.

The app is **mobile-first** and designed to work as a Progressive Web App (PWA),
but must also work well on desktop. Mobile is the priority because much of the
functionality is meant to be used on the go — e.g. checking off items while
shopping, or quickly adding something to a list from wherever you are.

## Domain Language

**Before naming anything user-facing or domain-level, read
[`CONTEXT.md`](CONTEXT.md).** It is the project's domain glossary — the
ubiquitous language for core concepts like "household," "to-do," and "backlog,"
and what to avoid instead (e.g. "task," "list," "account"). Keep it updated when
you introduce a new domain concept.

## UI/UX Patterns

**Before building or changing anything the user sees, read
[`docs/ui-ux-patterns.md`](docs/ui-ux-patterns.md).** It documents the
established front-end conventions (optimistic vs. pessimistic mutations, the
`api` error boundary, loading feedback, search/filter, exit animations,
debounced writes, cross-island signals, the MD3 component library, mobile/PWA
details) so new features stay consistent. Keep it updated when you introduce a
new pattern.

## Build & Development Commands

- `deno task dev` — Start dev server (Vite + HMR, requires `--unstable-kv`)
- `deno task check` — Format check + lint + type check
  (`deno fmt --check && deno lint && deno check`)
- `deno task build` — Production build via Vite
- `deno task preview` — Serve production build
- `deno task db:seed` — Seed database with demo user (reads `.env`)
- `deno task db:view` — Inspect KV database contents
- `deno task test` — Run tests (uses `--unstable-kv -A`; required for KV-backed
  repo tests)

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

**Signals in islands**: Always use `useSignal()` (not `signal()`) for local
state inside island component functions. `signal()` in a function body creates a
new signal instance on every re-render, resetting state (e.g. clearing input
values on each keystroke). `useSignal()` is the hook equivalent — it creates the
signal once on mount and returns the same instance on subsequent renders.
`signal()` is only safe at module scope (outside any function).

**Routing**: File-system based. `routes/api/*.ts` return JSON responses.
`routes/*.tsx` return pages. Dynamic segments use `[id]` folders.
`_middleware.ts` handles cookie-based session auth (sliding 30-day expiry,
90-day absolute cap) with redirect to `/login` for unauthorized page requests
and 401 for API requests.

**KV key pattern**: `[collection_name, id]` (e.g., `["items", "uuid"]`). IDs via
`crypto.randomUUID()`.

## Researching APIs and Conventions

When working with Deno, Fresh 2, or any other library in this project, always
use **Context7** (`mcp__plugin_context7_context7__*` tools) to look up the
current API before writing code. Training data goes stale; Context7 reflects the
live docs.

Typical cases where you **must** consult Context7 first:

- Fresh 2 handler patterns (e.g. `define.handlers`, `define.page`, middleware
  signatures)
- Fresh type names — e.g. `Context` vs the deprecated `FreshContext`
- Deno KV APIs, Deno Deploy constraints
- Any `jsr:` or `npm:` package whose API may have changed

Workflow: `resolve-library-id` → `query-docs` → write code.

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

**Data migrations** (`scripts/migrate.ts`) are run manually against production —
never from the Deno Deploy build/pre-deploy command. See
[`docs/running-migrations.md`](docs/running-migrations.md).
