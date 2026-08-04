# AGENTS.md

Guidance for AI coding agents working in this repository.

**Happie** is a mobile-first household-manager PWA (Deno + Fresh 2 + Preact +
Deno KV + Tailwind v4). The shopping list is the first of many planned modules.

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

These docs live outside the always-loaded context on purpose — load them when
the task calls for them rather than duplicating their contents here.
