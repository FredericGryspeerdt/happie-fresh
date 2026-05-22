# Multiple Shopping Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Household entities, multiple named shopping lists per
household, a dedicated lists overview page at `/lists`, and migrate existing
single-list-per-user data to the new model.

**Architecture:** A new `Household` entity groups users; lists belong to
households. `ShoppingListItem` keys move from `["shopping_list", userId, id]` to
`["shopping_list_items", listId, id]`. A one-time migration script handles
existing data. New file-system routes under `routes/lists/` replace
`routes/home/`.

**Tech Stack:** Deno, Fresh 2 (SSR + Islands), Preact + @preact/signals, Deno
KV, Tailwind CSS v4, `deno test` for tests.

---

## File Map

**Create:**

- `models/household/household.interface.ts` — `HouseholdInterface`
- `models/household/index.ts` — re-export
- `models/shopping-list/shopping-list.interface.ts` — `ShoppingListInterface`
- `database/household.repo.ts` — `HouseholdRepo`
- `database/shopping-list-item.repo.ts` — `ShoppingListItemRepo` (logic from
  current `shopping-list.repo.ts`)
- `routes/api/shopping-lists.ts` — GET all lists, POST create
- `routes/api/shopping-lists/[id]/index.ts` — PATCH rename, DELETE list
- `routes/api/shopping-lists/[id]/items.ts` — GET/POST/PATCH/DELETE items
- `routes/lists/index.tsx` — lists overview page (SSR + island)
- `routes/lists/[id]/index.tsx` — list detail page (replaces
  `routes/home/index.tsx`)
- `islands/shopping-lists.tsx` — interactive list management island
- `scripts/migrate.ts` — one-time data migration

**Modify:**

- `models/shopping-list/shopping-list-item.interface.ts` — `userId` → `listId`
- `models/shopping-list/index.ts` — add `ShoppingListInterface` export
- `models/user/user.interface.ts` — add `householdId: string`
- `models/index.ts` — add household export
- `database/shopping-list.repo.ts` — replace with `ShoppingListRepo` (list CRUD,
  not items)
- `database/index.ts` — add new exports
- `database/user.repo.ts` — add `findById`, update `create` to auto-create
  household + default list
- `utils/define.ts` — add `householdId` to `StateInterface`
- `routes/_middleware.ts` — add `householdId` to state
- `routes/index.tsx` — redirect `/` → `/lists`
- `routes/login.tsx` — redirect after login → `/lists`
- `services/api.ts` — add `shoppingLists` service, update `shoppingList` to
  accept `listId`
- `hooks/useShoppingList.ts` — accept `listId` first param, thread through API
  calls
- `hooks/useShoppingList.test.ts` — update `makeListItem` and stub arg
  assertions
- `islands/items.tsx` — accept `listId` prop, pass to `useShoppingList`
- `deno.json` — add `db:migrate` task

**Delete:**

- `routes/api/shopping-list.ts`
- `routes/home/index.tsx`

---

### Task 1: Data model — new interfaces

**Files:**

- Create: `models/household/household.interface.ts`
- Create: `models/household/index.ts`
- Create: `models/shopping-list/shopping-list.interface.ts`
- Modify: `models/shopping-list/shopping-list-item.interface.ts`
- Modify: `models/shopping-list/index.ts`
- Modify: `models/user/user.interface.ts`
- Modify: `models/index.ts`

- [ ] **Step 1: Create `models/household/household.interface.ts`**

```ts
export interface HouseholdInterface {
  id: string;
  name: string;
}
```

- [ ] **Step 2: Create `models/household/index.ts`**

```ts
export * from "./household.interface.ts";
```

- [ ] **Step 3: Create `models/shopping-list/shopping-list.interface.ts`**

```ts
export interface ShoppingListInterface {
  id: string;
  householdId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export type CreateShoppingListDto = Omit<ShoppingListInterface, "id">;
```

- [ ] **Step 4: Update `models/shopping-list/shopping-list-item.interface.ts`**

Replace `userId` with `listId`:

```ts
export interface ShoppingListItemInterface {
  id: string;
  listId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

export type CreateShoppingListItemDto = Omit<ShoppingListItemInterface, "id">;
export type UpdateShoppingListItemDto =
  & Pick<ShoppingListItemInterface, "id">
  & Partial<Omit<ShoppingListItemInterface, "id">>;
```

- [ ] **Step 5: Update `models/shopping-list/index.ts`**

```ts
export * from "./shopping-list-item.interface.ts";
export * from "./shopping-list.interface.ts";
```

- [ ] **Step 6: Update `models/user/user.interface.ts`**

```ts
export interface UserInterface {
  id: string;
  username: string;
  passwordHash: string;
  householdId: string;
}
```

- [ ] **Step 7: Update `models/index.ts`**

```ts
export * from "./item/index.ts";
export * from "./user/index.ts";
export * from "./session/index.ts";
export * from "./shopping-list/index.ts";
export * from "./category/index.ts";
export * from "./household/index.ts";
```

- [ ] **Step 8: Run type-check to confirm no regressions yet (some are expected
      — note them)**

```bash
deno task check 2>&1 | head -60
```

Expected: type errors in `database/shopping-list.repo.ts` (uses old `userId`),
`routes/api/shopping-list.ts`, `hooks/useShoppingList.test.ts`,
`islands/items.tsx`. These are addressed in later tasks.

