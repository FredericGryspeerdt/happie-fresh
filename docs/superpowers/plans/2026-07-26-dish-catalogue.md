# Dish Catalogue (CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a household dish catalogue in the Menu module with full CRUD, structured tag groups, catalogue-item ingredient references, and faceted filtering — the data foundation for the meal-suggestion system (#14).

**Architecture:** Mirror the existing shopping-catalogue stack (model → repo → API route → client wrapper → signals hook → island). Dishes and tag groups are new global Deno KV collections. The `/menu` route (today a `ComingSoon`) becomes the dish list; a full-screen editor route handles create/view/edit/delete. Optimistic client writes reuse the `beginBusy/endBusy` loading integration.

**Tech Stack:** Deno + Fresh 2 (`jsr:@fresh/core@^2.2.0`) + Preact + `@preact/signals` + Deno KV (`--unstable-kv`) + Tailwind CSS v4. Tests via `deno test --unstable-kv -A` with `jsr:@std/assert` and `npm:preact-render-to-string`.

## Global Constraints

- Imports use the `@/` project-root alias (e.g. `import { db } from "@/database/db.ts"`).
- JSX uses `class`, never `className` (`jsx: "precompile"`).
- Inside island component bodies use `useSignal()` (never bare `signal()`); bare `signal()` is only for module scope or inside a hook that the island calls once via `useMemo(() => useHook(...), [])` (the established `useCatalogue` pattern).
- Repositories are the only KV access point; never call `Deno.openKv()` in routes. KV key pattern `["collection", id]`; IDs via `crypto.randomUUID()`.
- Partial updates go through `mergeDefinedPatch(existing, patch)` so omitted fields are never clobbered.
- Per CLAUDE.md, before writing Fresh 2 handler code or Deno KV calls, verify current signatures via Context7 (`resolve-library-id` → `query-docs`). The code below matches the in-repo patterns (`routes/api/shopping/catalogue.ts`, `database/category.repo.ts`); use Context7 to confirm nothing has drifted.
- Commits follow Conventional Commits; scope `menu` (e.g. `feat(menu): ...`).
- Storage is **global** (not household-scoped) to match the existing catalogue; per-household scoping is deferred to #42. Full tag-group management (create/rename/delete groups, rename/delete values) is deferred to #43.
- Gates for the whole feature: `deno task check`, `deno task test`, `deno task build` all green.

---

### Task 1: Dish model + `DishRepo`

**Files:**
- Create: `models/dish/dish.interface.ts`
- Create: `models/dish/index.ts`
- Modify: `models/index.ts` (add dish export)
- Create: `database/dish.repo.ts`
- Modify: `database/index.ts` (export `DishRepo`)
- Test: `database/dish.repo.test.ts`

**Interfaces:**
- Produces:
  - `DishInterface { id: string; name: string; ingredientIds: string[]; tagValueIds: string[]; createdAt?: string; createdBy?: string }`
  - `CreateDishDto = Omit<DishInterface, "id">`
  - `UpdateDishDto = Pick<DishInterface, "id"> & Partial<Omit<DishInterface, "id">>`
  - `DishRepo.create(dish: CreateDishDto): Promise<DishInterface>`
  - `DishRepo.readAll(): Promise<DishInterface[]>`
  - `DishRepo.getById(id: string): Promise<DishInterface | null>`
  - `DishRepo.update(id: string, patch: Partial<DishInterface>): Promise<DishInterface | null>`
  - `DishRepo.delete(id: string): Promise<void>`

- [ ] **Step 1: Create the model files**

`models/dish/dish.interface.ts`:
```ts
export interface DishInterface {
  id: string;
  name: string;
  ingredientIds: string[]; // → catalogue Item ids (["items", id])
  tagValueIds: string[]; // → DishTagValue ids, flat across all groups
  createdAt?: string;
  createdBy?: string;
}

// Derived type for creation (no ID)
export type CreateDishDto = Omit<DishInterface, "id">;

// Derived type for updating (ID + partial fields)
export type UpdateDishDto =
  & Pick<DishInterface, "id">
  & Partial<Omit<DishInterface, "id">>;
```

`models/dish/index.ts`:
```ts
export * from "./dish.interface.ts";
```

Add to `models/index.ts` (append):
```ts
export * from "./dish/index.ts";
```

- [ ] **Step 2: Write the failing repo test**

`database/dish.repo.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { DishRepo } from "@/database/dish.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearDishes() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dishes"] })) await kv.delete(e.key);
}

Deno.test({
  name: "create + getById — round-trips fields and assigns id + createdAt",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await DishRepo.create({
      name: "Pasta Bolognese",
      ingredientIds: ["i1", "i2"],
      tagValueIds: ["meat", "main"],
    });
    assertEquals(typeof created.id, "string");
    assertEquals(typeof created.createdAt, "string");
    const fetched = await DishRepo.getById(created.id);
    assertEquals(fetched?.name, "Pasta Bolognese");
    assertEquals(fetched?.ingredientIds, ["i1", "i2"]);
    assertEquals(fetched?.tagValueIds, ["meat", "main"]);
  },
});

Deno.test({
  name: "update — partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create({
      name: "Curry",
      ingredientIds: ["i1"],
      tagValueIds: ["veg"],
    });
    const updated = await DishRepo.update(d.id, { name: "Veggie Curry" });
    assertEquals(updated?.name, "Veggie Curry");
    assertEquals(updated?.ingredientIds, ["i1"]); // untouched
    assertEquals(updated?.tagValueIds, ["veg"]); // untouched
  },
});

Deno.test({
  name: "update — returns null for a missing dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    assertEquals(await DishRepo.update("nope", { name: "x" }), null);
  },
});

Deno.test({
  name: "delete — removes the dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create({
      name: "Toast",
      ingredientIds: [],
      tagValueIds: [],
    });
    await DishRepo.delete(d.id);
    assertEquals(await DishRepo.getById(d.id), null);
    assertEquals(await DishRepo.readAll(), []);
  },
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `deno test --unstable-kv -A database/dish.repo.test.ts`
Expected: FAIL — `Module not found "database/dish.repo.ts"`.

- [ ] **Step 4: Implement `DishRepo`**

`database/dish.repo.ts`:
```ts
import { CreateDishDto, DishInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

export class DishRepo {
  static async create(dish: CreateDishDto): Promise<DishInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const record: DishInterface = {
      ...dish,
      id,
      createdAt: dish.createdAt ?? new Date().toISOString(),
    };
    const ok = await kv.atomic().set(["dishes", id], record).commit();
    if (!ok) throw new Error("Failed to create dish.");
    return record;
  }

  static async readAll(): Promise<DishInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishInterface>({ prefix: ["dishes"] });
    const dishes: DishInterface[] = [];
    for await (const entry of entries) dishes.push(entry.value);
    return dishes;
  }

  static async getById(id: string): Promise<DishInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishInterface>(["dishes", id]);
    return res.value;
  }

  static async update(
    id: string,
    patch: Partial<DishInterface>,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = mergeDefinedPatch(existing, patch);
    await kv.set(["dishes", id], updated);
    return updated;
  }

  static async delete(id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["dishes", id]);
  }
}
```

Add to `database/index.ts` (append):
```ts
export * from "./dish.repo.ts";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test --unstable-kv -A database/dish.repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Format + commit**

