# Project Overview

This is a **Fresh** project (Deno-based full-stack framework) for a shopping
list application. It uses **Deno KV** for data storage and **Tailwind CSS v4**
for styling.

# Architecture & Patterns

## Core Stack

- **Runtime**: Deno
- **Framework**: Fresh (Server-Side Rendering + Islands Architecture)
- **UI Library**: Preact (via Fresh)
- **Database**: Deno KV (Key-Value store)
- **Styling**: Tailwind CSS v4 (via Vite plugin)

## Directory Structure

- `routes/`: File-system based routing.
  - `routes/api/`: API endpoints (return JSON).
  - `routes/[name].tsx`: Server-rendered pages (return HTML).
- `islands/`: Interactive client-side components (hydrated).
- `components/`: Stateless UI components (shared between server/client).
- `database/`: Data access layer.
  - `db.ts`: KV connection singleton.
  - `*.repo.ts`: Repository pattern for entity access.
- `models/`: TypeScript interfaces and types.

## Data Access Pattern

- **Use Repositories**: Always use `database/*.repo.ts` classes (e.g.,
  `ItemRepo`) for DB operations. Avoid accessing `Deno.openKv()` directly in
  routes.
- **KV Keys**: Follow the pattern `[collection_name, id]` (e.g.,
  `["items", "uuid"]`).
- **IDs**: Generate IDs using `crypto.randomUUID()`.

## Preact Components
- **patterns**: smart hook / dumb component, render props

## State Management & Interactivity

- **Islands**: Use islands (`islands/`) ONLY for components requiring
  client-side interactivity (event listeners, hooks).
- **Server Components**: Prefer server-rendered components (`components/`) for
  static content.
- **Hooks**: Use `@preact/signals` in islands.

# Development Workflow

## Commands

- **Start Dev Server**: `deno task dev` (uses Vite).
- **Type Check & Lint**: `deno task check`.
- **Run Tests**: `deno test`.
- **Preview Production**: `deno task preview`.

## Common Tasks

- **New Route**: Create a file in `routes/`. Use `export const handler` for
  server-side logic (GET/POST) and `export default function` for the UI.
- **New API Endpoint**: Create a file in `routes/api/`. Return `Response`
  objects.
- **New Entity**:
  1. Define interface in `models/`.
  2. Create repository in `database/`.
  3. Use repository in routes/api.

# Coding Conventions

- **Imports**: Use the `@/` alias for the project root (e.g.,
  `import { db } from "@/database/index.ts"`).
- **Styling**: Use Tailwind utility classes directly in `class` (not
  `className`) attributes.
- **Types**: Strictly type all props and data interfaces.
- **Async/Await**: Use top-level await where supported (Deno).

# Specific Implementation Details

- **KV Singleton**: Use `getKv()` from `@/database/db.ts`.
- **API Handlers**: In `routes/api/`, handlers receive `ctx: FreshContext`.
  Ensure `ctx` is correctly typed and used.