- [ ] **Step 9: Commit**

```bash
git add models/
git commit -m "feat: add Household and ShoppingList interfaces, replace userId with listId in ShoppingListItem"
```

---

### Task 2: HouseholdRepo

**Files:**

- Create: `database/household.repo.ts`

- [ ] **Step 1: Create `database/household.repo.ts`**

```ts
import { HouseholdInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

export class HouseholdRepo {
  static async create(name: string): Promise<HouseholdInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const household: HouseholdInterface = { id, name };
    await kv.set(["households", id], household);
    return household;
  }

  static async getById(id: string): Promise<HouseholdInterface | null> {
    const kv = await getKv();
    const result = await kv.get<HouseholdInterface>(["households", id]);
    return result.value;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add database/household.repo.ts
git commit -m "feat: add HouseholdRepo"
```

---

### Task 3: ShoppingListItemRepo

**Files:**

- Create: `database/shopping-list-item.repo.ts`

- [ ] **Step 1: Create `database/shopping-list-item.repo.ts`**

This replaces the current `shopping-list.repo.ts` logic, updated to use `listId`
and the new KV key `["shopping_list_items", listId, id]`.

```ts
import { ShoppingListItemInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

export class ShoppingListItemRepo {
  static async add(
    listId: string,
    itemId: string,
  ): Promise<ShoppingListItemInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const entry: ShoppingListItemInterface = {
      id,
      listId,
      itemId,
      quantity: 1,
      checked: false,
    };
    await kv.set(["shopping_list_items", listId, id], entry);
    return entry;
  }

  static async getAll(listId: string): Promise<ShoppingListItemInterface[]> {
    const kv = await getKv();
    const iter = kv.list<ShoppingListItemInterface>({
      prefix: ["shopping_list_items", listId],
    });
    const items: ShoppingListItemInterface[] = [];
    for await (const { value } of iter) items.push(value);
    return items;
  }

  static async update(
    listId: string,
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ): Promise<ShoppingListItemInterface | null> {
    const kv = await getKv();
    const key = ["shopping_list_items", listId, id];
    const current = await kv.get<ShoppingListItemInterface>(key);
    if (!current.value) return null;
    const next = { ...current.value, ...patch } as ShoppingListItemInterface;
    await kv.set(key, next);
    return next;
  }

  static async delete(listId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["shopping_list_items", listId, id]);
  }

  static async deleteAll(listId: string): Promise<void> {
    const kv = await getKv();
    for await (
      const entry of kv.list({ prefix: ["shopping_list_items", listId] })
    ) {
      await kv.delete(entry.key);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add database/shopping-list-item.repo.ts
git commit -m "feat: add ShoppingListItemRepo with new KV key pattern"
```

---

### Task 4: ShoppingListRepo (list entity)

**Files:**

- Modify: `database/shopping-list.repo.ts` (full replacement)

- [ ] **Step 1: Replace `database/shopping-list.repo.ts`**

The current file handled items. It is replaced entirely with a repo for the
`ShoppingList` entity.

```ts
import {
  CreateShoppingListDto,
  ShoppingListInterface,
} from "@/models/index.ts";
import { getKv } from "./db.ts";

export class ShoppingListRepo {
  static async create(
    data: CreateShoppingListDto,
  ): Promise<ShoppingListInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const list: ShoppingListInterface = { ...data, id };
    await kv.set(["shopping_lists", data.householdId, id], list);
    return list;
  }

  static async getAll(householdId: string): Promise<ShoppingListInterface[]> {
    const kv = await getKv();
    const iter = kv.list<ShoppingListInterface>({
      prefix: ["shopping_lists", householdId],
    });
    const lists: ShoppingListInterface[] = [];
    for await (const { value } of iter) lists.push(value);
    return lists;
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<ShoppingListInterface | null> {
    const kv = await getKv();
    const result = await kv.get<ShoppingListInterface>([
      "shopping_lists",
      householdId,
      id,
    ]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: Partial<ShoppingListInterface>,
  ): Promise<ShoppingListInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await kv.set(["shopping_lists", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["shopping_lists", householdId, id]);
  }
}
```

- [ ] **Step 2: Update `database/index.ts`**

```ts
export * from "./user.repo.ts";
export * from "./item.repo.ts";
export * from "./session.repo.ts";
export * from "./db.ts";
export * from "./shopping-list.repo.ts";
export * from "./shopping-list-item.repo.ts";
export * from "./household.repo.ts";
export * from "./category.repo.ts";
```

- [ ] **Step 3: Commit**

```bash
git add database/shopping-list.repo.ts database/index.ts
git commit -m "feat: replace ShoppingListRepo with list-entity CRUD, add ShoppingListItemRepo export"
```

---

### Task 5: Update UserRepo

**Files:**

- Modify: `database/user.repo.ts`

- [ ] **Step 1: Write failing type-check test**

Run type-check to confirm `UserRepo.create` now has a type error (it no longer
accepts the old shape once `UserInterface` requires `householdId`):

```bash
deno check database/user.repo.ts 2>&1
```

Expected: error about `householdId` missing.

- [ ] **Step 2: Update `database/user.repo.ts`**