```bash
deno fmt models/dish database/dish.repo.ts database/dish.repo.test.ts models/index.ts database/index.ts
git add models/dish models/index.ts database/dish.repo.ts database/dish.repo.test.ts database/index.ts
git commit -m "feat(menu): add Dish model and DishRepo CRUD"
```

---

### Task 2: DishTagGroup model + `DishTagGroupRepo`

**Files:**
- Create: `models/dish/dish-tag-group.interface.ts`
- Modify: `models/dish/index.ts` (add export)
- Create: `database/dish-tag-group.repo.ts`
- Modify: `database/index.ts` (export `DishTagGroupRepo`)
- Test: `database/dish-tag-group.repo.test.ts`

**Interfaces:**
- Produces:
  - `DishTagValueInterface { id: string; label: string }`
  - `DishTagGroupInterface { id: string; label: string; order?: number; values: DishTagValueInterface[] }`
  - `DishTagGroupRepo.ensureDefaults(): Promise<void>` (idempotent seed)
  - `DishTagGroupRepo.getAll(): Promise<DishTagGroupInterface[]>` (sorted by `order`)
  - `DishTagGroupRepo.getById(id: string): Promise<DishTagGroupInterface | null>`
  - `DishTagGroupRepo.addValue(groupId: string, label: string): Promise<DishTagValueInterface | null>`

- [ ] **Step 1: Create the model file + export**

`models/dish/dish-tag-group.interface.ts`:
```ts
export interface DishTagValueInterface {
  id: string;
  label: string;
}

export interface DishTagGroupInterface {
  id: string;
  label: string; // "Type", "Meal", "Side type"
  order?: number;
  values: DishTagValueInterface[]; // values embedded in the group
}
```

Update `models/dish/index.ts`:
```ts
export * from "./dish.interface.ts";
export * from "./dish-tag-group.interface.ts";
```

- [ ] **Step 2: Write the failing repo test**

`database/dish-tag-group.repo.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

async function clearGroups() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dish_tag_groups"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "ensureDefaults — seeds the three default groups with values",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults();
    const groups = await DishTagGroupRepo.getAll();
    assertEquals(groups.map((g) => g.label), ["Type", "Meal", "Side type"]);
    assertEquals(groups[0].values.map((v) => v.label), [
      "Vegetarian",
      "Fish",
      "Meat",
    ]);
    // every value has a non-empty id
    for (const g of groups) {
      for (const v of g.values) assertEquals(typeof v.id, "string");
    }
  },
});

Deno.test({
  name: "ensureDefaults — is idempotent (second call adds nothing)",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults();
    await DishTagGroupRepo.ensureDefaults();
    const groups = await DishTagGroupRepo.getAll();
    assertEquals(groups.length, 3);
  },
});

Deno.test({
  name: "addValue — appends a value to a group and returns it",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults();
    const [type] = await DishTagGroupRepo.getAll();
    const created = await DishTagGroupRepo.addValue(type.id, "Vegan");
    assertEquals(created?.label, "Vegan");
    const reloaded = await DishTagGroupRepo.getById(type.id);
    assertEquals(reloaded?.values.at(-1)?.label, "Vegan");
  },
});

Deno.test({
  name: "addValue — returns null for a missing group",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    assertEquals(await DishTagGroupRepo.addValue("nope", "x"), null);
  },
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `deno test --unstable-kv -A database/dish-tag-group.repo.test.ts`
Expected: FAIL — `Module not found "database/dish-tag-group.repo.ts"`.

- [ ] **Step 4: Implement `DishTagGroupRepo`**

`database/dish-tag-group.repo.ts`:
```ts
import {
  DishTagGroupInterface,
  DishTagValueInterface,
} from "@/models/index.ts";
import { getKv } from "./db.ts";

const DEFAULT_GROUPS: { label: string; values: string[] }[] = [
  { label: "Type", values: ["Vegetarian", "Fish", "Meat"] },
  { label: "Meal", values: ["Main dish", "Breakfast", "Lunch", "Side dish"] },
  { label: "Side type", values: ["Rice", "Potatoes", "Pasta"] },
];

