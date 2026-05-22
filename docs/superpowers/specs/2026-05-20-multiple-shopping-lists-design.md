# Multiple Shopping Lists — Design Spec

**Date:** 2026-05-20 **Status:** Approved

## Overview

Introduce support for multiple named, persistent shopping lists per user. Lists
are scoped to a **Household** — all members of a household share all lists. This
spec introduces the Household entity and migrates the existing
single-list-per-user model to the new structure.

**In scope:**

- Household entity (data layer only — no management UI)
- Multiple named shopping lists per household
- Create, rename, delete lists
- Empty state when a household has no lists
- One-time data migration for existing users

**Out of scope:**

- Household management UI (inviting/removing members)
- Fine-grained list sharing (owner-controlled)
- List switcher UI/UX polish (accepted as-is for now)

---

## Data Model

### New entity: `Household`

```ts
interface HouseholdInterface {
  id: string; // uuid
  name: string;
}
```

KV key: `["households", id]`

### New entity: `ShoppingList`

```ts
interface ShoppingListInterface {
  id: string; // uuid
  householdId: string;
  name: string;
  createdBy: string; // userId
  createdAt: string; // ISO string
}
```

KV key: `["shopping_lists", householdId, id]` — prefix by `householdId` enables
efficient per-household list scans.

### Updated: `User`

Gains `householdId: string`. Both KV records are updated:

- `["users", id]`
- `["users_by_username", username]`

### Updated: `ShoppingListItem`

`userId` is replaced by `listId`. KV key changes:

| Before                          | After                                 |
| ------------------------------- | ------------------------------------- |
| `["shopping_list", userId, id]` | `["shopping_list_items", listId, id]` |

```ts
interface ShoppingListItemInterface {
  id: string;
  listId: string; // replaces userId
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}
```

### Unchanged entities

`Session`, `Item`, `Category` — no changes.

### Full KV key reference (post-migration)

| KV Key                                | Value                       | Notes                             |
| ------------------------------------- | --------------------------- | --------------------------------- |
| `["households", id]`                  | `HouseholdInterface`        | new                               |
| `["users", id]`                       | `UserInterface`             | + `householdId`                   |
| `["users_by_username", username]`     | `UserInterface`             | + `householdId` (secondary index) |
| `["sessions", id]`                    | `SessionInterface`          | TTL 24h — unchanged               |
| `["shopping_lists", householdId, id]` | `ShoppingListInterface`     | new                               |
| `["shopping_list_items", listId, id]` | `ShoppingListItemInterface` | replaces old key                  |
| `["items", id]`                       | `ItemInterface`             | unchanged                         |
| `["categories", id]`                  | `CategoryInterface`         | unchanged                         |

---

## API Layer

The existing `/api/shopping-list` route is removed and replaced by two route
groups.

### List management

| Method   | Route                     | Description                              |
| -------- | ------------------------- | ---------------------------------------- |
| `GET`    | `/api/shopping-lists`     | All lists for the user's household       |
| `POST`   | `/api/shopping-lists`     | Create a list — body: `{ name: string }` |
| `PATCH`  | `/api/shopping-lists/:id` | Rename a list — body: `{ name: string }` |
| `DELETE` | `/api/shopping-lists/:id` | Delete a list and all its items          |

Files: `routes/api/shopping-lists.ts`, `routes/api/shopping-lists/[id].ts`

### List items

| Method   | Route                           | Description                                              |
| -------- | ------------------------------- | -------------------------------------------------------- |
| `GET`    | `/api/shopping-lists/:id/items` | All items for the list                                   |
| `POST`   | `/api/shopping-lists/:id/items` | Add item — body: `{ itemId: string }`                    |
| `PATCH`  | `/api/shopping-lists/:id/items` | Update item — body: `{ id, quantity?, note?, checked? }` |
| `DELETE` | `/api/shopping-lists/:id/items` | Remove item — body: `{ id: string }`                     |

File: `routes/api/shopping-lists/[id]/items.ts`

**Authorization:** Every list operation verifies that
`list.householdId === user.householdId`. Returns 403 if not.

---

## New Repositories

| File                                  | Class                  | Responsibility                                                                                                              |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `database/household.repo.ts`          | `HouseholdRepo`        | `create`, `getById` — new file                                                                                              |
| `database/shopping-list.repo.ts`      | `ShoppingListRepo`     | `create`, `getAll(householdId)`, `getById`, `update`, `delete` — **replaces** current file (which handled items, not lists) |
| `database/shopping-list-item.repo.ts` | `ShoppingListItemRepo` | `add`, `getAll(listId)`, `update`, `delete` — new file, contains logic currently in `shopping-list.repo.ts`                 |

The current `database/shopping-list.repo.ts` operated on
`["shopping_list", userId, id]` keys. Its logic moves to
`shopping-list-item.repo.ts`; the filename is reused for the new `ShoppingList`
entity repo.

---

## Migration

A one-time migration script (`deno task db:migrate`) migrates all existing data.
It is safe to re-run: each step checks whether the user already has a
`householdId` and skips if so.

**Steps per existing user:**

1. If `user.householdId` already set → skip (already migrated).
2. Create `Household` with `name = "{username}'s household"`.
3. Write `householdId` onto both user KV records (`["users", id]` and
   `["users_by_username", username]`).
4. Create a default `ShoppingList` named `"Shopping List"` with `householdId`
   and `createdBy = userId`.
5. Scan `["shopping_list", userId, *]`, rewrite each entry to
   `["shopping_list_items", newListId, itemId]` with `userId` replaced by
   `listId`.
6. Delete old `["shopping_list", userId, *]` keys.

**New user registration** (going forward): after creating the user, atomically
create a `Household` and a default `ShoppingList`.

---

## UI Changes

### Routing

| Route        | Page                    | Description                                          |
| ------------ | ----------------------- | ---------------------------------------------------- |
| `/`          | redirect                | Redirects to `/lists`                                |
| `/lists`     | Shopping lists overview | All lists for the household                          |
| `/lists/:id` | Shopping list detail    | Items in a specific list (current home page content) |

The current `routes/home/index.tsx` becomes `routes/lists/[id]/index.tsx`. The
current `routes/index.tsx` redirect points to `/lists` instead of `/home`.

### Shopping lists overview (`routes/lists/index.tsx`) — new page

- Server-renders all lists for the user's household.
- Each list is shown as a card/row with its name; clicking navigates to
  `/lists/:id`.
- A "New list" button creates a list (inline or via a small form).
- Rename and delete actions are available per list.
- **Empty state:** when the household has no lists, show a prompt to create the
  first one. There is no minimum list count — deleting the last list is allowed.

### Shopping list detail (`routes/lists/[id]/index.tsx`) — replaces home page

- Server-renders the specific list's items, hydrated directly (no extra
  round-trip).
- A back link returns to `/lists`.
- No list selector needed — switching lists goes back to `/lists` and picks
  another.

### `hooks/useShoppingList.ts`

Accepts a `listId` parameter and calls `/api/shopping-lists/:listId/items`
instead of `/api/shopping-list`. No other behavioral changes.

### `services/api.ts`

- `shoppingList` service methods update their URLs to include `listId`.
- A new `shoppingLists` service handles list CRUD (`getAll`, `create`, `rename`,
  `delete`).

---

## Error Handling

- `GET /api/shopping-lists/:id/items` on a list that doesn't belong to the
  user's household → 403
- `DELETE /api/shopping-lists/:id` deletes all items in the list before deleting
  the list record (or in a KV atomic batch where possible)
- Creating a list with an empty name → 400