```ts
import { UserInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { HouseholdRepo } from "./household.repo.ts";
import { ShoppingListRepo } from "./shopping-list.repo.ts";

export class UserRepo {
  static async findByUsername(username: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users_by_username", username]);
    return user.value;
  }

  static async findById(id: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users", id]);
    return user.value;
  }

  static async create(
    user: Omit<UserInterface, "id" | "householdId">,
  ): Promise<UserInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const household = await HouseholdRepo.create(
      `${user.username}'s household`,
    );
    const userWithId: UserInterface = {
      ...user,
      id,
      householdId: household.id,
    };
    await kv
      .atomic()
      .set(["users", userWithId.id], userWithId)
      .set(["users_by_username", user.username], userWithId)
      .commit();
    await ShoppingListRepo.create({
      householdId: household.id,
      name: "Shopping List",
      createdBy: id,
      createdAt: new Date().toISOString(),
    });
    return userWithId;
  }

  static async deleteAll(): Promise<void> {
    const kv = await getKv();
    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      await kv
        .atomic()
        .delete(["users", user.id])
        .delete(["users_by_username", user.username])
        .commit();
    }
  }
}
```

- [ ] **Step 3: Run type-check on updated repo**

```bash
deno check database/user.repo.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add database/user.repo.ts
git commit -m "feat: UserRepo.create auto-creates Household and default ShoppingList, add findById"
```

---

### Task 6: Update middleware to expose householdId

**Files:**

- Modify: `utils/define.ts`
- Modify: `routes/_middleware.ts`

- [ ] **Step 1: Update `utils/define.ts`**

Add `householdId` to `StateInterface` so all `define.handlers` page routes can
access it:

```ts
import { createDefine } from "fresh";
import { ItemInterface, ShoppingListItemInterface } from "../models/index.ts";

interface StateInterface {
  userId?: string;
  householdId?: string;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
}

export const define = createDefine<StateInterface>();
```

- [ ] **Step 2: Update `routes/_middleware.ts`**

```ts
import { Context } from "fresh";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";

interface State {
  userId?: string;
  householdId?: string;
}