export class DishTagGroupRepo {
  static async getAll(): Promise<DishTagGroupInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishTagGroupInterface>({
      prefix: ["dish_tag_groups"],
    });
    const groups: DishTagGroupInterface[] = [];
    for await (const entry of entries) groups.push(entry.value);
    return groups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(id: string): Promise<DishTagGroupInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishTagGroupInterface>(["dish_tag_groups", id]);
    return res.value;
  }

  static async ensureDefaults(): Promise<void> {
    const kv = await getKv();
    // Seed only when the collection is empty.
    for await (const _ of kv.list({ prefix: ["dish_tag_groups"] })) return;
    let atomic = kv.atomic();
    DEFAULT_GROUPS.forEach((g, i) => {
      const group: DishTagGroupInterface = {
        id: crypto.randomUUID(),
        label: g.label,
        order: i,
        values: g.values.map((label) => ({
          id: crypto.randomUUID(),
          label,
        })),
      };
      atomic = atomic.set(["dish_tag_groups", group.id], group);
    });
    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to seed dish tag groups.");
  }

  static async addValue(
    groupId: string,
    label: string,
  ): Promise<DishTagValueInterface | null> {
    const kv = await getKv();
    const group = await this.getById(groupId);
    if (!group) return null;
    const value: DishTagValueInterface = {
      id: crypto.randomUUID(),
      label,
    };
    const updated: DishTagGroupInterface = {
      ...group,
      values: [...group.values, value],
    };
    await kv.set(["dish_tag_groups", groupId], updated);
    return value;
  }
}
```

Add to `database/index.ts` (append):
```ts
export * from "./dish-tag-group.repo.ts";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test --unstable-kv -A database/dish-tag-group.repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Format + commit**

```bash
deno fmt models/dish database/dish-tag-group.repo.ts database/dish-tag-group.repo.test.ts database/index.ts
git add models/dish/dish-tag-group.interface.ts models/dish/index.ts database/dish-tag-group.repo.ts database/dish-tag-group.repo.test.ts database/index.ts
git commit -m "feat(menu): add DishTagGroup model and repo with seeded defaults"
```

---

### Task 3: API routes for dishes + tag groups

**Files:**
- Create: `routes/api/menu/dishes.ts`
- Create: `routes/api/menu/tag-groups.ts`
- Test: `routes/api/menu/dishes.test.ts`
- Test: `routes/api/menu/tag-groups.test.ts`

**Interfaces:**
- Consumes: `DishRepo` (Task 1), `DishTagGroupRepo` (Task 2).
- Produces (HTTP contract used by the client wrappers in Task 4):
  - `GET /api/menu/dishes` → `200` JSON `DishInterface[]`
  - `POST /api/menu/dishes` → create (no `id`) `201` dish; update (`id` present) `200` dish or `404`
  - `DELETE /api/menu/dishes` → body `{ id }` → `204`, or `400` when `id` missing
  - `GET /api/menu/tag-groups` → `ensureDefaults` then `200` JSON `DishTagGroupInterface[]`
  - `POST /api/menu/tag-groups` → body `{ groupId, label }` → `201` value, `404` missing group, `400` missing fields

- [ ] **Step 1: Write the failing handler tests**

These call the handler object directly with a minimal fake context (the handlers only read `ctx.req`), matching `routes/api/shopping/catalogue.ts`'s `Context<unknown>` shape.

`routes/api/menu/dishes.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/menu/dishes.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(req: Request): Context<unknown> {
  return { req } as unknown as Context<unknown>;
}
async function clearDishes() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dishes"] })) await kv.delete(e.key);
}
const post = (body: unknown) =>
  new Request("http://x/api/menu/dishes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST creates (201), GET lists it, POST with id updates (200)",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const createRes = await handler.POST(
      ctx(post({ name: "Curry", ingredientIds: [], tagValueIds: [] })),
    );
    assertEquals(createRes.status, 201);
    const created = await createRes.json();

    const listRes = await handler.GET(
      ctx(new Request("http://x/api/menu/dishes")),
    );
    assertEquals(listRes.status, 200);
    const list = await listRes.json();
    assertEquals(list.map((d: { name: string }) => d.name), ["Curry"]);

    const updateRes = await handler.POST(
      ctx(post({ id: created.id, name: "Veggie Curry" })),
    );
    assertEquals(updateRes.status, 200);
    assertEquals((await updateRes.json()).name, "Veggie Curry");
  },
});

Deno.test({
  name: "POST with unknown id returns 404",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const res = await handler.POST(ctx(post({ id: "nope", name: "x" })));
    assertEquals(res.status, 404);
  },
});

Deno.test({
  name: "DELETE removes a dish (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await (await handler.POST(
      ctx(post({ name: "Toast", ingredientIds: [], tagValueIds: [] })),
    )).json();
    const delReq = new Request("http://x/api/menu/dishes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/menu/dishes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
```

`routes/api/menu/tag-groups.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/menu/tag-groups.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(req: Request): Context<unknown> {
  return { req } as unknown as Context<unknown>;
}
async function clearGroups() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dish_tag_groups"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "GET seeds defaults and returns the groups",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups")),
    );
    assertEquals(res.status, 200);
    const groups = await res.json();
    assertEquals(groups.map((g: { label: string }) => g.label), [
      "Type",
      "Meal",
      "Side type",
    ]);
  },
});

Deno.test({
  name: "POST adds a value to a group (201); missing group is 404",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    const groups = await (await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups")),
    )).json();
    const addReq = (body: unknown) =>
      new Request("http://x/api/menu/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const okRes = await handler.POST(
      ctx(addReq({ groupId: groups[0].id, label: "Vegan" })),
    );
    assertEquals(okRes.status, 201);
    assertEquals((await okRes.json()).label, "Vegan");

    const missRes = await handler.POST(
      ctx(addReq({ groupId: "nope", label: "x" })),
    );
    assertEquals(missRes.status, 404);
  },
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno test --unstable-kv -A routes/api/menu/`
Expected: FAIL — modules `routes/api/menu/dishes.ts` / `tag-groups.ts` not found.

- [ ] **Step 3: Implement the routes**

`routes/api/menu/dishes.ts`:
```ts
import { type Context } from "fresh";
import { DishRepo } from "@/database/dish.repo.ts";

export const handler = {
  async GET(_ctx: Context<unknown>) {
    const dishes = await DishRepo.readAll();
    return new Response(JSON.stringify(dishes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(_ctx: Context<unknown>) {
    const body = await _ctx.req.json();
    if (body.id) {
      const updated = await DishRepo.update(body.id, body);
      if (!updated) return new Response("Dish not found", { status: 404 });
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    const created = await DishRepo.create(body);
    return new Response(JSON.stringify(created), { status: 201 });
  },
  async DELETE(_ctx: Context<unknown>) {
    const { id } = await _ctx.req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await DishRepo.delete(id);
    return new Response(null, { status: 204 });
  },
};
```

