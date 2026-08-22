# AGENTS.md

Guidance for AI coding agents working in this repository.

**Happie** is a mobile-first household-manager PWA (Deno + Fresh 2 + Preact +
Deno KV + Tailwind v4). Modules: shopping lists, todos (backlog), menu (dishes
+ tag groups), members, loyalty cards, push notifications.

## Start here

- **General project guidance** — stack, architecture, data flow, commands,
  coding conventions: see [`CLAUDE.md`](CLAUDE.md).
- **Domain language** — read [`CONTEXT.md`](CONTEXT.md) **before naming anything
  user-facing or domain-level.** It's the project's domain glossary (ubiquitous
  language) — what to call things, and what to avoid instead.
- **UI/UX patterns** — read [`docs/ui-ux-patterns.md`](docs/ui-ux-patterns.md)
  **before building or changing anything the user sees.** It captures the
  established front-end conventions (optimistic vs. pessimistic mutations, the
  `api` error boundary, loading feedback, search/filter, exit animations,
  debounced writes, cross-island signals, the MD3 component library, and
  mobile/PWA details) so new features stay consistent. Keep it updated when you
  introduce a new pattern.
- **Architecture decisions** — settled domain decisions live as ADRs in
  [`docs/adr/`](docs/adr/) (e.g. members vs. users, due dates are UTC instants,
  claim-based push sweep). Check for an applicable one before re-deciding.

These docs live outside the always-loaded context on purpose — load them when
the task calls for them rather than duplicating their contents here.

## Setup & verification

- Run `deno install` after cloning or changing dependencies. `nodeModulesDir`
  is `"manual"`, so `deno task check` / `dev` fail with "Could not find a
  matching package … in the node_modules directory" until `node_modules/` is
  populated.
- `deno task check` = format + lint + typecheck; run it before finishing.
- Tests: `deno task test` (adds `--unstable-kv -A`, required by KV-backed repo
  tests — plain `deno test` fails). Single file: `deno task test <path>`;
  filter: `-f <name>`.
- Most tasks load `.env` via `--env-file`; without it they error. Local dev
  login: `demo` / `password` unless `.env` overrides.

## Gotchas

- **KV keys are household-scoped**: `[collection, householdId, id]`, e.g.
  `["todos", <householdId>, <id>]`. (CLAUDE.md still shows `[collection, id]`
  and references a `components/list.tsx` that no longer exists — trust the code
  over prose there.) Repos (`database/*.repo.ts`) are static classes; never
  call `Deno.openKv()` outside `database/db.ts`.
- **Member ≠ User**: users are credentials, members are people (ADR 0006).
  Sessions authenticate users; data attribution uses member ids, chosen via the
  acting-member cookie (`utils/acting-member-cookie.ts`).
- `deno task db:seed` is destructive and dev-only: resets seeded collections
  and logs everyone out.
- Never run migrations from a build/deploy step: in that sandbox `getKv()` hits
  an empty local file, not production KV. Run via the "Migrate production KV"
  workflow or KV Connect locally — see
  [`docs/running-migrations.md`](docs/running-migrations.md).
- `web-push` must stay externalized in `vite.config.ts` (both `ssr.external`
  and the SSR Rollup `external`) — its CommonJS deps break when bundled.
  Expect to do the same for other server-side CJS npm packages.
- `Deno.cron` must stay at module scope in `main.ts`: Deno Deploy extracts
  cron definitions at deploy time.
- Deploys are automatic: push to `main` → GitHub Actions → Deno Deploy;
  PRs against `main` also run the build.
- On-device testing over LAN needs HTTPS (PWA secure context + `Secure`
  session cookie): `deno task dev:mobile` with mkcert certs in `certs/` — see
  [`docs/mobile-testing.md`](docs/mobile-testing.md).