export async function handler(ctx: Context<State>) {
  const req = ctx.req;
  const url = new URL(req.url);
  const path = url.pathname;

  if (
    path === "/login" ||
    path.startsWith("/_fresh") ||
    path.startsWith("/static") ||
    path.startsWith("/assets") ||
    path.startsWith("/favicon.ico")
  ) {
    return await ctx.next();
  }

  const cookies = getCookies(req.headers);
  const sessionId = cookies.sessionId;

  if (sessionId) {
    const session = await SessionRepo.findById(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      const user = await UserRepo.findById(session.userId);
      ctx.state.userId = session.userId;
      ctx.state.householdId = user?.householdId;
      return await ctx.next();
    }
  }

  if (path.startsWith("/api")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = new Headers();
  headers.set("location", "/login");
  return new Response(null, { status: 303, headers });
}
```

- [ ] **Step 2: Commit**

```bash
git add routes/_middleware.ts
git commit -m "feat: expose householdId in middleware state"
```

---

### Task 7: Migration script

**Files:**

- Create: `scripts/migrate.ts`
- Modify: `deno.json`

- [ ] **Step 1: Create `scripts/migrate.ts`**

```ts
import { getKv } from "@/database/db.ts";
import { HouseholdRepo } from "@/database/household.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { UserInterface } from "@/models/index.ts";

interface LegacyShoppingListItem {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

async function migrate() {
  const kv = await getKv();
  let migratedUsers = 0;
  let migratedItems = 0;

  for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
    const user = entry.value;

    // Skip secondary index entries and already-migrated users
    if (!user?.id || user.householdId) continue;

    console.log(`Migrating user: ${user.username}`);

    // 1. Create household
    const household = await HouseholdRepo.create(
      `${user.username}'s household`,
    );

    // 2. Update user with householdId
    const updatedUser: UserInterface = { ...user, householdId: household.id };
    await kv
      .atomic()
      .set(["users", user.id], updatedUser)
      .set(["users_by_username", user.username], updatedUser)
      .commit();

    // 3. Create default shopping list
    const list = await ShoppingListRepo.create({
      householdId: household.id,
      name: "Shopping List",
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    // 4. Migrate existing items from old key pattern to new
    for await (
      const itemEntry of kv.list<LegacyShoppingListItem>({
        prefix: ["shopping_list", user.id],
      })
    ) {
      const legacy = itemEntry.value;
      await ShoppingListItemRepo.add(list.id, legacy.itemId).then(
        async (newEntry) => {
          // Preserve existing quantity, note, checked state
          if (
            legacy.quantity !== 1 || legacy.note || legacy.checked
          ) {
            await ShoppingListItemRepo.update(list.id, newEntry.id, {
              quantity: legacy.quantity,
              note: legacy.note,
              checked: legacy.checked,
            });
          }
        },
      );
      await kv.delete(itemEntry.key);
      migratedItems++;
    }

    migratedUsers++;
    console.log(`  ✅ household: ${household.id}, list: ${list.id}`);
  }

  console.log(
    `\nMigration complete. Users: ${migratedUsers}, items: ${migratedItems}`,
  );
  kv.close();
}

if (import.meta.main) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    Deno.exit(1);
  });
}
```

- [ ] **Step 2: Add `db:migrate` task to `deno.json`**

In the `"tasks"` object, add:

```json
"db:migrate": "deno run --env-file --unstable-kv -A scripts/migrate.ts"
```

Full updated `"tasks"` block:

```json
"tasks": {
  "check": "deno fmt --check && deno lint && deno check",
  "dev": "deno run --env-file --unstable-kv -A vite",
  "build": "vite build",
  "preview": "deno serve --env-file --unstable-kv -A _fresh/server.js",
  "db:seed": "deno run --env-file --unstable-kv -A scripts/seed.ts",
  "db:migrate": "deno run --env-file --unstable-kv -A scripts/migrate.ts",
  "db:view": "deno run --env-file --unstable-kv -A scripts/db-viewer.ts",
  "update": "deno run -A -r jsr:@fresh/update ."
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate.ts deno.json
git commit -m "feat: add one-time migration script for household/list data model"
```

---

### Task 8: New API routes — shopping lists CRUD

**Files:**

- Create: `routes/api/shopping-lists.ts`
- Create: `routes/api/shopping-lists/[id]/index.ts`
- Delete: `routes/api/shopping-list.ts`

- [ ] **Step 1: Create `routes/api/shopping-lists.ts`**

```ts
import { Context } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";

interface State {
  userId?: string;
  householdId?: string;
}

export const handler = {
  async GET(ctx: Context<State>) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const lists = await ShoppingListRepo.getAll(householdId);
    return new Response(JSON.stringify(lists), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx: Context<State>) {
    const userId = ctx.state.userId;
    const householdId = ctx.state.householdId;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { name } = await ctx.req.json();
    if (!name?.trim()) return new Response("name required", { status: 400 });
    const list = await ShoppingListRepo.create({
      householdId,
      name: name.trim(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });
    return new Response(JSON.stringify(list), { status: 201 });
  },
};
```

- [ ] **Step 2: Create the directory and file
      `routes/api/shopping-lists/[id]/index.ts`**

```ts
import { Context } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";

interface State {
  householdId?: string;
}

export const handler = {
  async PATCH(ctx: Context<State>) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const id = ctx.params.id;
    const { name } = await ctx.req.json();
    if (!name?.trim()) return new Response("name required", { status: 400 });
    const list = await ShoppingListRepo.getById(householdId, id);
    if (!list) return new Response("Not found", { status: 404 });
    const updated = await ShoppingListRepo.update(householdId, id, {
      name: name.trim(),
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(ctx: Context<State>) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const id = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, id);
    if (!list) return new Response("Not found", { status: 404 });
    await ShoppingListItemRepo.deleteAll(id);
    await ShoppingListRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
};
```

- [ ] **Step 3: Delete the old route**

```bash
rm routes/api/shopping-list.ts
```

- [ ] **Step 4: Commit**

```bash
git add routes/api/shopping-lists.ts "routes/api/shopping-lists/[id]/index.ts"
git rm routes/api/shopping-list.ts
git commit -m "feat: add shopping-lists CRUD API routes, remove old shopping-list route"
```

---

### Task 9: New API route — shopping list items

**Files:**

- Create: `routes/api/shopping-lists/[id]/items.ts`

- [ ] **Step 1: Create `routes/api/shopping-lists/[id]/items.ts`**

```ts
import { Context } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";

interface State {
  householdId?: string;
}

async function authorizeList(ctx: Context<State>, listId: string) {
  const householdId = ctx.state.householdId;
  if (!householdId) return null;
  const list = await ShoppingListRepo.getById(householdId, listId);
  if (!list) return null;
  return list;
}

export const handler = {
  async GET(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const items = await ShoppingListItemRepo.getAll(list.id);
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { itemId } = await ctx.req.json();
    if (!itemId) return new Response("itemId required", { status: 400 });
    const entry = await ShoppingListItemRepo.add(list.id, itemId);
    return new Response(JSON.stringify(entry), { status: 201 });
  },

  async PATCH(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { id, quantity, note, checked } = await ctx.req.json();
    if (!id) return new Response("id required", { status: 400 });
    const updated = await ShoppingListItemRepo.update(list.id, id, {
      quantity,
      note,
      checked,
    });
    if (!updated) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { id } = await ctx.req.json();
    if (!id) return new Response("id required", { status: 400 });
    await ShoppingListItemRepo.delete(list.id, id);
    return new Response(null, { status: 204 });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add "routes/api/shopping-lists/[id]/items.ts"
git commit -m "feat: add shopping list items API route scoped to list"
```

---

### Task 10: Update services/api.ts

**Files:**

- Modify: `services/api.ts`

- [ ] **Step 1: Replace `services/api.ts`**

```ts
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { CreateItemDto } from "@/models/item/item.interface.ts";

export const api = {
  items: {
    create: async (item: CreateItemDto): Promise<ItemInterface | null> => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) return null;
      return res.json();
    },
    getAll: async (): Promise<ItemInterface[]> => {
      const res = await fetch("/api/items");
      if (!res.ok) return [];
      return res.json();
    },
    update: async (
      id: string,
      name: string,
      categoryId?: string,
    ): Promise<Required<ItemInterface> | null> => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, categoryId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  categories: {
    getAll: async (): Promise<CategoryInterface[]> => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  },
  shoppingLists: {
    getAll: async (): Promise<ShoppingListInterface[]> => {
      const res = await fetch("/api/shopping-lists");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (name: string): Promise<ShoppingListInterface | null> => {
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    rename: async (
      id: string,
      name: string,
    ): Promise<ShoppingListInterface | null> => {
      const res = await fetch(`/api/shopping-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
    },
  },
  shoppingList: {
    getAll: async (listId: string): Promise<ShoppingListItemInterface[]> => {
      const res = await fetch(`/api/shopping-lists/${listId}/items`);
      if (!res.ok) return [];
      return res.json();
    },
    add: async (
      listId: string,
      itemId: string,
    ): Promise<ShoppingListItemInterface | null> => {
      const res = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    patch: async (
      listId: string,
      id: string,
      patch: Partial<ShoppingListItemInterface>,
    ): Promise<void> => {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
    },
    delete: async (listId: string, id: string): Promise<void> => {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add services/api.ts
git commit -m "feat: update api service with shoppingLists CRUD and listId-scoped shoppingList methods"
```

---

### Task 11: Update useShoppingList hook and tests

**Files:**

- Modify: `hooks/useShoppingList.ts`
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Update `hooks/useShoppingList.ts`**

Add `listId` as the first parameter and thread it through all API calls:

```ts
import { computed, signal } from "@preact/signals";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { api } from "@/services/api.ts";

export function useShoppingList(
  listId: string,
  initialCatalog: ItemInterface[],
  initialList: ShoppingListItemInterface[],
  initialCategories: CategoryInterface[] = [],
) {
  const items = signal<ItemInterface[]>(initialCatalog || []);
  const list = signal<ShoppingListItemInterface[]>(
    (initialList || []).filter((li) => !li.checked),
  );
  const checkedItems = signal<ShoppingListItemInterface[]>(
    (initialList || []).filter((li) => li.checked),
  );
  const listItemsMap = computed(() => {
    const map = new Map<string, ShoppingListItemInterface>();
    for (const listItem of list.value) {
      map.set(listItem.itemId || "", listItem);
    }
    return map;
  });
  const exitingItems = signal<string[]>([]);
  const categories = signal<CategoryInterface[]>(initialCategories);
  const selectedCategoryId = signal<string>("");
  const pendingCount = signal<number>(0);

  const patchScheduler = createDebouncedMergeScheduler<
    ShoppingListItemInterface
  >({
    delayMs: 500,
    flush: async (id, patch) => {
      await api.shoppingList.patch(listId, id, patch);
    },
  });

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ) => {
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    patchScheduler.schedule(id, patch);
  };

  const _addToList = async (itemId: string): Promise<string | null> => {
    const entry = await api.shoppingList.add(listId, itemId);
    if (entry) {
      list.value = [...list.value, entry];
      return entry.id ?? null;
    }
    return null;
  };

  const addToList = async (itemId: string): Promise<string | null> => {
    pendingCount.value++;
    try {
      return await _addToList(itemId);
    } finally {
      pendingCount.value--;
    }
  };

  const addToCatalog = async (
    name: string,
    categoryId?: string,
  ): Promise<string | null> => {
    if (!name) return null;
    pendingCount.value++;
    try {
      const created = await api.items.create({ name, categoryId });
      if (created) {
        items.value = [...items.value, created];
        if (created.id) {
          return await _addToList(created.id);
        }
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const removeListItem = async (id: string) => {
    exitingItems.value = [...exitingItems.value, id];
    await new Promise((resolve) => setTimeout(resolve, 300));
    patchScheduler.cancel(id);
    list.value = list.value.filter((li) => li.id !== id);
    checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
    exitingItems.value = exitingItems.value.filter((itemId) => itemId !== id);
    pendingCount.value++;
    try {
      await api.shoppingList.delete(listId, id);
    } finally {
      pendingCount.value--;
    }
  };

  const checkItem = async (id: string) => {
    pendingCount.value++;
    exitingItems.value = [...exitingItems.value, id];
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const item = list.value.find((li) => li.id === id);
      if (!item) {
        exitingItems.value = exitingItems.value.filter((i) => i !== id);
        return;
      }
      patchScheduler.cancel(id);
      list.value = list.value.filter((li) => li.id !== id);
      exitingItems.value = exitingItems.value.filter((i) => i !== id);
      const checked = { ...item, checked: true };
      checkedItems.value = [...checkedItems.value, checked];
      await api.shoppingList.patch(listId, id, { checked: true });
    } finally {
      pendingCount.value--;
    }
  };

  const uncheckItem = async (id: string) => {
    pendingCount.value++;
    try {
      const item = checkedItems.value.find((li) => li.id === id);
      if (!item) return;
      checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
      const active = { ...item, checked: false };
      list.value = [...list.value, active];
      await api.shoppingList.patch(listId, id, { checked: false });
    } finally {
      pendingCount.value--;
    }
  };

  const refresh = async () => {
    pendingCount.value++;
    try {
      const [newList, newItems, newCategories] = await Promise.all([
        api.shoppingList.getAll(listId),
        api.items.getAll(),
        api.categories.getAll(),
      ]);
      list.value = newList.filter((li) => !li.checked);
      checkedItems.value = newList.filter((li) => li.checked);
      items.value = newItems;
      categories.value = newCategories;
    } finally {
      pendingCount.value--;
    }
  };

  const getItemName = (itemId?: string) =>
    items.value.find((i) => i.id === itemId)?.name || "Unknown";

  const getItem = (itemId?: string) => items.value.find((i) => i.id === itemId);

  const groupedList = computed(() => {
    type GroupedItems = {
      category: CategoryInterface | null;
      items: ShoppingListItemInterface[];
    };

    const categoryMap = new Map(
      categories.value.map((cat) => [cat.id, cat]),
    );

    const groups = new Map<string | undefined, ShoppingListItemInterface[]>();
    for (const listItem of list.value) {
      const item = getItem(listItem.itemId);
      const categoryId = item?.categoryId;
      if (!groups.has(categoryId)) groups.set(categoryId, []);
      groups.get(categoryId)!.push(listItem);
    }

    const result: GroupedItems[] = [];

    const categorizedGroups = Array.from(groups.entries())
      .filter(([catId]) =>
        catId !== undefined && catId !== null && catId !== ""
      )
      .map(([catId, groupItems]) => ({
        category: categoryMap.get(catId!) || null,
        items: groupItems.sort((a, b) =>
          getItemName(a.itemId).toLowerCase().localeCompare(
            getItemName(b.itemId).toLowerCase(),
          )
        ),
      }))
      .sort((a, b) => (a.category?.order ?? 999) - (b.category?.order ?? 999));

    result.push(...categorizedGroups);

    const uncategorized = groups.get(undefined) || groups.get("") || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        items: uncategorized.sort((a, b) =>
          getItemName(a.itemId).toLowerCase().localeCompare(
            getItemName(b.itemId).toLowerCase(),
          )
        ),
      });
    }

    return result;
  });

  return {
    items,
    list,
    checkedItems,
    exitingItems,
    pendingCount,
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    checkItem,
    uncheckItem,
    refresh,
    getItemName,
    groupedList,
    categories,
    selectedCategoryId,
    listItemsMap,
  };
}
```

- [ ] **Step 2: Update `hooks/useShoppingList.test.ts`**

Two changes needed:

1. `makeListItem` uses `userId` — replace with `listId`
2. Tests that capture `api.shoppingList.patch` call args now receive
   `(listId, id, patch)` — fix the index of `id` and `patch` in the captured
   `calls` array

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { api } from "@/services/api.ts";
import { useShoppingList } from "@/hooks/useShoppingList.ts";
import type {
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, name: string): ItemInterface {
  return { id, name };
}

function makeListItem(
  id: string,
  itemId: string,
  checked = false,
): ShoppingListItemInterface {
  return { id, itemId, listId: "list-1", quantity: 1, checked };
}

const TEST_LIST_ID = "list-1";

// ── init splitting ────────────────────────────────────────────────────────────

Deno.test("useShoppingList — initialises list with only unchecked items", () => {
  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
});

Deno.test("useShoppingList — initialises checkedItems with only checked items", () => {
  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-2");
});

// ── checkItem ─────────────────────────────────────────────────────────────────

Deno.test("checkItem — moves item from list to checkedItems", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.list.value, []);
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-1");
  assertEquals(hook.checkedItems.value[0].checked, true);
});

Deno.test("checkItem — item is in exitingItems during the 300ms animation", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");

  assertEquals(hook.exitingItems.value.includes("sl-1"), true);

  await time.tickAsync(300);
  await promise;

  assertEquals(hook.exitingItems.value.includes("sl-1"), false);
});

Deno.test("checkItem — calls api.shoppingList.patch with checked: true", async () => {
  const calls: Array<[string, string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (listId, id, patch) => {
      calls.push([listId, id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], TEST_LIST_ID);
  assertEquals(calls[0][1], "sl-1");
  assertEquals(calls[0][2], { checked: true });
});

// ── uncheckItem ───────────────────────────────────────────────────────────────

Deno.test("uncheckItem — moves item from checkedItems back to list", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.list.value.length, 0);

  await hook.uncheckItem("sl-1");

  assertEquals(hook.checkedItems.value, []);
  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
  assertEquals(hook.list.value[0].checked, false);
});

Deno.test("uncheckItem — calls api.shoppingList.patch with checked: false", async () => {
  const calls: Array<[string, string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (listId, id, patch) => {
      calls.push([listId, id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], TEST_LIST_ID);
  assertEquals(calls[0][1], "sl-1");
  assertEquals(calls[0][2], { checked: false });
});

// ── pendingCount ──────────────────────────────────────────────────────────────

Deno.test("pendingCount — starts at 0", () => {
  const hook = useShoppingList(TEST_LIST_ID, [], []);
  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — returns to 0 after uncheckItem completes", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — is > 0 while an API call is in flight", async () => {
  let resolveCall!: () => void;
  const slowPatch = new Promise<void>((resolve) => {
    resolveCall = resolve;
  });
  using _patch = stub(api.shoppingList, "patch", () => slowPatch);

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  const promise = hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 1);

  resolveCall();
  await promise;

  assertEquals(hook.pendingCount.value, 0);
});

// ── refresh ───────────────────────────────────────────────────────────────────

Deno.test("refresh — overwrites list and checkedItems from API", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () =>
      Promise.resolve([
        makeListItem("sl-new-1", "item-2", false),
        makeListItem("sl-new-2", "item-2", true),
      ]),
  );
  using _itemsGetAll = stub(
    api.items,
    "getAll",
    () => Promise.resolve([makeItem("item-2", "Eggs")]),
  );
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  assertEquals(hook.list.value.length, 1);

  await hook.refresh();

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-new-1");
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-new-2");
  assertEquals(hook.items.value[0].name, "Eggs");
});

Deno.test("refresh — pendingCount returns to 0 after completion", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () => Promise.resolve([]),
  );
  using _itemsGetAll = stub(api.items, "getAll", () => Promise.resolve([]));
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList(TEST_LIST_ID, [], []);

  await hook.refresh();

  assertEquals(hook.pendingCount.value, 0);
});

// ── addToList / addToCatalog return IDs ───────────────────────────────────────

Deno.test("addToList — returns the id of the created list entry", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-returned", "item-1", false),
      ),
  );

  const hook = useShoppingList(TEST_LIST_ID, [makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, "sl-returned");
});

Deno.test("addToList — returns null when API call fails", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () => Promise.resolve(null),
  );

  const hook = useShoppingList(TEST_LIST_ID, [makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, null);
});

Deno.test("checkItem — pendingCount returns to 0 after completion", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("addToList — appends entry to list", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-new", "item-1", false),
      ),
  );

  const hook = useShoppingList(TEST_LIST_ID, [makeItem("item-1", "Milk")], []);

  assertEquals(hook.list.value.length, 0);
  await hook.addToList("item-1");
  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-new");
});