`routes/api/menu/tag-groups.ts`:
```ts
import { type Context } from "fresh";
import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";

export const handler = {
  async GET(_ctx: Context<unknown>) {
    await DishTagGroupRepo.ensureDefaults();
    const groups = await DishTagGroupRepo.getAll();
    return new Response(JSON.stringify(groups), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(_ctx: Context<unknown>) {
    const { groupId, label } = await _ctx.req.json();
    if (!groupId || !label?.trim()) {
      return new Response("groupId and label are required", { status: 400 });
    }
    const value = await DishTagGroupRepo.addValue(groupId, label.trim());
    if (!value) return new Response("Group not found", { status: 404 });
    return new Response(JSON.stringify(value), { status: 201 });
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/menu/`
Expected: PASS (5 tests).

- [ ] **Step 5: Format + commit**

```bash
deno fmt routes/api/menu
git add routes/api/menu
git commit -m "feat(menu): add dish and tag-group API routes"
```

---

### Task 4: Client API wrappers + `useDishes` hook

**Files:**
- Modify: `services/api.ts` (add `api.dishes`, `api.dishTagGroups`, dish model imports)
- Create: `hooks/useDishes.ts`
- Test: `hooks/useDishes.test.ts`

**Interfaces:**
- Consumes: the HTTP contract from Task 3; `beginBusy`/`endBusy` from `@/utils/loading.ts`.
- Produces:
  - `api.dishes.getAll() / create(dish: CreateDishDto) / update(id, patch: Partial<DishInterface>) / delete(id)`
  - `api.dishTagGroups.getAll() / addValue(groupId, label)`
  - `useDishes(initialDishes, initialTagGroups)` returning signals `dishes`, `tagGroups`, `query`, `selectedTagValueIds`, `pendingCount`, computed `filtered`, and methods `toggleTagValue(valueId)`, `clearFilters()`, `removeDish(id)`, `refresh()`. Filtering is **OR within a tag group, AND across groups**, combined with a case-insensitive name-substring match; results sorted by name.

- [ ] **Step 1: Write the failing hook test**

`hooks/useDishes.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useDishes } from "@/hooks/useDishes.ts";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";

const dish = (
  id: string,
  name: string,
  tagValueIds: string[] = [],
): DishInterface => ({ id, name, ingredientIds: [], tagValueIds });

const group = (
  id: string,
  label: string,
  values: [string, string][],
  order = 0,
): DishTagGroupInterface => ({
  id,
  label,
  order,
  values: values.map(([vid, l]) => ({ id: vid, label: l })),
});

Deno.test("filtered — case-insensitive name query", () => {
  const hook = useDishes(
    [dish("1", "Pasta Bolognese"), dish("2", "Veggie Curry")],
    [],
  );
  hook.query.value = "curry";
  assertEquals(hook.filtered.value.map((d) => d.name), ["Veggie Curry"]);
});

Deno.test("filtered — OR within a group, AND across groups", () => {
  const groups = [
    group("type", "Type", [["veg", "Vegetarian"], ["fish", "Fish"], [
      "meat",
      "Meat",
    ]]),
    group("meal", "Meal", [["main", "Main dish"], ["side", "Side dish"]], 1),
  ];
  const hook = useDishes([
    dish("1", "Veg Main", ["veg", "main"]),
    dish("2", "Fish Main", ["fish", "main"]),
    dish("3", "Veg Side", ["veg", "side"]),
    dish("4", "Meat Main", ["meat", "main"]),
  ], groups);
  hook.toggleTagValue("veg"); // Type: veg
  hook.toggleTagValue("fish"); // Type: veg OR fish
  hook.toggleTagValue("main"); // Meal: main  → (veg|fish) AND main
  assertEquals(hook.filtered.value.map((d) => d.name), ["Fish Main", "Veg Main"]);
});

Deno.test("clearFilters — removes all selected tag values", () => {
  const hook = useDishes([dish("1", "A", ["veg"])], []);
  hook.toggleTagValue("veg");
  hook.clearFilters();
  assertEquals(hook.selectedTagValueIds.value.size, 0);
});

Deno.test("removeDish — optimistically removes and calls the API", async () => {
  const del = stub(api.dishes, "delete", () => Promise.resolve());
  try {
    const hook = useDishes([dish("1", "A"), dish("2", "B")], []);
    await hook.removeDish("1");
    assertEquals(hook.dishes.value.map((d) => d.id), ["2"]);
    assertEquals(del.calls.length, 1);
  } finally {
    del.restore();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A hooks/useDishes.test.ts`
Expected: FAIL — `useDishes` module not found (and `api.dishes` undefined).

- [ ] **Step 3: Add the client wrappers**

In `services/api.ts`, add this import near the existing model imports:
```ts
import {
  CreateDishDto,
  DishInterface,
  DishTagGroupInterface,
  DishTagValueInterface,
} from "@/models/index.ts";
```

Add these two keys to the `api` object (e.g. after `items`):
```ts
  dishes: {
    getAll: async (): Promise<DishInterface[]> => {
      const res = await fetch("/api/menu/dishes");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (dish: CreateDishDto): Promise<DishInterface | null> => {
      const res = await fetch("/api/menu/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dish),
      });
      if (!res.ok) return null;
      return res.json();
    },
    update: async (
      id: string,
      patch: Partial<DishInterface>,
    ): Promise<DishInterface | null> => {
      const res = await fetch("/api/menu/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, id }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/menu/dishes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  dishTagGroups: {
    getAll: async (): Promise<DishTagGroupInterface[]> => {
      const res = await fetch("/api/menu/tag-groups");
      if (!res.ok) return [];
      return res.json();
    },
    addValue: async (
      groupId: string,
      label: string,
    ): Promise<DishTagValueInterface | null> => {
      const res = await fetch("/api/menu/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, label }),
      });
      if (!res.ok) return null;
      return res.json();
    },
  },
```

- [ ] **Step 4: Implement the hook**

