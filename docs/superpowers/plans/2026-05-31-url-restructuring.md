# URL Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all shopping feature routes under the `/shopping` prefix and all
shopping API routes under `/api/shopping/`, aligning URL structure with the
navigation hierarchy.

**Architecture:** Hard cut-over — no redirects. Route files are moved to new
paths, relative imports are upgraded to `@/` aliases where needed, and three
non-route files (`config/navigation.ts`, `services/api.ts`, `routes/index.tsx`)
are updated to use the new paths. Navigation config tests are updated first
(TDD) before touching the config itself.

**Tech Stack:** Deno, Fresh 2, Preact, Tailwind CSS v4

---

## File Map

| Action             | Before                                    | After                                      |
| ------------------ | ----------------------------------------- | ------------------------------------------ |
| Move + update      | `routes/lists/index.tsx`                  | `routes/shopping/index.tsx`                |
| Move + update      | `routes/lists/[id]/index.tsx`             | `routes/shopping/[id]/index.tsx`           |
| Move               | `routes/items/index.tsx`                  | `routes/shopping/catalogue/index.tsx`      |
| Move               | `routes/items/new.tsx`                    | `routes/shopping/catalogue/new.tsx`        |
| Move               | `routes/items/detail/[id]/index.tsx`      | `routes/shopping/catalogue/[id]/index.tsx` |
| Move + update      | `routes/items/detail/[id]/edit.tsx`       | `routes/shopping/catalogue/[id]/edit.tsx`  |
| Move               | `routes/items/overview.tsx`               | `routes/shopping/catalogue/overview.tsx`   |
| Move               | `routes/categories/manage.tsx`            | `routes/shopping/categories/index.tsx`     |
| Move + fix imports | `routes/api/shopping-lists.ts`            | `routes/api/shopping/lists.ts`             |
| Move + fix imports | `routes/api/shopping-lists/[id]/index.ts` | `routes/api/shopping/lists/[id]/index.ts`  |
| Move + fix imports | `routes/api/shopping-lists/[id]/items.ts` | `routes/api/shopping/lists/[id]/items.ts`  |
| Move + fix imports | `routes/api/items.ts`                     | `routes/api/shopping/catalogue.ts`         |
| Move + fix imports | `routes/api/categories.ts`                | `routes/api/shopping/categories.ts`        |
| Modify             | `config/navigation.ts`                    | same path                                  |
| Modify             | `config/navigation.test.ts`               | same path                                  |
| Modify             | `services/api.ts`                         | same path                                  |
| Modify             | `routes/index.tsx`                        | same path                                  |

---

## Task 1: Update navigation config (TDD)

**Files:**

- Modify: `config/navigation.test.ts`
- Modify: `config/navigation.ts`

- [ ] **Step 1: Replace the tests to use the new `/shopping` routes**

  Replace the full contents of `config/navigation.test.ts`:

  ```ts
  import { assertEquals } from "jsr:@std/assert@^1.0.19";
  import { resolveActiveTab } from "@/config/navigation.ts";

  Deno.test("resolveActiveTab — /shopping matches shopping", () => {
    assertEquals(resolveActiveTab("/shopping")?.id, "shopping");
  });

  Deno.test("resolveActiveTab — /shopping/catalogue matches shopping", () => {
    assertEquals(resolveActiveTab("/shopping/catalogue")?.id, "shopping");
  });

  Deno.test("resolveActiveTab — /shopping/categories matches shopping", () => {
    assertEquals(resolveActiveTab("/shopping/categories")?.id, "shopping");
  });

  Deno.test("resolveActiveTab — /shopping/some-id matches shopping via prefix", () => {
    assertEquals(resolveActiveTab("/shopping/some-id")?.id, "shopping");
  });

  Deno.test("resolveActiveTab — /shopping/catalogue/new matches shopping via deep prefix", () => {
    assertEquals(resolveActiveTab("/shopping/catalogue/new")?.id, "shopping");
  });

  Deno.test("resolveActiveTab — /login matches no tab", () => {
    assertEquals(resolveActiveTab("/login"), undefined);
  });

  Deno.test("resolveActiveTab — /shoppingExtra does not match (false-positive guard)", () => {
    assertEquals(resolveActiveTab("/shoppingExtra"), undefined);
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  deno test config/navigation.test.ts
  ```

  Expected: 6 failures (all tests using `"shopping"` as the expected id fail
  because `NAV_CONFIG` still has `id: "shopping-lists"` and
  `routes: ["/lists", "/items", "/categories"]`).

