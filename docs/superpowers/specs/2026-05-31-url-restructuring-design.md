# URL Restructuring Design

**Issue:**
[#10 — Redesign Application Navigation](https://github.com/FredericGryspeerdt/happie-fresh/issues/10)
**Date:** 2026-05-31 **Status:** Approved

## Overview

Restructure all page and API routes to use a `/shopping` feature prefix. This
aligns the URL hierarchy with the navigation hierarchy already built in the
AppBar/TabBar redesign, and reserves generic path names (like `/lists`) for
future features (e.g. a Todos feature).

**Approach:** Hard cut-over — no redirects. Old URLs stop working.

**Scope:** Page routes, API routes, `config/navigation.ts`, `services/api.ts`,
`routes/index.tsx`. No changes to data models, business logic, or component
interfaces.

## Route Map

### Page Routes

| Before                    | After                           | File                                       |
| ------------------------- | ------------------------------- | ------------------------------------------ |
| `/lists`                  | `/shopping`                     | `routes/shopping/index.tsx`                |
| `/lists/[id]`             | `/shopping/[id]`                | `routes/shopping/[id]/index.tsx`           |
| `/items`                  | `/shopping/catalogue`           | `routes/shopping/catalogue/index.tsx`      |
| `/items/new`              | `/shopping/catalogue/new`       | `routes/shopping/catalogue/new.tsx`        |
| `/items/detail/[id]`      | `/shopping/catalogue/[id]`      | `routes/shopping/catalogue/[id]/index.tsx` |
| `/items/detail/[id]/edit` | `/shopping/catalogue/[id]/edit` | `routes/shopping/catalogue/[id]/edit.tsx`  |
| `/items/overview`         | `/shopping/catalogue/overview`  | `routes/shopping/catalogue/overview.tsx`   |
| `/categories/manage`      | `/shopping/categories`          | `routes/shopping/categories/index.tsx`     |

**Note on routing conflicts:** Fresh 2 matches static segments before dynamic
segments. `/shopping/catalogue`, `/shopping/categories`, and
`/shopping/catalogue/new` will never be captured by `/shopping/[id]` or
`/shopping/catalogue/[id]`.

### API Routes

| Before                           | After                               | File                                      |
| -------------------------------- | ----------------------------------- | ----------------------------------------- |
| `/api/shopping-lists`            | `/api/shopping/lists`               | `routes/api/shopping/lists.ts`            |
| `/api/shopping-lists/[id]`       | `/api/shopping/lists/[id]/index.ts` | `routes/api/shopping/lists/[id]/index.ts` |
| `/api/shopping-lists/[id]/items` | `/api/shopping/lists/[id]/items.ts` | `routes/api/shopping/lists/[id]/items.ts` |
| `/api/items`                     | `/api/shopping/catalogue`           | `routes/api/shopping/catalogue.ts`        |
| `/api/categories`                | `/api/shopping/categories`          | `routes/api/shopping/categories.ts`       |

### File System Changes

| Before                                    | After                                     |
| ----------------------------------------- | ----------------------------------------- |
| `routes/lists/`                           | `routes/shopping/`                        |
| `routes/lists/[id]/`                      | `routes/shopping/[id]/`                   |
| `routes/items/`                           | `routes/shopping/catalogue/`              |
| `routes/items/detail/[id]/`               | `routes/shopping/catalogue/[id]/`         |
| `routes/categories/manage.tsx`            | `routes/shopping/categories/index.tsx`    |
| `routes/api/shopping-lists.ts`            | `routes/api/shopping/lists.ts`            |
| `routes/api/shopping-lists/[id]/index.ts` | `routes/api/shopping/lists/[id]/index.ts` |
| `routes/api/shopping-lists/[id]/items.ts` | `routes/api/shopping/lists/[id]/items.ts` |
| `routes/api/items.ts`                     | `routes/api/shopping/catalogue.ts`        |
| `routes/api/categories.ts`                | `routes/api/shopping/categories.ts`       |

## Non-Route File Changes

### `config/navigation.ts`

Update `id`, `defaultRoute`, `routes` prefix array, and all `subNav` routes:

```ts
{
  id: "shopping",
  label: "Shopping",
  icon: "🛒",
  defaultRoute: "/shopping",
  routes: ["/shopping"],   // simplified from ["/lists", "/items", "/categories"]
  subNav: [
    { label: "My Lists",       route: "/shopping" },
    { label: "Item Catalogue", route: "/shopping/catalogue" },
    { label: "Categories",     route: "/shopping/categories" },
  ],
}
```

The `resolveActiveTab` function requires no changes — the prefix matching logic
works unchanged with the new routes array.

### `services/api.ts`

Update all fetch URL strings. No interface changes, no logic changes.

| Before                                      | After                                       |
| ------------------------------------------- | ------------------------------------------- |
| `"/api/items"`                              | `"/api/shopping/catalogue"`                 |
| `"/api/categories"`                         | `"/api/shopping/categories"`                |
| `"/api/shopping-lists"`                     | `"/api/shopping/lists"`                     |
| `` `/api/shopping-lists/${id}` ``           | `` `/api/shopping/lists/${id}` ``           |
| `` `/api/shopping-lists/${listId}/items` `` | `` `/api/shopping/lists/${listId}/items` `` |

### `routes/index.tsx`

Update redirect target from `/lists` to `/shopping`.

## Out of Scope

- Redirects from old URLs to new URLs
- API versioning (`/api/v1/...`)
- Changes to data models, repo layer, or KV key patterns
- Any UI or component changes
- `routes/_middleware.ts` — no changes needed (only checks auth, not specific
  paths)