`hooks/useDishes.ts`:
```ts
import { computed, signal } from "@preact/signals";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useDishes(
  initialDishes: DishInterface[],
  initialTagGroups: DishTagGroupInterface[],
) {
  const dishes = signal<DishInterface[]>(initialDishes ?? []);
  const tagGroups = signal<DishTagGroupInterface[]>(initialTagGroups ?? []);
  const query = signal("");
  const selectedTagValueIds = signal<Set<string>>(new Set());
  const pendingCount = signal(0);

  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const filtered = computed<DishInterface[]>(() => {
    const q = query.value.trim().toLowerCase();
    const selected = selectedTagValueIds.value;

    // Map each selectable value id → its group id, then bucket the *selected*
    // ids by group so we can require a match within each active group (OR)
    // while requiring every active group to match (AND).
    const valueToGroup = new Map<string, string>();
    for (const g of tagGroups.value) {
      for (const v of g.values) valueToGroup.set(v.id, g.id);
    }
    const byGroup = new Map<string, Set<string>>();
    for (const vid of selected) {
      const gid = valueToGroup.get(vid);
      if (!gid) continue;
      if (!byGroup.has(gid)) byGroup.set(gid, new Set());
      byGroup.get(gid)!.add(vid);
    }

    return dishes.value
      .filter((d) => {
        if (q && !d.name.toLowerCase().includes(q)) return false;
        for (const [, valueIds] of byGroup) {
          if (!d.tagValueIds.some((t) => valueIds.has(t))) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  });

  const toggleTagValue = (valueId: string) => {
    const next = new Set(selectedTagValueIds.value);
    next.has(valueId) ? next.delete(valueId) : next.add(valueId);
    selectedTagValueIds.value = next;
  };

  const clearFilters = () => {
    selectedTagValueIds.value = new Set();
  };

  const removeDish = async (id: string): Promise<void> => {
    dishes.value = dishes.value.filter((d) => d.id !== id);
    startPending();
    try {
      await api.dishes.delete(id);
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const [d, g] = await Promise.all([
        api.dishes.getAll(),
        api.dishTagGroups.getAll(),
      ]);
      dishes.value = d;
      tagGroups.value = g;
    } finally {
      pendingCount.value--;
    }
  };

  return {
    dishes,
    tagGroups,
    query,
    selectedTagValueIds,
    pendingCount,
    filtered,
    toggleTagValue,
    clearFilters,
    removeDish,
    refresh,
  };
}
```

Note: `deno lint` may flag the ternary-as-statement in `toggleTagValue`. If it does, rewrite as an `if/else`:
```ts
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test --unstable-kv -A hooks/useDishes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Format + commit**

```bash
deno fmt services/api.ts hooks/useDishes.ts hooks/useDishes.test.ts
git add services/api.ts hooks/useDishes.ts hooks/useDishes.test.ts
git commit -m "feat(menu): add dish API client wrappers and useDishes hook"
```

---

### Task 5: `/menu` list route + `DishCatalogue` island

**Files:**
- Modify: `routes/menu/index.tsx` (replace `ComingSoon` with the dish list)
- Create: `islands/dishes/DishCatalogue.tsx`
- Test: `islands/dishes/DishCatalogue.test.tsx`

**Interfaces:**
- Consumes: `useDishes` (Task 4); `DishRepo` + `DishTagGroupRepo` (Tasks 1–2); `navigateTo` from `@/utils/loading.ts`; MD3 `Chip`, `Icon`, `IconButton`, `Pressable`, `Button`, `PullToRefresh`.
- Produces: `DishCatalogue` default export with props `{ initialDishes: DishInterface[]; initialTagGroups: DishTagGroupInterface[] }`. Tiles link to `/menu/{id}`; FAB and empty-state button link to `/menu/new`.

- [ ] **Step 1: Write the failing island render test**

`islands/dishes/DishCatalogue.test.tsx`:
```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DishCatalogue from "./DishCatalogue.tsx";

Deno.test("DishCatalogue — renders dishes, tag filter groups, and the add FAB", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [
      { id: "1", name: "Pasta Bolognese", ingredientIds: ["a", "b"], tagValueIds: ["meat"] },
      { id: "2", name: "Veggie Curry", ingredientIds: ["c"], tagValueIds: ["veg"] },
    ],
    initialTagGroups: [
      {
        id: "type",
        label: "Type",
        order: 0,
        values: [{ id: "veg", label: "Vegetarian" }, { id: "meat", label: "Meat" }],
      },
    ],
  }));
  assertStringIncludes(html, "Pasta Bolognese");
  assertStringIncludes(html, "Veggie Curry");
  assertStringIncludes(html, "Type"); // group label
  assertStringIncludes(html, "Vegetarian"); // value chip
  assertStringIncludes(html, "Add dish"); // FAB label
});

Deno.test("DishCatalogue — empty state prompts adding a dish", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [],
    initialTagGroups: [],
  }));
  assertStringIncludes(html, "No dishes yet");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A islands/dishes/DishCatalogue.test.tsx`
Expected: FAIL — `./DishCatalogue.tsx` not found.

- [ ] **Step 3: Implement the island**

`islands/dishes/DishCatalogue.tsx`:
```tsx
import { useMemo } from "preact/hooks";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";
import { useDishes } from "@/hooks/useDishes.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
}