- [ ] **Step 3: Update `config/navigation.ts`**

  Replace the full contents of `config/navigation.ts`:

  ```ts
  export interface SubNavItem {
    label: string;
    route: string;
  }

  export interface NavItem {
    id: string;
    label: string;
    icon: string;
    defaultRoute: string;
    routes: string[];
    subNav: SubNavItem[];
  }

  export const NAV_CONFIG: NavItem[] = [
    {
      id: "shopping",
      label: "Shopping",
      icon: "🛒",
      defaultRoute: "/shopping",
      routes: ["/shopping"],
      subNav: [
        { label: "My Lists", route: "/shopping" },
        { label: "Item Catalogue", route: "/shopping/catalogue" },
        { label: "Categories", route: "/shopping/categories" },
      ],
    },
  ];

  export function resolveActiveTab(pathname: string): NavItem | undefined {
    return NAV_CONFIG.find((item) =>
      item.routes.some(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      )
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```
  deno test config/navigation.test.ts
  ```

  Expected: `ok | 7 passed | 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add config/navigation.ts config/navigation.test.ts
  git commit -m "feat(navigation): update NAV_CONFIG to /shopping prefix"
  ```

---

## Task 2: Move shopping list page routes

**Files:**

- Create: `routes/shopping/index.tsx`
- Create: `routes/shopping/[id]/index.tsx`
- Delete: `routes/lists/index.tsx`
- Delete: `routes/lists/[id]/index.tsx`

- [ ] **Step 1: Create `routes/shopping/index.tsx`**

  Content is identical to `routes/lists/index.tsx` — no internal URL references
  to update:

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

- [ ] **Step 2: Create `routes/shopping/[id]/index.tsx`**

  Update the back-link `href` from `/lists` to `/shopping`:

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
            href="/shopping"
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

- [ ] **Step 3: Run type check**

  ```
  deno task check
  ```

  Expected: no errors.

- [ ] **Step 4: Commit — add new files and remove old ones atomically**

  ```bash
  git add routes/shopping/
  git rm routes/lists/index.tsx "routes/lists/[id]/index.tsx"
  git commit -m "feat(navigation): move shopping list routes to /shopping"
  ```

---

## Task 3: Move catalogue page routes

**Files:**

- Create: `routes/shopping/catalogue/index.tsx`
- Create: `routes/shopping/catalogue/new.tsx`
- Create: `routes/shopping/catalogue/[id]/index.tsx`
- Create: `routes/shopping/catalogue/[id]/edit.tsx`
- Create: `routes/shopping/catalogue/overview.tsx`
- Delete: `routes/items/` (entire directory)

- [ ] **Step 1: Create `routes/shopping/catalogue/index.tsx`**

  Content identical to `routes/items/index.tsx`:

  ```tsx
  import { page } from "fresh";
  import { CategoryRepo, ItemRepo } from "@/database/index.ts";
  import ItemCatalog from "@/islands/item-catalog.tsx";
  import { define } from "@/utils/index.ts";

  export const handler = define.handlers({
    async GET(_ctx) {
      const items = await ItemRepo.readAll();
      const categories = await CategoryRepo.getAll();
      return page({ items, categories });
    },
  });

  export default define.page<typeof handler>(function Items({ data }) {
    return (
      <main class="max-w-4xl mx-auto p-4">
        <div class="mb-6">
          <h1 class="text-2xl font-bold mb-2">Item Catalog</h1>
          <p class="text-gray-600">
            Manage your shopping items and categories.
          </p>
        </div>
        <ItemCatalog items={data.items} categories={data.categories} />
      </main>
    );
  });
  ```

- [ ] **Step 2: Create `routes/shopping/catalogue/new.tsx`**

  Content identical to `routes/items/new.tsx` — the redirect target
  `detail/${id}` is relative so it keeps working:

  ```tsx
  import { PageProps } from "fresh";
  import { getKv } from "@/database/index.ts";
  import { type CreateItemDto, Item } from "@/models/index.ts";
  import { Handlers } from "fresh/compat";

  export const handler: Handlers = {
    async GET(ctx) {
      return await ctx.render();
    },
    async POST(ctx) {
      const req = ctx.req;
      const form = await req.formData();
      const name = form.get("name")?.toString();

      const id = 111;
      const item: CreateItemDto = new Item(name || "unknown");
      const kv = await getKv();
      const _result = await kv.set(["items", id], item);

      const headers = new Headers();
      headers.set("location", `detail/${id}`);

      return new Response(null, {
        status: 303,
        headers,
      });
    },
  };

  export default function ItemNewPage(_props: PageProps) {
    return (
      <main>
        <h1>Nieuw item</h1>
        <p>Maak een nieuw item.</p>

        <form method="post">
          <input type="text" placeholder="naam van het product" name="name" />
          <button type="submit">Opslaan</button>
        </form>
      </main>
    );
  }
  ```

- [ ] **Step 3: Create `routes/shopping/catalogue/[id]/index.tsx`**

  Content identical to `routes/items/detail/[id]/index.tsx`:

  ```tsx
  import { type Context } from "fresh";
  import { getKv } from "@/database/index.ts";
  import { Button } from "@/components/Button.tsx";
  import type { ItemInterface } from "@/models/index.ts";
  import { Handlers } from "fresh/compat";

  interface Data {
    item: ItemInterface | null;
  }

  export const handler: Handlers<Data> = {
    async GET(ctx) {
      const id = +ctx.params.id;
      const kv = await getKv();
      const dbItem = await kv.get<ItemInterface>(["items", id]);
      return await ctx.render({ item: dbItem.value });
    },
  };

  export default async function ItemDetailPage(ctx: Context<Data>) {
    const id = +ctx.params.id;
    const kv = await getKv();
    const dbItem = await kv.get<ItemInterface>(["items", id]);
    const { value: item } = dbItem || {};
    const deleteItem = async () => {
      if (!item?.id) return;
      await kv.delete(["items", item.id]);
    };

    return (
      <main>
        <h1>Item "{item?.name}"</h1>
        <p>This is the item detail page.</p>
        <p>naam: {item?.name}</p>
        <a href={`${item?.id}/edit`}>Pas aan</a>
        <Button onClick={deleteItem}>verwijderen</Button>
      </main>
    );
  }
  ```

- [ ] **Step 4: Create `routes/shopping/catalogue/[id]/edit.tsx`**

  Update the redirect URL from `/items/detail/${newItem.id}` to
  `/shopping/catalogue/${newItem.id}`:

  ```tsx
  import { PageProps } from "fresh";
  import { getKv, ItemRepo } from "@/database/index.ts";
  import {
    type CreateItemDto,
    Item,
    type ItemInterface,
  } from "@/models/index.ts";
  import { Handlers } from "fresh/compat";

  interface Data {
    item: ItemInterface | null;
  }

  export const handler: Handlers<Data> = {
    async GET(ctx) {
      const id = +ctx.params.id;
      const kv = await getKv();
      const dbItem = await kv.get<ItemInterface>(["items", id]);
      return await ctx.render({ item: dbItem.value });
    },
    async POST(_ctx) {
      const req = ctx.req;
      const form = await req.formData();
      const name = form.get("name")?.toString();

      const item: CreateItemDto = new Item(name || "unknown");
      const newItem = await ItemRepo.create(item);

      const headers = new Headers();
      headers.set("location", `/shopping/catalogue/${newItem.id}`);

      return new Response(null, {
        status: 303,
        headers,
      });
    },
  };

  export default function ItemDetailPage({ data }: PageProps<Data>) {
    const { item } = data || {};
    return (
      <main>
        <h1>Editeer item</h1>
        <p>Editeer een bestaand item.</p>

        <form method="post">
          <input
            type="text"
            placeholder="naam van het product"
            name="name"
            value={item?.name}
          />
          <button type="submit">Opslaan</button>
        </form>
      </main>
    );
  }
  ```

- [ ] **Step 5: Create `routes/shopping/catalogue/overview.tsx`**

  Content identical to `routes/items/overview.tsx` — relative hrefs keep
  working:

  ```tsx
  import { PageProps } from "fresh";
  import { getKv } from "@/database/index.ts";
  import type { ItemInterface } from "@/models/index.ts";
  import { Handlers } from "fresh/compat";

  interface Data {
    items: ItemInterface[] | null;
  }

  export const handler: Handlers<Data> = {
    async GET(ctx) {
      const kv = await getKv();
      const dbItems: Deno.KvListIterator<ItemInterface> = kv.list<
        ItemInterface
      >(
        { prefix: ["items"] },
      );
      const items = [];
      for await (const res of dbItems) {
        items.push({ ...res.key, ...res.value });
      }
      return await ctx.render({ items });
    },
  };

  export default function ItemsOverviewPage({ data }: PageProps<Data>) {
    const { items } = data;
    return (
      <main>
        <h1>Items</h1>
        <p>Een overzicht van alle items</p>
        <ul>
          {(items || []).map((item) => (
            <li key={item.id}>
              <a href={`detail/${item.id}`}>{item.name}</a>
            </li>
          ))}
        </ul>
        <a href="new">Nieuw</a>
      </main>
    );
  }
  ```

- [ ] **Step 6: Run type check**

  ```
  deno task check
  ```

  Expected: no errors.

- [ ] **Step 7: Commit — add new files and remove old ones atomically**

  ```bash
  git add routes/shopping/catalogue/
  git rm routes/items/index.tsx routes/items/new.tsx routes/items/overview.tsx
  git rm "routes/items/detail/[id]/index.tsx" "routes/items/detail/[id]/edit.tsx"
  git commit -m "feat(navigation): move catalogue routes to /shopping/catalogue"
  ```

---

## Task 4: Move categories page route

**Files:**

- Create: `routes/shopping/categories/index.tsx`
- Delete: `routes/categories/manage.tsx`

- [ ] **Step 1: Create `routes/shopping/categories/index.tsx`**

  Content identical to `routes/categories/manage.tsx`:

  ```tsx
  import { page } from "fresh";
  import { CategoryRepo } from "@/database/index.ts";
  import CategoryManagement from "@/islands/category-management.tsx";
  import { define } from "@/utils/index.ts";

  export const handler = define.handlers({
    async GET(_ctx) {
      const categories = await CategoryRepo.getAll();
      return page({ categories });
    },
  });

  export default define.page<typeof handler>(function ManageCategories(
    { data },
  ) {
    return (
      <main class="max-w-2xl mx-auto p-4">
        <div class="mb-6">
          <h1 class="text-2xl font-bold mb-2">Manage Categories</h1>
          <p class="text-gray-600">
            Create, edit, and reorder item categories for your shopping list.
          </p>
        </div>
        <CategoryManagement categories={data.categories} />
      </main>
    );
  });
  ```

- [ ] **Step 2: Run type check**

  ```
  deno task check
  ```

  Expected: no errors.

- [ ] **Step 3: Commit — add new file and remove old one atomically**

  ```bash
  git add routes/shopping/categories/
  git rm routes/categories/manage.tsx
  git commit -m "feat(navigation): move categories route to /shopping/categories"
  ```

---

## Task 5: Move API routes

**Files:**

- Create: `routes/api/shopping/lists.ts`
- Create: `routes/api/shopping/lists/[id]/index.ts`
- Create: `routes/api/shopping/lists/[id]/items.ts`
- Create: `routes/api/shopping/catalogue.ts`
- Create: `routes/api/shopping/categories.ts`
- Delete: `routes/api/shopping-lists.ts`,
  `routes/api/shopping-lists/[id]/index.ts`,
  `routes/api/shopping-lists/[id]/items.ts`, `routes/api/items.ts`,
  `routes/api/categories.ts`

**Note:** `routes/api/items.ts` and `routes/api/categories.ts` use relative
imports (`../../database/...`) that break at the new deeper path. Switch them to
`@/` alias imports.

- [ ] **Step 1: Create `routes/api/shopping/lists.ts`**

  Content identical to `routes/api/shopping-lists.ts` (already uses `@/`
  imports):

  ```ts
  import { ShoppingListRepo } from "@/database/index.ts";
  import { define } from "@/utils/index.ts";

  export const handler = define.handlers({
    async GET(ctx) {
      const householdId = ctx.state.householdId;
      if (!householdId) return new Response("Unauthorized", { status: 401 });
      const lists = await ShoppingListRepo.getAll(householdId);
      return new Response(JSON.stringify(lists), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },

    async POST(ctx) {
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
      return new Response(JSON.stringify(list), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  ```

- [ ] **Step 2: Create `routes/api/shopping/lists/[id]/index.ts`**

  Content identical to `routes/api/shopping-lists/[id]/index.ts` (already uses
  `@/` imports):

  ```ts
  import { type Context } from "fresh";
  import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
  import { define, type StateInterface } from "@/utils/index.ts";

  async function authorizeList(
    ctx: Context<StateInterface>,
    listId: string,
  ) {
    const householdId = ctx.state.householdId;
    if (!householdId) return null;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) return null;
    return list;
  }

  export const handler = define.handlers({
    async PATCH(ctx) {
      const list = await authorizeList(ctx, ctx.params.id);
      if (!list) return new Response("Not found", { status: 404 });
      const { name } = await ctx.req.json();
      if (!name?.trim()) return new Response("name required", { status: 400 });
      const updated = await ShoppingListRepo.update(
        ctx.state.householdId!,
        list.id,
        { name: name.trim() },
      );
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },

    async DELETE(ctx) {
      const list = await authorizeList(ctx, ctx.params.id);
      if (!list) return new Response("Not found", { status: 404 });
      await ShoppingListItemRepo.deleteAll(list.id);
      await ShoppingListRepo.delete(ctx.state.householdId!, list.id);
      return new Response(null, { status: 204 });
    },
  });
  ```

- [ ] **Step 3: Create `routes/api/shopping/lists/[id]/items.ts`**

  Content identical to `routes/api/shopping-lists/[id]/items.ts` (already uses
  `@/` imports):

  ```ts
  import { type Context } from "fresh";
  import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
  import { define, type StateInterface } from "@/utils/index.ts";

  async function authorizeList(
    ctx: Context<StateInterface>,
    listId: string,
  ) {
    const householdId = ctx.state.householdId;
    if (!householdId) return null;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) return null;
    return list;
  }

  export const handler = define.handlers({
    async GET(ctx) {
      const list = await authorizeList(ctx, ctx.params.id);
      if (!list) return new Response("Forbidden", { status: 403 });
      const items = await ShoppingListItemRepo.getAll(list.id);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },

    async POST(ctx) {
      const list = await authorizeList(ctx, ctx.params.id);
      if (!list) return new Response("Forbidden", { status: 403 });
      const { itemId } = await ctx.req.json();
      if (!itemId) return new Response("itemId required", { status: 400 });
      const entry = await ShoppingListItemRepo.add(list.id, itemId);
      return new Response(JSON.stringify(entry), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },

    async PATCH(ctx) {
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
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },

    async DELETE(ctx) {
      const list = await authorizeList(ctx, ctx.params.id);
      if (!list) return new Response("Forbidden", { status: 403 });
      const { id } = await ctx.req.json();
      if (!id) return new Response("id required", { status: 400 });
      await ShoppingListItemRepo.delete(list.id, id);
      return new Response(null, { status: 204 });
    },
  });
  ```

- [ ] **Step 4: Create `routes/api/shopping/catalogue.ts`**

  Same logic as `routes/api/items.ts`, but switch to `@/` imports (the old
  relative `../../database/item.repo.ts` would be wrong at the new path):

  ```ts
  import { type Context } from "fresh";
  import { ItemRepo } from "@/database/item.repo.ts";

  export const handler = {
    async POST(_ctx: Context<unknown>) {
      const req = _ctx.req;
      const item = await req.json();
      if (item.id) {
        const existingItem = await ItemRepo.getById(item.id);
        if (!existingItem) {
          return new Response("Item not found", { status: 404 });
        }
        await ItemRepo.update(item.id, item);
        return new Response(JSON.stringify({ ...existingItem, ...item }), {
          status: 200,
        });
      }
      const saved = await ItemRepo.create(item);
      return new Response(JSON.stringify(saved), { status: 201 });
    },
    async GET(_ctx: Context<unknown>) {
      const items = await ItemRepo.readAll();
      return new Response(
        JSON.stringify(items),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
    async DELETE(_ctx: Context<unknown>) {
      const req = _ctx.req;
      const { id } = await req.json();
      if (!id) {
        return new Response("ID is required", { status: 400 });
      }
      await ItemRepo.delete(id);
      return new Response(null, { status: 204 });
    },
  };
  ```

- [ ] **Step 5: Create `routes/api/shopping/categories.ts`**

  Same logic as `routes/api/categories.ts`, but switch to `@/` imports:

  ```ts
  import { type Context } from "fresh";
  import { CategoryRepo } from "@/database/category.repo.ts";

  interface State {
    userId?: string;
  }

  export const handler = {
    async GET(_ctx: Context<State>) {
      const categories = await CategoryRepo.getAll();
      return new Response(
        JSON.stringify(categories),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },

    async POST(_ctx: Context<State>) {
      const userId = _ctx.state.userId;
      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }
      const req = _ctx.req;
      const { label } = await req.json();
      if (!label || typeof label !== "string" || label.trim() === "") {
        return new Response("Label is required", { status: 400 });
      }
      const category = await CategoryRepo.create(label.trim(), userId);
      return new Response(JSON.stringify(category), { status: 201 });
    },

    async PATCH(_ctx: Context<State>) {
      const userId = _ctx.state.userId;
      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }
      const req = _ctx.req;
      const body = await req.json();
      if (Array.isArray(body)) {
        try {
          await CategoryRepo.reorder(body);
          return new Response(null, { status: 204 });
        } catch (error: unknown) {
          const message = error instanceof Error
            ? error.message
            : "Reorder failed";
          return new Response(message, { status: 500 });
        }
      }
      const { id, label, order } = body;
      if (!id) {
        return new Response("ID is required", { status: 400 });
      }
      const patch: Partial<{ label: string; order: number }> = {};
      if (label !== undefined) patch.label = label;
      if (order !== undefined) patch.order = order;
      const updated = await CategoryRepo.update(id, patch);
      if (!updated) {
        return new Response("Category not found", { status: 404 });
      }
      return new Response(JSON.stringify(updated), { status: 200 });
    },

    async DELETE(_ctx: Context<State>) {
      const userId = _ctx.state.userId;
      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }
      const req = _ctx.req;
      const { id } = await req.json();
      if (!id) {
        return new Response("ID is required", { status: 400 });
      }
      await CategoryRepo.delete(id);
      return new Response(null, { status: 204 });
    },
  };
  ```

- [ ] **Step 6: Delete the old API route files**

  ```bash
  git rm routes/api/shopping-lists.ts
  git rm "routes/api/shopping-lists/[id]/index.ts" "routes/api/shopping-lists/[id]/items.ts"
  git rm routes/api/items.ts routes/api/categories.ts
  ```

- [ ] **Step 7: Run type check**

  ```
  deno task check
  ```

  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add routes/api/shopping/
  git commit -m "feat(navigation): move API routes to /api/shopping/"
  ```

---

## Task 6: Update services/api.ts and routes/index.tsx

**Files:**

- Modify: `services/api.ts`
- Modify: `routes/index.tsx`

- [ ] **Step 1: Update `services/api.ts`**

  Replace the full contents:

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
        const res = await fetch("/api/shopping/catalogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!res.ok) return null;
        return res.json();
      },
      getAll: async (): Promise<ItemInterface[]> => {
        const res = await fetch("/api/shopping/catalogue");
        if (!res.ok) return [];
        return res.json();
      },
      update: async (
        id: string,
        name: string,
        categoryId?: string,
      ): Promise<Required<ItemInterface> | null> => {
        const res = await fetch("/api/shopping/catalogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, categoryId }),
        });
        if (!res.ok) return null;
        return res.json();
      },
      delete: async (id: string): Promise<void> => {
        await fetch("/api/shopping/catalogue", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      },
    },
    categories: {
      getAll: async (): Promise<CategoryInterface[]> => {
        const res = await fetch("/api/shopping/categories");
        if (!res.ok) return [];
        return res.json();
      },
    },
    shoppingLists: {
      getAll: async (): Promise<ShoppingListInterface[]> => {
        const res = await fetch("/api/shopping/lists");
        if (!res.ok) return [];
        return res.json();
      },
      create: async (name: string): Promise<ShoppingListInterface | null> => {
        const res = await fetch("/api/shopping/lists", {
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
        const res = await fetch(`/api/shopping/lists/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) return null;
        return res.json();
      },
      delete: async (id: string): Promise<void> => {
        await fetch(`/api/shopping/lists/${id}`, { method: "DELETE" });
      },
    },
    shoppingList: {
      getItems: async (
        listId: string,
      ): Promise<ShoppingListItemInterface[]> => {
        const res = await fetch(`/api/shopping/lists/${listId}/items`);
        if (!res.ok) return [];
        return res.json();
      },
      addItem: async (
        listId: string,
        itemId: string,
      ): Promise<ShoppingListItemInterface | null> => {
        const res = await fetch(`/api/shopping/lists/${listId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        if (!res.ok) return null;
        return res.json();
      },
      updateItem: async (
        listId: string,
        id: string,
        patch: Partial<ShoppingListItemInterface>,
      ): Promise<void> => {
        await fetch(`/api/shopping/lists/${listId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
      },
      removeItem: async (listId: string, id: string): Promise<void> => {
        await fetch(`/api/shopping/lists/${listId}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      },
    },
  };
  ```

- [ ] **Step 2: Update `routes/index.tsx`**

  Change the redirect from `/lists` to `/shopping`:

  ```ts
  import { define } from "@/utils/index.ts";

  export const handler = define.handlers({
    GET(_ctx) {
      const headers = new Headers();
      headers.set("location", "/shopping");
      return new Response(null, {
        status: 303,
        headers,
      });
    },
  });
  ```

- [ ] **Step 3: Run all tests**

  ```
  deno test
  ```

  Expected: `ok | 50 passed | 0 failed` (the navigation config tests now pass
  with the new routes; all other tests are unaffected).

- [ ] **Step 4: Run type check**

  ```
  deno task check
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add services/api.ts routes/index.tsx
  git commit -m "feat(navigation): update API service URLs and root redirect to /shopping"
  ```

---

## Done

All routes now live under `/shopping` (page) and `/api/shopping/` (API). The old
`/lists`, `/items`, `/categories`, and `/api/shopping-lists`, `/api/items`,
`/api/categories` paths no longer exist.