// ── addToCatalog ──────────────────────────────────────────────────────────────

Deno.test("addToCatalog — adds item to catalog and list, returns list entry id", async () => {
  using _create = stub(
    api.items,
    "create",
    () =>
      Promise.resolve(
        makeItem("item-new", "Cheese"),
      ),
  );
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-new", "item-new", false),
      ),
  );

  const hook = useShoppingList(TEST_LIST_ID, [], []);

  const id = await hook.addToCatalog("Cheese");

  assertEquals(id, "sl-new");
  assertEquals(hook.items.value.length, 1);
  assertEquals(hook.items.value[0].name, "Cheese");
  assertEquals(hook.list.value.length, 1);
});

Deno.test("addToCatalog — returns null for empty name", async () => {
  const hook = useShoppingList(TEST_LIST_ID, [], []);
  const id = await hook.addToCatalog("");
  assertEquals(id, null);
});

Deno.test("addToCatalog — pendingCount returns to 0 after completion", async () => {
  using _create = stub(
    api.items,
    "create",
    () => Promise.resolve(makeItem("item-new", "Cheese")),
  );
  using _add = stub(
    api.shoppingList,
    "add",
    () => Promise.resolve(makeListItem("sl-new", "item-new", false)),
  );

  const hook = useShoppingList(TEST_LIST_ID, [], []);

  await hook.addToCatalog("Cheese");

  assertEquals(hook.pendingCount.value, 0);
});
```

- [ ] **Step 3: Run tests — they should all pass**

```bash
deno test hooks/useShoppingList.test.ts --allow-env
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add hooks/useShoppingList.ts hooks/useShoppingList.test.ts
git commit -m "feat: useShoppingList accepts listId, thread through all API calls"
```

---

### Task 12: Update islands/items.tsx

**Files:**

- Modify: `islands/items.tsx`

- [ ] **Step 1: Add `listId` prop to `islands/items.tsx`**

Change the `ItemsProps` interface and the `useMemo` call:

```ts
interface ItemsProps {
  listId: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  { listId, items: catalog, shoppingList, categories: initialCategories }: ItemsProps,
) {
  const {
    // ... same destructure as before
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [],
  );
  // ... rest unchanged
```

The only changes are: add `listId` to `ItemsProps`, add `listId` as a
destructured prop, and pass it as first arg to `useShoppingList`.

- [ ] **Step 2: Run type check**

```bash
deno check islands/items.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add islands/items.tsx
git commit -m "feat: pass listId through Items island to useShoppingList"
```

---

### Task 13: Shopping lists island

**Files:**

- Create: `islands/shopping-lists.tsx`

- [ ] **Step 1: Create `islands/shopping-lists.tsx`**

```tsx
import { signal } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";
import { ShoppingListInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";

interface ShoppingListsProps {
  initialLists: ShoppingListInterface[];
}

export default function ShoppingLists(
  { initialLists }: ShoppingListsProps,
) {
  const lists = signal<ShoppingListInterface[]>(initialLists);
  const newName = signal("");
  const editingId = signal<string | null>(null);
  const editName = signal("");
  const loading = signal(false);

  const createList = async () => {
    const name = newName.value.trim();
    if (!name) return;
    loading.value = true;
    try {
      const created = await api.shoppingLists.create(name);
      if (created) {
        lists.value = [...lists.value, created];
        newName.value = "";
      }
    } finally {
      loading.value = false;
    }
  };

  const startRename = (list: ShoppingListInterface) => {
    editingId.value = list.id;
    editName.value = list.name;
  };

  const confirmRename = async (id: string) => {
    const name = editName.value.trim();
    if (!name) return;
    const updated = await api.shoppingLists.rename(id, name);
    if (updated) {
      lists.value = lists.value.map((l) => l.id === id ? updated : l);
    }
    editingId.value = null;
  };

  const deleteList = async (id: string) => {
    await api.shoppingLists.delete(id);
    lists.value = lists.value.filter((l) => l.id !== id);
  };

  return (
    <div class="space-y-4">
      <Show
        when={() => lists.value.length > 0}
        fallback={
          <p class="text-gray-500 text-center py-8">
            No shopping lists yet. Create your first one below.
          </p>
        }
      >
        <ul class="space-y-2">
          <For each={lists}>
            {(list) => (
              <li
                key={list.id}
                class="flex items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl shadow-sm"
              >
                <Show
                  when={() => editingId.value === list.id}
                  fallback={
                    <>
                      <a
                        href={`/lists/${list.id}`}
                        class="flex-1 font-medium text-gray-800 text-lg"
                      >
                        {list.name}
                      </a>
                      <button
                        type="button"
                        class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => startRename(list)}
                        aria-label={`Rename ${list.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => deleteList(list.id)}
                        aria-label={`Delete ${list.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </>
                  }
                >
                  <input
                    type="text"
                    class="flex-1 border border-blue-300 rounded-lg px-3 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editName.value}
                    onInput={(e) => editName.value = e.currentTarget.value}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(list.id);
                      if (e.key === "Escape") editingId.value = null;
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    class="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium"
                    onClick={() => confirmRename(list.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm"
                    onClick={() => editingId.value = null}
                  >
                    Cancel
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="flex gap-2">
        <input
          type="text"
          placeholder="New list name"
          class="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newName.value}
          onInput={(e) => newName.value = e.currentTarget.value}
          onKeyDown={(e) => e.key === "Enter" && createList()}
          disabled={loading.value}
        />
        <button
          type="button"
          class="px-5 py-3 bg-blue-500 text-white font-medium rounded-xl shadow-sm active:scale-95 transition-transform disabled:opacity-50"
          onClick={createList}
          disabled={loading.value}
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
deno check islands/shopping-lists.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add islands/shopping-lists.tsx
git commit -m "feat: add ShoppingLists island with create/rename/delete and empty state"
```

---

### Task 14: New routes — lists overview and list detail

**Files:**

- Create: `routes/lists/index.tsx`
- Create: `routes/lists/[id]/index.tsx`
- Delete: `routes/home/index.tsx`

- [ ] **Step 1: Create `routes/lists/index.tsx`**

```tsx
import { page } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";
import ShoppingListsIsland from "@/islands/shopping-lists.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const lists = await ShoppingListRepo.getAll(householdId);
    return page({ lists });
  },
});

export default define.page<typeof handler>(function Lists({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Shopping Lists</h1>
      <ShoppingListsIsland initialLists={data.lists} />
    </main>
  );
});
```

- [ ] **Step 2: Create `routes/lists/[id]/index.tsx`**

```tsx
import { page } from "fresh";
import {
  CategoryRepo,
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
} from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const listId = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) {
      return new Response("Not found", { status: 404 });
    }
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
    return page({ list, items, shoppingList, categories });
  },
});

export default define.page<typeof handler>(function ListDetail({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <div class="flex items-center gap-3 mb-4">
        <a
          href="/lists"
          class="text-blue-500 text-sm font-medium hover:underline"
        >
          ← Lists
        </a>
        <h1 class="text-xl font-bold text-gray-900">{data.list.name}</h1>
      </div>
      <ItemsIsland
        listId={data.list.id}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
      />
    </main>
  );
});
```

- [ ] **Step 3: Delete the old home route**

```bash
rm routes/home/index.tsx
```

- [ ] **Step 4: Run type check**

```bash
deno check "routes/lists/index.tsx" "routes/lists/[id]/index.tsx"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "routes/lists/index.tsx" "routes/lists/[id]/index.tsx"
git rm routes/home/index.tsx
git commit -m "feat: add /lists overview and /lists/:id detail pages, remove /home"
```

---

### Task 15: Update routing and login redirect

**Files:**

- Modify: `routes/index.tsx`
- Modify: `routes/login.tsx`

- [ ] **Step 1: Update `routes/index.tsx`**

```ts
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  GET(_ctx) {
    const headers = new Headers();
    headers.set("location", "/lists");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
});
```

- [ ] **Step 2: Update the post-login redirect in `routes/login.tsx`**

Change the redirect from `"home"` to `"/lists"`:

```ts
headers.set("location", "/lists");
```

- [ ] **Step 3: Run full type check**

```bash
deno task check
```

Expected: all passing.

- [ ] **Step 4: Run tests**

```bash
deno test --allow-env
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add routes/index.tsx routes/login.tsx
git commit -m "feat: redirect / and post-login to /lists"
```

---

### Task 16: Final check and run migration

- [ ] **Step 1: Run full check and tests**

```bash
deno task check && deno test --allow-env
```

Expected: all passing.

- [ ] **Step 2: Run migration against local dev database**

```bash
deno task db:migrate
```

Expected output: migration summary, e.g.:

```
Migrating user: demo
  ✅ household: <uuid>, list: <uuid>

Migration complete. Users: 1, items: N
```

- [ ] **Step 3: Start dev server and verify**

```bash
deno task dev
```

Open `http://localhost:8000` — should redirect to `/lists`. Verify:

- Lists overview shows the default "Shopping List"
- Clicking the list opens `/lists/:id` with the existing items
- Adding/removing items still works
- Creating a new list works
- Renaming and deleting a list works
- Empty state appears when all lists are deleted

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: post-migration smoke test fixes"
```