export default function DishCatalogue(
  { initialDishes, initialTagGroups }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    dishes,
    tagGroups,
    query,
    selectedTagValueIds,
    filtered,
    toggleTagValue,
    clearFilters,
    refresh,
  } = useMemo(() => useDishes(initialDishes, initialTagGroups), []);

  const groups = tagGroups.value;
  const selected = selectedTagValueIds.value;
  const list = filtered.value;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {/* search */}
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={query.value}
            onInput={(e) => (query.value = e.currentTarget.value)}
            placeholder="Search dishes"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {query.value && (
            <IconButton
              name="x"
              size={36}
              iconSize={18}
              aria-label="Clear search"
              onClick={() => (query.value = "")}
            />
          )}
        </div>

        {/* tag filter rail — one row of chips per dimension */}
        {groups.map((g) => (
          <div key={g.id} class="flex flex-col gap-1.5">
            <div class="md-label-medium uppercase text-on-surface-variant px-1">
              {g.label}
            </div>
            <div class="flex gap-2 overflow-x-auto pr-1">
              {g.values.map((v) => (
                <Chip
                  key={v.id}
                  selected={selected.has(v.id)}
                  leadingCheck={false}
                  onClick={() => toggleTagValue(v.id)}
                >
                  {v.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        {selected.size > 0 && (
          <Pressable
            onClick={clearFilters}
            class="self-start md-label-large text-primary px-1"
          >
            Clear filters
          </Pressable>
        )}

        {/* count */}
        <div class="md-body-medium text-on-surface-variant px-1">
          {list.length} dish{list.length === 1 ? "" : "es"}
        </div>

        {/* dish grid / empty state */}
        {list.length === 0
          ? (
            <div class="px-2 pt-2 text-center flex flex-col items-center gap-4">
              <div class="md-title-medium text-on-surface">
                {dishes.value.length === 0
                  ? "No dishes yet"
                  : "No dishes match your filters"}
              </div>
              <Button
                variant="tonal"
                icon="plus"
                onClick={() => navigateTo("/menu/new")}
              >
                Add a dish
              </Button>
            </div>
          )
          : (
            <div class="grid grid-cols-2 gap-2.5">
              {list.map((d) => (
                <Pressable
                  key={d.id}
                  onClick={() => navigateTo(`/menu/${d.id}`)}
                  class="flex flex-col gap-1 bg-surface border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3.5 text-left"
                >
                  <span class="md-body-large text-on-surface truncate">
                    {d.name}
                  </span>
                  <span class="md-body-small text-on-surface-variant truncate">
                    {d.ingredientIds.length} ingredient{d.ingredientIds.length ===
                        1
                      ? ""
                      : "s"}
                  </span>
                </Pressable>
              ))}
            </div>
          )}
      </div>

      {/* Add-dish FAB (styled like islands/shell/Fab.tsx, fixed above the nav) */}
      <div
        class="fixed right-4 z-40"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Pressable
          onClick={() => navigateTo("/menu/new")}
          aria-label="Add dish"
          class="inline-flex items-center gap-3 bg-primary-container text-on-primary-container md-elevation-3"
          style={{ height: 56, borderRadius: "var(--md-shape-lg)", padding: "0 20px" }}
        >
          <Icon name="plus" size={24} />
          <span class="md-label-large" style={{ fontSize: 15 }}>Add dish</span>
        </Pressable>
      </div>
    </PullToRefresh>
  );
}
```

- [ ] **Step 4: Replace the `/menu` route**

Replace the entire contents of `routes/menu/index.tsx` with:
```tsx
import { page } from "fresh";
import { DishRepo, DishTagGroupRepo } from "@/database/index.ts";
import DishCatalogue from "@/islands/dishes/DishCatalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(_ctx) {
    await DishTagGroupRepo.ensureDefaults();
    const [dishes, tagGroups] = await Promise.all([
      DishRepo.readAll(),
      DishTagGroupRepo.getAll(),
    ]);
    return page({ dishes, tagGroups });
  },
});

export default define.page<typeof handler>(function MenuPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishCatalogue
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
      />
    </main>
  );
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test --unstable-kv -A islands/dishes/DishCatalogue.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Format + commit**

```bash
deno fmt routes/menu/index.tsx islands/dishes
git add routes/menu/index.tsx islands/dishes/DishCatalogue.tsx islands/dishes/DishCatalogue.test.tsx
git commit -m "feat(menu): dish catalogue list with search and tag filters"
```

---

### Task 6: Dish editor routes + `DishEditor` island

**Files:**
- Create: `islands/dishes/DishEditor.tsx`
- Create: `routes/menu/new.tsx`
- Create: `routes/menu/[id]/index.tsx`
- Test: `islands/dishes/DishEditor.test.tsx`

**Interfaces:**
- Consumes: `api.dishes` + `api.dishTagGroups` + `api.items` (existing); `navigateTo`; MD3 `Chip`, `Button`, `Icon`, `IconButton`, `Sheet`, `Pressable`, `ListItem`. Routes use `DishRepo`, `DishTagGroupRepo`, `ItemRepo`, `page`, `define`.
- Produces: `DishEditor` default export with props `{ dish?: DishInterface; tagGroups: DishTagGroupInterface[]; items: ItemInterface[] }`. Routes: `/menu/new` (create) and `/menu/[id]` (view/edit/delete), both setting `appBar { mode: "detail", title, backUrl: "/menu" }`.

- [ ] **Step 1: Write the failing island render test**

`islands/dishes/DishEditor.test.tsx`:
```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DishEditor from "./DishEditor.tsx";

const groups = [{
  id: "type",
  label: "Type",
  order: 0,
  values: [{ id: "veg", label: "Vegetarian" }],
}];
const items = [{ id: "a", name: "Onion" }];

Deno.test("DishEditor — new dish renders name, tags, add-ingredient, create button", () => {
  const html = render(h(DishEditor, { tagGroups: groups, items }));
  assertStringIncludes(html, "Name");
  assertStringIncludes(html, "Type"); // tag group label
  assertStringIncludes(html, "Vegetarian"); // tag value chip
  assertStringIncludes(html, "Add ingredient");
  assertStringIncludes(html, "Create dish");
});

Deno.test("DishEditor — existing dish prefills name, shows ingredient chip + delete", () => {
  const html = render(h(DishEditor, {
    dish: { id: "1", name: "Pasta", ingredientIds: ["a"], tagValueIds: ["veg"] },
    tagGroups: groups,
    items,
  }));
  assertStringIncludes(html, 'value="Pasta"'); // prefilled name field
  assertStringIncludes(html, "Onion"); // resolved ingredient chip
  assertStringIncludes(html, "Save changes");
  assertStringIncludes(html, "Delete dish");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A islands/dishes/DishEditor.test.tsx`
Expected: FAIL — `./DishEditor.tsx` not found.

- [ ] **Step 3: Implement the editor island**

`islands/dishes/DishEditor.tsx`:
```tsx
import { useSignal } from "@preact/signals";
import type {
  DishInterface,
  DishTagGroupInterface,
  ItemInterface,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { navigateTo } from "@/utils/loading.ts";

const fieldClass =
  "flex-1 min-w-0 md-body-large text-on-surface bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-4 py-3 focus:outline-none";

interface Props {
  dish?: DishInterface;
  tagGroups: DishTagGroupInterface[];
  items: ItemInterface[];
}

export default function DishEditor({ dish, tagGroups, items }: Props) {
  const name = useSignal(dish?.name ?? "");
  const ingredientIds = useSignal<string[]>(dish?.ingredientIds ?? []);
  const tagValueIds = useSignal<string[]>(dish?.tagValueIds ?? []);
  const localItems = useSignal<ItemInterface[]>(items);
  const localGroups = useSignal<DishTagGroupInterface[]>(tagGroups);
  const pickerOpen = useSignal(false);
  const ingredientQuery = useSignal("");
  const newValueFor = useSignal<string | null>(null);
  const newValueLabel = useSignal("");
  const saving = useSignal(false);

  const itemById = (id: string) => localItems.value.find((i) => i.id === id);

  const toggleTag = (valueId: string) => {
    tagValueIds.value = tagValueIds.value.includes(valueId)
      ? tagValueIds.value.filter((v) => v !== valueId)
      : [...tagValueIds.value, valueId];
  };
  const addIngredient = (itemId: string) => {
    if (!ingredientIds.value.includes(itemId)) {
      ingredientIds.value = [...ingredientIds.value, itemId];
    }
  };
  const removeIngredient = (itemId: string) => {
    ingredientIds.value = ingredientIds.value.filter((i) => i !== itemId);
  };
  const createCatalogueItem = async (label: string) => {
    const created = await api.items.create({ name: label });
    if (created?.id) {
      localItems.value = [...localItems.value, created];
      addIngredient(created.id);
    }
  };
  const addValue = async (groupId: string, label: string) => {
    const created = await api.dishTagGroups.addValue(groupId, label);
    if (created) {
      localGroups.value = localGroups.value.map((g) =>
        g.id === groupId ? { ...g, values: [...g.values, created] } : g
      );
      toggleTag(created.id);
    }
  };
  const save = async () => {
    const n = name.value.trim();
    if (!n) return;
    saving.value = true;
    const payload = {
      name: n,
      ingredientIds: ingredientIds.value,
      tagValueIds: tagValueIds.value,
    };
    if (dish) await api.dishes.update(dish.id, payload);
    else await api.dishes.create(payload);
    navigateTo("/menu");
  };
  const remove = async () => {
    if (!dish) return;
    await api.dishes.delete(dish.id);
    navigateTo("/menu");
  };

  const q = ingredientQuery.value.trim().toLowerCase();
  const chosen = new Set(ingredientIds.value);
  const results = localItems.value
    .filter((i) => !chosen.has(i.id) && (!q || i.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const exactMatch = !!q &&
    localItems.value.some((i) => i.name.trim().toLowerCase() === q);

  return (
    <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-6">
      {/* Name */}
      <div>
        <div class="md-label-medium uppercase text-on-surface-variant mb-2">
          Name
        </div>
        <input
          value={name.value}
          onInput={(e) => (name.value = e.currentTarget.value)}
          placeholder="Dish name"
          class={fieldClass}
        />
      </div>

      {/* Ingredients */}
      <div>
        <div class="md-label-medium uppercase text-on-surface-variant mb-2">
          Ingredients
        </div>
        <div class="flex flex-wrap gap-2">
          {ingredientIds.value.map((id) => (
            <span
              key={id}
              class="inline-flex items-center gap-1 md-label-large bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-full)] pl-3 pr-1 py-1"
            >
              {itemById(id)?.name ?? "Unknown"}
              <IconButton
                name="x"
                size={28}
                iconSize={14}
                aria-label="Remove ingredient"
                onClick={() => removeIngredient(id)}
              />
            </span>
          ))}
          <Chip
            icon="plus"
            leadingCheck={false}
            onClick={() => {
              ingredientQuery.value = "";
              pickerOpen.value = true;
            }}
          >
            Add ingredient
          </Chip>
        </div>
      </div>

      {/* Tags — one chip group per dimension */}
      {localGroups.value.map((g) => (
        <div key={g.id}>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            {g.label}
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            {g.values.map((v) => (
              <Chip
                key={v.id}
                selected={tagValueIds.value.includes(v.id)}
                leadingCheck={false}
                onClick={() => toggleTag(v.id)}
              >
                {v.label}
              </Chip>
            ))}
            {newValueFor.value === g.id
              ? (
                <span class="inline-flex items-center gap-2">
                  <input
                    value={newValueLabel.value}
                    onInput={(e) => (newValueLabel.value = e.currentTarget.value)}
                    placeholder="New value"
                    class="md-body-large bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-3 py-1.5 focus:outline-none"
                  />
                  <Button
                    variant="filled"
                    disabled={!newValueLabel.value.trim()}
                    onClick={async () => {
                      await addValue(g.id, newValueLabel.value.trim());
                      newValueFor.value = null;
                      newValueLabel.value = "";
                    }}
                  >
                    Add
                  </Button>
                </span>
              )
              : (
                <Chip
                  icon="plus"
                  leadingCheck={false}
                  onClick={() => {
                    newValueFor.value = g.id;
                    newValueLabel.value = "";
                  }}
                >
                  New
                </Chip>
              )}
          </div>
        </div>
      ))}

      {/* Save / Delete */}
      <div class="flex flex-col gap-3 pt-2">
        <Button
          variant="filled"
          disabled={!name.value.trim() || saving.value}
          onClick={save}
        >
          {dish ? "Save changes" : "Create dish"}
        </Button>
        {dish && (
          <Button variant="error" icon="trash" onClick={remove}>
            Delete dish
          </Button>
        )}
      </div>

      {/* Ingredient picker — search the catalogue, or create a new item inline */}
      <Sheet
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        title="Add ingredient"
        size="large"
      >
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5 mb-3">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={ingredientQuery.value}
            onInput={(e) => (ingredientQuery.value = e.currentTarget.value)}
            placeholder="Search or add an item"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
        </div>
        {q && !exactMatch && (
          <Pressable
            onClick={async () => {
              await createCatalogueItem(ingredientQuery.value.trim());
              ingredientQuery.value = "";
            }}
            color="var(--md-primary)"
            class="flex items-center gap-2.5 w-full text-left border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3 text-primary md-label-large mb-2"
          >
            <Icon name="plus" size={20} stroke={2.3} /> Create “{ingredientQuery
              .value.trim()}”
          </Pressable>
        )}
        <div class="max-h-[360px] overflow-y-auto -mx-1">
          {results.map((it) => (
            <ListItem
              key={it.id}
              headline={it.name}
              onClick={() => addIngredient(it.id)}
              trailing={<Icon name="plus" size={20} class="text-primary" />}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --unstable-kv -A islands/dishes/DishEditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the two editor routes**

`routes/menu/new.tsx`:
```tsx
import { page } from "fresh";
import { DishTagGroupRepo, ItemRepo } from "@/database/index.ts";
import DishEditor from "@/islands/dishes/DishEditor.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    ctx.state.appBar = { mode: "detail", title: "New dish", backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(),
      ItemRepo.readAll(),
    ]);
    return page({ tagGroups, items });
  },
});

export default define.page<typeof handler>(function NewDishPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishEditor tagGroups={data.tagGroups} items={data.items} />
    </main>
  );
});
```

`routes/menu/[id]/index.tsx`:
```tsx
import { page } from "fresh";
import { DishRepo, DishTagGroupRepo, ItemRepo } from "@/database/index.ts";
import DishEditor from "@/islands/dishes/DishEditor.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const dish = await DishRepo.getById(ctx.params.id);
    if (!dish) return new Response("Not found", { status: 404 });
    await DishTagGroupRepo.ensureDefaults();
    ctx.state.appBar = { mode: "detail", title: dish.name, backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(),
      ItemRepo.readAll(),
    ]);
    return page({ dish, tagGroups, items });
  },
});

export default define.page<typeof handler>(function DishDetailPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishEditor
        dish={data.dish}
        tagGroups={data.tagGroups}
        items={data.items}
      />
    </main>
  );
});
```

- [ ] **Step 6: Verify the full test suite + type check pass**

Run: `deno test --unstable-kv -A`
Expected: PASS (all existing tests + the new dish tests).

Run: `deno task check`
Expected: no format/lint/type errors. Fix any `deno fmt`/lint issues and re-run.

- [ ] **Step 7: Format + commit**

```bash
deno fmt islands/dishes routes/menu
git add islands/dishes/DishEditor.tsx islands/dishes/DishEditor.test.tsx routes/menu/new.tsx "routes/menu/[id]/index.tsx"
git commit -m "feat(menu): full-screen dish editor with create, edit, delete"
```

---

### Task 7: Full-suite gates + live verification

**Files:** none (verification only).

- [ ] **Step 1: Run all gates**

```bash
deno task check
deno task test
deno task build
```
Expected: all green. If `deno task check` reports format issues, run `deno fmt` and re-commit; fix any lint/type errors surfaced.

- [ ] **Step 2: Live end-to-end verification (browser preview)**

Start the dev server via the preview tooling (do NOT use raw `deno task dev` in a blocking shell — use the preview_start browser tool with the project's dev config; seed/login per the existing browser-e2e steps). Then exercise the full loop and capture evidence:
1. Navigate to `/menu` → the dish catalogue renders (not `ComingSoon`); the three seeded tag groups (Type/Meal/Side type) show as filter rails.
2. Tap the **Add dish** FAB → `/menu/new` opens full-screen with a back arrow titled "New dish".
3. Enter a name; open **Add ingredient**, search the catalogue, add one existing item, and create a brand-new item inline (verify it becomes a selected ingredient chip).
4. Select one value in **Type** and one in **Meal**; use **+ New** to add a value to a group and confirm it is selected.
5. Tap **Create dish** → returns to `/menu`; the new dish tile appears.
6. Filter by name and by a tag value (verify OR-within-group / AND-across-groups behaviour); clear filters.
7. Open the dish → edit the name and toggle a tag → **Save changes** → verify the change on `/menu`.
8. Open the dish → **Delete dish** → verify it disappears from `/menu`.
9. Check `read_console_messages` / `preview_logs` for errors; capture a screenshot of `/menu` with dishes.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(menu): address issues found during live verification"
```
(Skip if step 1–2 required no changes.)

---

## Notes for the implementer

- **Fresh 2 confirmation:** the API route uses a plain handler object (`{ GET, POST, DELETE }` taking `Context<unknown>`), matching `routes/api/shopping/catalogue.ts`; pages/handlers use `define.handlers` + `define.page` + `page()`, matching `routes/shopping/[id]/add.tsx`. Confirm via Context7 (`@fresh/core@^2.2.0`) if anything fails to type-check.
- **Shared in-memory KV in tests:** the process-wide KV singleton is reused across tests in a file, so every repo/handler test clears its prefix (`["dishes"]` / `["dish_tag_groups"]`) before asserting, and uses `sanitizeResources: false` (the singleton is never closed by design).
- **Signals discipline:** `useDishes` uses bare `signal()` and is therefore called once via `useMemo(() => useDishes(...), [])` in `DishCatalogue` (the `useCatalogue` pattern). `DishEditor` holds only local form state, so it uses `useSignal()` directly.
- **Navigation highlight:** `resolveActiveTab` already prefix-matches `/menu/*` to the Menu tab, so no `config/navigation.ts` change is needed.
- **Delete UX:** in v1 a dish is deleted from the **editor** (`/menu/[id]` → "Delete dish"), which satisfies the "delete a dish" acceptance criterion without cluttering the grid or risking accidental taps. The `useDishes.removeDish` optimistic primitive is intentionally retained and unit-tested even though the list grid doesn't surface it yet — it's the basis for a future swipe/long-press-to-delete affordance on the list. Leaving it unused by the list UI is deliberate, not an oversight.
```
