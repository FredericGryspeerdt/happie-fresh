# Scope dish catalogue & tag groups to household — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the whole catalogue — dishes, dish tag groups, catalogue items, and aisle categories — to the household so each household has its own isolated data, with a migration for existing global data.

**Architecture:** Move four global KV collections from `["<collection>", id]` to `["<collection>", householdId, id]`, mirroring the existing `ShoppingListRepo` pattern. `householdId` flows from `_middleware.ts` → `ctx.state.householdId`. Repos take `householdId` as their first argument; API handlers derive it from state (401 if missing); SSR loaders pass it through (`ctx.state.householdId!`, matching the existing shopping pages). A migration reassigns global entries to a primary household; the dev seed gives every household its own catalogue copy.

**Tech Stack:** Deno + Fresh 2 (SSR + Islands) + Preact + Deno KV. Tests use `Deno.test` + `jsr:@std/assert` with an in-memory KV (`KV_PATH=:memory:`).

## Global Constraints

- **Imports:** use the `@/` alias (e.g. `import { db } from "@/database/db.ts"`).
- **KV key pattern:** `["<collection>", householdId, id]` for all four scoped collections. IDs via `crypto.randomUUID()`.
- **Repo API shape:** `householdId` is the **first** argument of every scoped repo method. All repo methods stay `static`.
- **Handler auth:** JSON API handlers return `new Response("Unauthorized", { status: 401 })` when `ctx.state.householdId` is absent. SSR page loaders use `ctx.state.householdId!` (middleware guarantees it for authenticated page requests).
- **Styling/JSX:** Preact JSX, `class` not `className` (not relevant here — no UI changes).
- **Never** call `Deno.openKv()` directly in routes; always go through repos / `getKv()`.
- **Verification commands:** `deno task check` (fmt + lint + type-check) and `deno task test` (`deno test --unstable-kv -A`) must both be green before the PR. Run repo tests directly with `deno test --unstable-kv -A <path>`.
- **Commits:** Conventional Commits. Commit after each task.

## Task dependency order

Tasks 1–4 (repos) are the foundation. Tasks 5–8 (handlers, SSR, seed) consume the new repo signatures. Task 9 (migration) is independent of 5–8 but depends on nothing in the app runtime. Task 10 is final verification.

---

### Task 1: Scope `ItemRepo` to household

**Files:**
- Modify: `database/item.repo.ts`
- Test: `database/item.repo.test.ts` (create)

**Interfaces:**
- Produces: `ItemRepo.create(householdId: string, item: Partial<ItemInterface>)`, `ItemRepo.readAll(householdId: string)`, `ItemRepo.getById(householdId: string, id: string)`, `ItemRepo.update(householdId: string, id: string, item: ItemInterface)`, `ItemRepo.delete(householdId: string, id: string)`.

- [ ] **Step 1: Write the failing test**

Create `database/item.repo.test.ts`:

```ts
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { ItemRepo } from "@/database/item.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearItems() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["items"] })) await kv.delete(e.key);
}

Deno.test({
  name: "create + readAll + getById — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const created = await ItemRepo.create("hh-a", { name: "Milk" });
    assertEquals(typeof created.id, "string");
    const fetched = await ItemRepo.getById("hh-a", created.id);
    assertEquals(fetched?.name, "Milk");
    const all = await ItemRepo.readAll("hh-a");
    assertEquals(all.map((i) => i.name), ["Milk"]);
  },
});

Deno.test({
  name: "readAll/getById — household A cannot see household B's items",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const a = await ItemRepo.create("hh-a", { name: "Apples" });
    await ItemRepo.create("hh-b", { name: "Bananas" });
    assertEquals((await ItemRepo.readAll("hh-a")).map((i) => i.name), ["Apples"]);
    assertEquals((await ItemRepo.readAll("hh-b")).map((i) => i.name), ["Bananas"]);
    // B cannot fetch A's item by id.
    assertEquals(await ItemRepo.getById("hh-b", a.id), null);
  },
});

Deno.test({
  name: "update + delete — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const item = await ItemRepo.create("hh-a", { name: "Bread" });
    await ItemRepo.update("hh-a", item.id, { id: item.id, name: "Sourdough" });
    assertEquals((await ItemRepo.getById("hh-a", item.id))?.name, "Sourdough");
    await ItemRepo.delete("hh-a", item.id);
    assertEquals(await ItemRepo.getById("hh-a", item.id), null);
    assert((await ItemRepo.readAll("hh-a")).length === 0);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A database/item.repo.test.ts`
Expected: FAIL — type errors / assertions (methods still take the old arity).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `database/item.repo.ts` with:

```ts
import { ItemInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
export class ItemRepo {
  constructor() {}

  static async create(householdId: string, item: Partial<ItemInterface>) {
    const kv = await getKv();

    const id = crypto.randomUUID();
    const itemWithId = { ...item, id };
    const itemKey = ["items", householdId, itemWithId.id];
    const ok = await kv.atomic().set(itemKey, itemWithId).commit();
    if (!ok) throw new Error("Something went wrong.");
    return itemWithId;
  }

  static async readAll(householdId: string) {
    const kv = await getKv();

    const entries = kv.list<Required<ItemInterface>>({
      prefix: ["items", householdId],
    });
    const items = [];
    for await (const entry of entries) {
      const item = entry.value;
      items.push(item);
    }
    return items;
  }

  static async getById(householdId: string, id: string) {
    const kv = await getKv();
    const item = await kv.get<ItemInterface>(["items", householdId, id]);
    return item.value;
  }

  static async update(householdId: string, id: string, item: ItemInterface) {
    const kv = await getKv();

    return kv.set(["items", householdId, id], item);
  }
  static async delete(householdId: string, id: string) {
    const kv = await getKv();

    return kv.delete(["items", householdId, id]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A database/item.repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add database/item.repo.ts database/item.repo.test.ts
git commit -m "feat(db): scope ItemRepo to household"
```

---

### Task 2: Scope `CategoryRepo` to household

**Files:**
- Modify: `database/category.repo.ts`
- Test: `database/category.repo.test.ts` (create)

**Interfaces:**
- Produces: `CategoryRepo.create(householdId, label, userId)`, `getAll(householdId)`, `getById(householdId, id)`, `update(householdId, id, patch)`, `delete(householdId, id)`, `reorder(householdId, updates)`.

- [ ] **Step 1: Write the failing test**

Create `database/category.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { CategoryRepo } from "@/database/category.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

async function clearCategories() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["categories"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "create — appends order per household and stores creator",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const first = await CategoryRepo.create("hh-a", "Produce", "u1");
    const second = await CategoryRepo.create("hh-a", "Dairy", "u1");
    assertEquals(first.order, 0);
    assertEquals(second.order, 1);
    assertEquals(first.createdBy, "u1");
  },
});

Deno.test({
  name: "getAll — isolated per household and ordered",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    await CategoryRepo.create("hh-a", "Produce", "u1");
    await CategoryRepo.create("hh-b", "Frozen", "u2");
    assertEquals((await CategoryRepo.getAll("hh-a")).map((c) => c.label), [
      "Produce",
    ]);
    assertEquals((await CategoryRepo.getAll("hh-b")).map((c) => c.label), [
      "Frozen",
    ]);
    // Each household's order restarts at 0.
    assertEquals((await CategoryRepo.getAll("hh-b"))[0].order, 0);
  },
});

Deno.test({
  name: "update/delete/reorder — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const a = await CategoryRepo.create("hh-a", "Produce", "u1");
    const b = await CategoryRepo.create("hh-a", "Dairy", "u1");
    // update
    const updated = await CategoryRepo.update("hh-a", a.id, { label: "Fruit" });
    assertEquals(updated?.label, "Fruit");
    // update on wrong household is a no-op miss
    assertEquals(await CategoryRepo.update("hh-b", a.id, { label: "X" }), null);
    // reorder
    await CategoryRepo.reorder("hh-a", [
      { id: a.id, order: 1 },
      { id: b.id, order: 0 },
    ]);
    assertEquals((await CategoryRepo.getAll("hh-a")).map((c) => c.id), [
      b.id,
      a.id,
    ]);
    // delete
    await CategoryRepo.delete("hh-a", a.id);
    assertEquals(await CategoryRepo.getById("hh-a", a.id), null);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A database/category.repo.test.ts`
Expected: FAIL (old arity).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `database/category.repo.ts` with:

```ts
import { CategoryInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

export class CategoryRepo {
  constructor() {}

  static async create(householdId: string, label: string, userId: string) {
    const kv = await getKv();

    const id = crypto.randomUUID();

    // Get current max order to append new category at the end
    const categories = await this.getAll(householdId);
    const maxOrder = categories.reduce(
      (max, cat) =>
        cat.order !== undefined && cat.order > max ? cat.order : max,
      -1,
    );

    const category: CategoryInterface = {
      id,
      label,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const categoryKey = ["categories", householdId, id];
    const ok = await kv.atomic().set(categoryKey, category).commit();
    if (!ok) throw new Error("Something went wrong.");
    return category;
  }

  static async getAll(householdId: string) {
    const kv = await getKv();

    const entries = kv.list<CategoryInterface>({
      prefix: ["categories", householdId],
    });
    const categories = [];
    for await (const entry of entries) {
      categories.push(entry.value);
    }

    // Sort by order field
    return categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(householdId: string, id: string) {
    const kv = await getKv();
    const category = await kv.get<CategoryInterface>([
      "categories",
      householdId,
      id,
    ]);
    return category.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: Partial<CategoryInterface>,
  ) {
    const kv = await getKv();

    const existing = await this.getById(householdId, id);
    if (!existing) return null;

    const updated = mergeDefinedPatch(existing, patch);
    await kv.set(["categories", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string) {
    const kv = await getKv();
    return kv.delete(["categories", householdId, id]);
  }

  static async reorder(
    householdId: string,
    updates: Array<{ id: string; order: number }>,
  ) {
    const kv = await getKv();

    // Batch update all order changes in a transaction
    let atomic = kv.atomic();

    for (const { id, order } of updates) {
      const existing = await this.getById(householdId, id);
      if (existing) {
        const updated = { ...existing, order };
        atomic = atomic.set(["categories", householdId, id], updated);
      }
    }

    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to reorder categories.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A database/category.repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add database/category.repo.ts database/category.repo.test.ts
git commit -m "feat(db): scope CategoryRepo to household"
```

---

### Task 3: Scope `DishRepo` to household

**Files:**
- Modify: `database/dish.repo.ts`
- Test: `database/dish.repo.test.ts` (modify)

**Interfaces:**
- Produces: `DishRepo.create(householdId, dish)`, `getAll(householdId)`, `getById(householdId, id)`, `update(householdId, id, patch)`, `delete(householdId, id)`.

- [ ] **Step 1: Update the test to the scoped API + add isolation**

Replace the entire contents of `database/dish.repo.test.ts` with:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { DishRepo } from "@/database/dish.repo.ts";
import { getKv } from "@/database/db.ts";
import type { CreateDishDto } from "@/models/index.ts";

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
    const created = await DishRepo.create("hh-a", {
      name: "Pasta Bolognese",
      ingredientIds: ["i1", "i2"],
      tagValueIds: ["meat", "main"],
    });
    assertEquals(typeof created.id, "string");
    assertEquals(typeof created.createdAt, "string");
    const fetched = await DishRepo.getById("hh-a", created.id);
    assertEquals(fetched?.name, "Pasta Bolognese");
    assertEquals(fetched?.ingredientIds, ["i1", "i2"]);
    assertEquals(fetched?.tagValueIds, ["meat", "main"]);
  },
});

Deno.test({
  name: "getAll/getById — household A cannot see household B's dishes",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const a = await DishRepo.create("hh-a", {
      name: "Curry",
      ingredientIds: [],
      tagValueIds: [],
    });
    await DishRepo.create("hh-b", {
      name: "Tacos",
      ingredientIds: [],
      tagValueIds: [],
    });
    assertEquals((await DishRepo.getAll("hh-a")).map((d) => d.name), ["Curry"]);
    assertEquals((await DishRepo.getAll("hh-b")).map((d) => d.name), ["Tacos"]);
    assertEquals(await DishRepo.getById("hh-b", a.id), null);
  },
});

Deno.test({
  name: "create — defaults ingredientIds/tagValueIds to [] when omitted",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await DishRepo.create(
      "hh-a",
      { name: "Bare" } as CreateDishDto,
    );
    const fetched = await DishRepo.getById("hh-a", created.id);
    assertEquals(fetched?.ingredientIds, []);
    assertEquals(fetched?.tagValueIds, []);
  },
});

Deno.test({
  name: "update — partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create("hh-a", {
      name: "Curry",
      ingredientIds: ["i1"],
      tagValueIds: ["veg"],
    });
    const updated = await DishRepo.update("hh-a", d.id, { name: "Veggie Curry" });
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
    assertEquals(await DishRepo.update("hh-a", "nope", { name: "x" }), null);
  },
});

Deno.test({
  name: "delete — removes the dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create("hh-a", {
      name: "Toast",
      ingredientIds: [],
      tagValueIds: [],
    });
    await DishRepo.delete("hh-a", d.id);
    assertEquals(await DishRepo.getById("hh-a", d.id), null);
    assertEquals(await DishRepo.getAll("hh-a"), []);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A database/dish.repo.test.ts`
Expected: FAIL (old arity).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `database/dish.repo.ts` with:

```ts
import { CreateDishDto, DishInterface, UpdateDishDto } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

export class DishRepo {
  static async create(
    householdId: string,
    dish: CreateDishDto,
  ): Promise<DishInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const record: DishInterface = {
      ...dish,
      id,
      ingredientIds: dish.ingredientIds ?? [],
      tagValueIds: dish.tagValueIds ?? [],
      createdAt: dish.createdAt ?? new Date().toISOString(),
    };
    const ok = await kv.atomic().set(["dishes", householdId, id], record)
      .commit();
    if (!ok) throw new Error("Failed to create dish.");
    return record;
  }

  static async getAll(householdId: string): Promise<DishInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishInterface>({ prefix: ["dishes", householdId] });
    const dishes: DishInterface[] = [];
    for await (const entry of entries) dishes.push(entry.value);
    return dishes;
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishInterface>(["dishes", householdId, id]);
    return res.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateDishDto,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<DishInterface>(existing, patch);
    await kv.set(["dishes", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["dishes", householdId, id]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A database/dish.repo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add database/dish.repo.ts database/dish.repo.test.ts
git commit -m "feat(db): scope DishRepo to household"
```

---

### Task 4: Scope `DishTagGroupRepo` to household

**Files:**
- Modify: `database/dish-tag-group.repo.ts`
- Test: `database/dish-tag-group.repo.test.ts` (modify)

**Interfaces:**
- Produces: `DishTagGroupRepo.getAll(householdId)`, `getById(householdId, id)`, `ensureDefaults(householdId)`, `addValue(householdId, groupId, label)`.

- [ ] **Step 1: Update the test to the scoped API + add isolation**

Replace the entire contents of `database/dish-tag-group.repo.test.ts` with:

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
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const groups = await DishTagGroupRepo.getAll("hh-a");
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
    await DishTagGroupRepo.ensureDefaults("hh-a");
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const groups = await DishTagGroupRepo.getAll("hh-a");
    assertEquals(groups.length, 3);
  },
});

Deno.test({
  name: "ensureDefaults — seeds each household independently",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    // hh-b has not been seeded yet.
    assertEquals(await DishTagGroupRepo.getAll("hh-b"), []);
    await DishTagGroupRepo.ensureDefaults("hh-b");
    assertEquals((await DishTagGroupRepo.getAll("hh-b")).length, 3);
    // Adding a value to hh-a must not appear in hh-b.
    const [typeA] = await DishTagGroupRepo.getAll("hh-a");
    await DishTagGroupRepo.addValue("hh-a", typeA.id, "Vegan");
    const [typeB] = await DishTagGroupRepo.getAll("hh-b");
    assertEquals(typeB.values.some((v) => v.label === "Vegan"), false);
  },
});

Deno.test({
  name: "addValue — appends a value to a group and returns it",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const [type] = await DishTagGroupRepo.getAll("hh-a");
    const created = await DishTagGroupRepo.addValue("hh-a", type.id, "Vegan");
    assertEquals(created?.label, "Vegan");
    const reloaded = await DishTagGroupRepo.getById("hh-a", type.id);
    assertEquals(reloaded?.values.at(-1)?.label, "Vegan");
  },
});

Deno.test({
  name: "addValue — returns null for a missing group",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    assertEquals(await DishTagGroupRepo.addValue("hh-a", "nope", "x"), null);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A database/dish-tag-group.repo.test.ts`
Expected: FAIL (old arity).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `database/dish-tag-group.repo.ts` with:

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
  static async getAll(householdId: string): Promise<DishTagGroupInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishTagGroupInterface>({
      prefix: ["dish_tag_groups", householdId],
    });
    const groups: DishTagGroupInterface[] = [];
    for await (const entry of entries) groups.push(entry.value);
    return groups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<DishTagGroupInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishTagGroupInterface>([
      "dish_tag_groups",
      householdId,
      id,
    ]);
    return res.value;
  }

  static async ensureDefaults(householdId: string): Promise<void> {
    const kv = await getKv();
    // Seed only when the household's collection is empty.
    for await (
      const _ of kv.list({ prefix: ["dish_tag_groups", householdId] })
    ) return;
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
      atomic = atomic.set(["dish_tag_groups", householdId, group.id], group);
    });
    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to seed dish tag groups.");
  }

  static async addValue(
    householdId: string,
    groupId: string,
    label: string,
  ): Promise<DishTagValueInterface | null> {
    const kv = await getKv();
    const group = await this.getById(householdId, groupId);
    if (!group) return null;
    const value: DishTagValueInterface = {
      id: crypto.randomUUID(),
      label,
    };
    const updated: DishTagGroupInterface = {
      ...group,
      values: [...group.values, value],
    };
    await kv.set(["dish_tag_groups", householdId, groupId], updated);
    return value;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A database/dish-tag-group.repo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add database/dish-tag-group.repo.ts database/dish-tag-group.repo.test.ts
git commit -m "feat(db): scope DishTagGroupRepo and default seeding to household"
```

---

### Task 5: Scope the menu API handlers (`dishes`, `tag-groups`)

**Files:**
- Modify: `routes/api/menu/dishes.ts`
- Modify: `routes/api/menu/tag-groups.ts`
- Test: `routes/api/menu/dishes.test.ts` (modify)
- Test: `routes/api/menu/tag-groups.test.ts` (modify)

**Interfaces:**
- Consumes: `DishRepo.*(householdId, …)` and `DishTagGroupRepo.*(householdId, …)` from Tasks 3–4.
- Produces: `handler.GET/POST/DELETE` reading `ctx.state.householdId`; 401 when absent.

- [ ] **Step 1: Update the dishes test (scoped state + 401)**

Replace the entire contents of `routes/api/menu/dishes.test.ts` with:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/menu/dishes.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = { householdId: "hh-1" },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
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
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/dishes"), {}),
    );
    assertEquals(res.status, 401);
  },
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
  name: "dishes are isolated per household",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    await handler.POST(
      ctx(post({ name: "OnlyA", ingredientIds: [], tagValueIds: [] }), {
        householdId: "hh-a",
      }),
    );
    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/menu/dishes"), { householdId: "hh-b" }),
    )).json();
    assertEquals(bList, []);
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

- [ ] **Step 2: Update the tag-groups test (scoped state + 401)**

Replace the entire contents of `routes/api/menu/tag-groups.test.ts` with:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/menu/tag-groups.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = { householdId: "hh-1" },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearGroups() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dish_tag_groups"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups"), {}),
    );
    assertEquals(res.status, 401);
  },
});

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

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test --unstable-kv -A routes/api/menu/dishes.test.ts routes/api/menu/tag-groups.test.ts`
Expected: FAIL (handlers ignore state / old repo arity).

- [ ] **Step 4: Implement `dishes.ts`**

Replace the entire contents of `routes/api/menu/dishes.ts` with:

```ts
import { DishRepo } from "@/database/dish.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const dishes = await DishRepo.getAll(householdId);
    return new Response(JSON.stringify(dishes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    if (body.id) {
      const updated = await DishRepo.update(householdId, body.id, body);
      if (!updated) return new Response("Dish not found", { status: 404 });
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    const created = await DishRepo.create(householdId, body);
    return new Response(JSON.stringify(created), { status: 201 });
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { id } = await ctx.req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await DishRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
```

- [ ] **Step 5: Implement `tag-groups.ts`**

Replace the entire contents of `routes/api/menu/tag-groups.ts` with:

```ts
import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    await DishTagGroupRepo.ensureDefaults(householdId);
    const groups = await DishTagGroupRepo.getAll(householdId);
    return new Response(JSON.stringify(groups), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { groupId, label } = await ctx.req.json();
    if (!groupId || !label?.trim()) {
      return new Response("groupId and label are required", { status: 400 });
    }
    const value = await DishTagGroupRepo.addValue(
      householdId,
      groupId,
      label.trim(),
    );
    if (!value) return new Response("Group not found", { status: 404 });
    return new Response(JSON.stringify(value), { status: 201 });
  },
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/menu/dishes.test.ts routes/api/menu/tag-groups.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add routes/api/menu/dishes.ts routes/api/menu/tag-groups.ts routes/api/menu/dishes.test.ts routes/api/menu/tag-groups.test.ts
git commit -m "feat(api): scope menu dishes and tag-groups endpoints to household"
```

---

### Task 6: Scope the shopping API handlers (`catalogue`, `categories`)

**Files:**
- Modify: `routes/api/shopping/catalogue.ts`
- Modify: `routes/api/shopping/categories.ts`
- Test: `routes/api/shopping/catalogue.test.ts` (create)
- Test: `routes/api/shopping/categories.test.ts` (create)

**Interfaces:**
- Consumes: `ItemRepo.*(householdId, …)` (Task 1) and `CategoryRepo.*(householdId, …)` (Task 2).
- Produces: `handler.*` reading `ctx.state.householdId` (and `ctx.state.userId` for category writes); 401 when absent.

- [ ] **Step 1: Write the catalogue test**

Create `routes/api/shopping/catalogue.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/shopping/catalogue.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = { householdId: "hh-1" },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearItems() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["items"] })) await kv.delete(e.key);
}
const post = (body: unknown) =>
  new Request("http://x/api/shopping/catalogue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {}),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "POST creates (201) and GET lists only this household's items",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const createRes = await handler.POST(
      ctx(post({ name: "Milk" }), { householdId: "hh-a" }),
    );
    assertEquals(createRes.status, 201);

    const aList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {
        householdId: "hh-a",
      }),
    )).json();
    assertEquals(aList.map((i: { name: string }) => i.name), ["Milk"]);

    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {
        householdId: "hh-b",
      }),
    )).json();
    assertEquals(bList, []);
  },
});

Deno.test({
  name: "DELETE removes an item (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const created = await (await handler.POST(ctx(post({ name: "Bread" }))))
      .json();
    const delReq = new Request("http://x/api/shopping/catalogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/shopping/catalogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
```

- [ ] **Step 2: Write the categories test**

Create `routes/api/shopping/categories.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/shopping/categories.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = {
    householdId: "hh-1",
    userId: "u-1",
  },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearCategories() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["categories"] })) {
    await kv.delete(e.key);
  }
}
const post = (body: unknown) =>
  new Request("http://x/api/shopping/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.POST(ctx(post({ label: "Produce" }), {}));
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "POST creates (201); GET lists only this household's categories",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const res = await handler.POST(
      ctx(post({ label: "Produce" }), { householdId: "hh-a", userId: "u-a" }),
    );
    assertEquals(res.status, 201);

    const aList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/categories"), {
        householdId: "hh-a",
        userId: "u-a",
      }),
    )).json();
    assertEquals(aList.map((c: { label: string }) => c.label), ["Produce"]);

    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/categories"), {
        householdId: "hh-b",
        userId: "u-b",
      }),
    )).json();
    assertEquals(bList, []);
  },
});

Deno.test({
  name: "DELETE removes a category (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const created = await (await handler.POST(ctx(post({ label: "Bakery" }))))
      .json();
    const delReq = new Request("http://x/api/shopping/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/shopping/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test --unstable-kv -A routes/api/shopping/catalogue.test.ts routes/api/shopping/categories.test.ts`
Expected: FAIL (handlers ignore state / old repo arity).

- [ ] **Step 4: Implement `catalogue.ts`**

Replace the entire contents of `routes/api/shopping/catalogue.ts` with:

```ts
import { ItemRepo } from "@/database/item.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const item = await ctx.req.json();
    if (item.id) {
      const existingItem = await ItemRepo.getById(householdId, item.id);
      if (!existingItem) {
        return new Response("Item not found", { status: 404 });
      }
      await ItemRepo.update(householdId, item.id, item);
      return new Response(JSON.stringify({ ...existingItem, ...item }), {
        status: 200,
      });
    }
    const saved = await ItemRepo.create(householdId, item);
    return new Response(JSON.stringify(saved), { status: 201 });
  },
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const items = await ItemRepo.readAll(householdId);
    return new Response(
      JSON.stringify(items),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { id } = await ctx.req.json();
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    await ItemRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
```

- [ ] **Step 5: Implement `categories.ts`**

Replace the entire contents of `routes/api/shopping/categories.ts` with:

```ts
import { CategoryRepo } from "@/database/category.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const categories = await CategoryRepo.getAll(householdId);
    return new Response(
      JSON.stringify(categories),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { label } = await ctx.req.json();
    if (!label || typeof label !== "string" || label.trim() === "") {
      return new Response("Label is required", { status: 400 });
    }
    const category = await CategoryRepo.create(
      householdId,
      label.trim(),
      userId,
    );
    return new Response(JSON.stringify(category), { status: 201 });
  },

  async PATCH(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await ctx.req.json();
    if (Array.isArray(body)) {
      try {
        await CategoryRepo.reorder(householdId, body);
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
    const updated = await CategoryRepo.update(householdId, id, patch);
    if (!updated) {
      return new Response("Category not found", { status: 404 });
    }
    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { id } = await ctx.req.json();
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    await CategoryRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/shopping/catalogue.test.ts routes/api/shopping/categories.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add routes/api/shopping/catalogue.ts routes/api/shopping/categories.ts routes/api/shopping/catalogue.test.ts routes/api/shopping/categories.test.ts
git commit -m "feat(api): scope shopping catalogue and categories endpoints to household"
```

---

### Task 7: Pass `householdId` through the SSR page loaders

**Files:**
- Modify: `routes/menu/index.tsx`
- Modify: `routes/menu/[id]/index.tsx`
- Modify: `routes/menu/new.tsx`
- Modify: `routes/shopping/catalogue/index.tsx`
- Modify: `routes/shopping/categories/index.tsx`
- Modify: `routes/shopping/[id]/index.tsx`
- Modify: `routes/shopping/[id]/add.tsx`

**Interfaces:**
- Consumes: the scoped repos from Tasks 1–4. Uses `ctx.state.householdId!` (middleware guarantees it for authenticated page requests, matching the existing `shopping/index.tsx` / `shopping/[id]/index.tsx` pages).
- Produces: nothing new — same page data, now household-scoped.

There is no unit-test harness for SSR pages in this repo; correctness here is enforced by `deno task check` (a signature mismatch is a type error) plus the browser smoke test in Task 10.

- [ ] **Step 1: Edit `routes/menu/index.tsx`**

Change the `GET` handler body. Replace:

```tsx
  async GET(_ctx) {
    await DishTagGroupRepo.ensureDefaults();
    const [dishes, tagGroups] = await Promise.all([
      DishRepo.getAll(),
      DishTagGroupRepo.getAll(),
    ]);
    return page({ dishes, tagGroups });
  },
```

with:

```tsx
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    await DishTagGroupRepo.ensureDefaults(householdId);
    const [dishes, tagGroups] = await Promise.all([
      DishRepo.getAll(householdId),
      DishTagGroupRepo.getAll(householdId),
    ]);
    return page({ dishes, tagGroups });
  },
```

- [ ] **Step 2: Edit `routes/menu/[id]/index.tsx`**

Replace:

```tsx
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
```

with:

```tsx
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const dish = await DishRepo.getById(householdId, ctx.params.id);
    if (!dish) return new Response("Not found", { status: 404 });
    await DishTagGroupRepo.ensureDefaults(householdId);
    ctx.state.appBar = { mode: "detail", title: dish.name, backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
    ]);
    return page({ dish, tagGroups, items });
  },
```

- [ ] **Step 3: Edit `routes/menu/new.tsx`**

Replace:

```tsx
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    ctx.state.appBar = { mode: "detail", title: "New dish", backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(),
      ItemRepo.readAll(),
    ]);
    return page({ tagGroups, items });
  },
```

with:

```tsx
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    await DishTagGroupRepo.ensureDefaults(householdId);
    ctx.state.appBar = { mode: "detail", title: "New dish", backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
    ]);
    return page({ tagGroups, items });
  },
```

- [ ] **Step 4: Edit `routes/shopping/catalogue/index.tsx`**

Replace:

```tsx
  async GET(_ctx) {
    const [items, categories] = await Promise.all([
      ItemRepo.readAll(),
      CategoryRepo.getAll(),
    ]);
    return page({ items, categories });
  },
```

with:

```tsx
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const [items, categories] = await Promise.all([
      ItemRepo.readAll(householdId),
      CategoryRepo.getAll(householdId),
    ]);
    return page({ items, categories });
  },
```

- [ ] **Step 5: Edit `routes/shopping/categories/index.tsx`**

Replace:

```tsx
  async GET(ctx) {
    ctx.state.appBar = {
      mode: "detail",
      title: "Aisle order",
      backUrl: "/shopping/catalogue",
    };
    const categories = await CategoryRepo.getAll();
    return page({ categories });
  },
```

with:

```tsx
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    ctx.state.appBar = {
      mode: "detail",
      title: "Aisle order",
      backUrl: "/shopping/catalogue",
    };
    const categories = await CategoryRepo.getAll(householdId);
    return page({ categories });
  },
```

- [ ] **Step 6: Edit `routes/shopping/[id]/index.tsx`**

In the `GET` handler, `householdId` is already read. Replace the `Promise.all` block:

```tsx
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
```

with:

```tsx
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(householdId),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(householdId),
    ]);
```

- [ ] **Step 7: Edit `routes/shopping/[id]/add.tsx`**

In the `GET` handler, `householdId` is already read. Replace the `Promise.all` block:

```tsx
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
```

with:

```tsx
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(householdId),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(householdId),
    ]);
```

- [ ] **Step 8: Verify type-check + no leftover unscoped calls**

Run: `deno task check`
Expected: PASS (no type errors).

Run: `grep -rEn "Repo\.(getAll|readAll|getById|ensureDefaults)\(\)" routes/`
Expected: no matches — every catalogue/dish/category repo call now passes an argument. (`ShoppingListItemRepo.getAll(listId)` is list-scoped and intentionally keeps its single argument, so it will not match this pattern.)

- [ ] **Step 9: Commit**

```bash
git add routes/menu routes/shopping
git commit -m "feat(routes): pass householdId into catalogue and dish loaders"
```

---

### Task 8: Give each household its own catalogue in the dev seed

**Files:**
- Modify: `scripts/seed/runner.ts`
- Test: `scripts/seed/runner.test.ts` (modify)

**Interfaces:**
- Consumes: `CategoryRepo.create(householdId, …)`, `ItemRepo.create(householdId, …)` (Tasks 1–2).
- Produces: a seed where every household has a full copy of the fixture categories + catalogue, and its lists reference its own items. `SEED_PREFIXES` also owns `["dishes"]` and `["dish_tag_groups"]`.

- [ ] **Step 1: Update `SEED_PREFIXES` in `scripts/seed/runner.ts`**

Replace:

```ts
/** KV collections owned and rebuilt by the dev seed. */
const SEED_PREFIXES: Deno.KvKey[] = [
  ["users"],
  ["users_by_username"],
  ["households"],
  ["categories"],
  ["items"],
  ["shopping_lists"],
  ["shopping_list_items"],
  ["sessions"],
];
```

with:

```ts
/** KV collections owned and rebuilt by the dev seed. */
const SEED_PREFIXES: Deno.KvKey[] = [
  ["users"],
  ["users_by_username"],
  ["households"],
  ["categories"],
  ["items"],
  ["dishes"],
  ["dish_tag_groups"],
  ["shopping_lists"],
  ["shopping_list_items"],
  ["sessions"],
];
```

- [ ] **Step 2: Rewrite the catalogue/list phases of `runSeed`**

In `scripts/seed/runner.ts`, the phase-1 user loop currently tracks a
`primaryUserId`. Remove that variable — it is no longer used. Delete this line
declaring it (above the loop):

```ts
  let primaryUserId = "";
```

and delete this line inside the loop (the last statement of the loop body):

```ts
    if (i === 0) primaryUserId = id;
```

Then replace everything from the `// 2. Categories …` comment through the end of
the function (the old phases 2, 3, and 4) with a single per-household phase:

```ts
  // 2. Per household: categories + catalogue items + shopping lists. Each
  //    household gets its own copy of the fixture catalogue so the item ids its
  //    lists reference resolve within the same household.
  for (const fixtureUser of users) {
    const userId = userIdBySlug.get(fixtureUser.username)!;
    const householdId = householdIdBySlug.get(fixtureUser.username)!;

    // 2a. Categories (creator = this household's user). Insert in `order` so the
    //     repo's append-at-end ordering reproduces the fixture order.
    const categoryIdBySlug = new Map<string, string>();
    const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
    for (const category of orderedCategories) {
      const created = await CategoryRepo.create(
        householdId,
        category.label,
        userId,
      );
      categoryIdBySlug.set(category.slug, created.id);
    }

    // 2b. Catalogue items (resolve categoryId; undefined => uncategorized).
    const itemIdBySlug = new Map<string, string>();
    for (const item of catalogue) {
      const categoryId = item.categorySlug
        ? categoryIdBySlug.get(item.categorySlug)
        : undefined;
      const created = await ItemRepo.create(householdId, {
        name: item.name,
        categoryId,
      });
      itemIdBySlug.set(item.slug, created.id);
    }

    // 2c. Shopping lists + list items (reference this household's items).
    for (const fixtureList of fixtureUser.lists) {
      const list = await ShoppingListRepo.create({
        householdId,
        name: fixtureList.name,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });
      for (const li of fixtureList.items) {
        const itemId = itemIdBySlug.get(li.itemSlug);
        if (!itemId) {
          throw new Error(`Unknown itemSlug in fixtures: ${li.itemSlug}`);
        }
        const entry = await ShoppingListItemRepo.add(list.id, itemId);
        await ShoppingListItemRepo.update(list.id, entry.id, {
          quantity: li.quantity,
          note: li.note,
          checked: li.checked,
        });
      }
    }
  }
}
```

(The final `}` above closes `runSeed`. Ensure there is exactly one closing brace
for the function after this loop — you are replacing the old phases 2–4 and the
function's original closing brace with this block.)

- [ ] **Step 3: Update `scripts/seed/runner.test.ts` — resetDatabase prefixes**

In the `resetDatabase — clears all seed-owned collections` test, replace the
`prefixes` array:

```ts
    const prefixes = [
      ["users"],
      ["users_by_username"],
      ["households"],
      ["categories"],
      ["items"],
      ["shopping_lists"],
      ["shopping_list_items"],
      ["sessions"],
    ];
```

with:

```ts
    const prefixes = [
      ["users"],
      ["users_by_username"],
      ["households"],
      ["categories"],
      ["items"],
      ["dishes"],
      ["dish_tag_groups"],
      ["shopping_lists"],
      ["shopping_list_items"],
      ["sessions"],
    ];
```

- [ ] **Step 4: Update `scripts/seed/runner.test.ts` — the "inserts …" test**

Replace the entire `runSeed — inserts categories, catalogue, users, lists, and items` test with:

```ts
Deno.test({
  name: "runSeed — inserts categories, catalogue, users, lists, and items",
  sanitizeResources: false,
  async fn() {
    await runSeed();

    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user, `user '${fixtureUser.username}' missing`);
      assert(user.householdId.length > 0);
      const hid = user.householdId;

      // Categories: per household, count + contiguous order.
      const seededCategories = await CategoryRepo.getAll(hid);
      assertEquals(seededCategories.length, categories.length);
      assertEquals(
        seededCategories.map((c) => c.order),
        categories.map((_, i) => i),
      );

      // Catalogue: per household, count + referential integrity + uncategorized.
      const seededItems = await ItemRepo.readAll(hid);
      assertEquals(seededItems.length, catalogue.length);
      const categoryIds = new Set(seededCategories.map((c) => c.id));
      for (const item of seededItems) {
        if (item.categoryId !== undefined) {
          assert(categoryIds.has(item.categoryId), "item has orphan categoryId");
        }
      }
      const expectedUncategorized = catalogue.filter((i) =>
        i.categorySlug === undefined
      ).length;
      const actualUncategorized =
        seededItems.filter((i) => i.categoryId === undefined).length;
      assertEquals(actualUncategorized, expectedUncategorized);

      // Lists + list items reference this household's catalogue.
      const catalogueNames = new Set(seededItems.map((i) => i.name));
      const lists = await ShoppingListRepo.getAll(hid);
      assertEquals(lists.length, fixtureUser.lists.length);
      for (const fixtureList of fixtureUser.lists) {
        const list = lists.find((l) => l.name === fixtureList.name);
        assertExists(list, `list '${fixtureList.name}' missing`);
        const listItems = await ShoppingListItemRepo.getAll(list.id);
        assertEquals(listItems.length, fixtureList.items.length);
        for (const li of listItems) {
          const item = seededItems.find((i) => i.id === li.itemId);
          assertExists(item, "list item references unknown catalogue item");
          assert(catalogueNames.has(item.name));
        }
      }
    }
  },
});
```

- [ ] **Step 5: Update `scripts/seed/runner.test.ts` — the "reproducible" test**

Replace the entire `runSeed — is reproducible (reset then reseed yields identical counts)` test with:

```ts
Deno.test({
  name: "runSeed — is reproducible (reset then reseed yields identical counts)",
  sanitizeResources: false,
  async fn() {
    await runSeed();
    const primary = await UserRepo.findByUsername(users[0].username);
    assertExists(primary);
    const firstCategories =
      (await CategoryRepo.getAll(primary.householdId)).length;
    const firstItems = (await ItemRepo.readAll(primary.householdId)).length;

    await runSeed(); // second run resets and rebuilds

    const primary2 = await UserRepo.findByUsername(users[0].username);
    assertExists(primary2);
    assertEquals(
      (await CategoryRepo.getAll(primary2.householdId)).length,
      firstCategories,
    );
    assertEquals(
      (await ItemRepo.readAll(primary2.householdId)).length,
      firstItems,
    );
    // Exactly the fixture number of users (no duplicates from the second run).
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user);
      const lists = await ShoppingListRepo.getAll(user.householdId);
      assertEquals(lists.length, fixtureUser.lists.length);
    }
  },
});
```

- [ ] **Step 6: Run the seed tests to verify they pass**

Run: `deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: PASS (all tests, including the untouched override/collision tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/seed/runner.ts scripts/seed/runner.test.ts
git commit -m "feat(seed): give each household its own catalogue copy"
```

---

### Task 9: Migrate existing global data to the primary household

**Files:**
- Modify: `scripts/migrate.ts`
- Test: `scripts/migrate.test.ts` (create)

**Interfaces:**
- Produces: exported `scopeGlobalCatalogue(kv: Deno.Kv, householdId: string): Promise<Record<string, number>>` and `resolvePrimaryHouseholdId(kv: Deno.Kv): Promise<string>`, wired into `migrate()`.

- [ ] **Step 1: Write the failing test**

Create `scripts/migrate.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import { scopeGlobalCatalogue } from "./migrate.ts";

async function clearCatalogue() {
  const kv = await getKv();
  for (const c of ["items", "categories", "dishes", "dish_tag_groups"]) {
    for await (const e of kv.list({ prefix: [c] })) await kv.delete(e.key);
  }
}

Deno.test({
  name: "scopeGlobalCatalogue — moves globals under the household, deletes globals",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await kv.set(["categories", "c1"], { id: "c1", label: "Dairy" });
    await kv.set(["dishes", "d1"], { id: "d1", name: "Curry" });
    await kv.set(["dish_tag_groups", "g1"], { id: "g1", label: "Type", values: [] });

    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts, {
      items: 1,
      categories: 1,
      dishes: 1,
      dish_tag_groups: 1,
    });

    // Global keys removed; scoped keys present.
    assertEquals((await kv.get(["items", "i1"])).value, null);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    assertEquals((await kv.get(["dishes", "hh-1", "d1"])).value, {
      id: "d1",
      name: "Curry",
    });
  },
});

Deno.test({
  name: "scopeGlobalCatalogue — idempotent; leaves already-scoped entries",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await scopeGlobalCatalogue(kv, "hh-1");

    // Second run: nothing global left to move.
    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts.items, 0);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    // No stray global (length-2) key reappeared.
    let globals = 0;
    for await (const e of kv.list({ prefix: ["items"] })) {
      if (e.key.length === 2) globals++;
    }
    assertEquals(globals, 0);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A scripts/migrate.test.ts`
Expected: FAIL — `scopeGlobalCatalogue` is not exported yet.

- [ ] **Step 3: Add the migration helpers to `scripts/migrate.ts`**

Add `HouseholdInterface` to the existing models import at the top. Replace:

```ts
import { UserInterface } from "@/models/index.ts";
```

with:

```ts
import { HouseholdInterface, UserInterface } from "@/models/index.ts";
```

Then, immediately above `async function migrate() {`, add these two exported
functions:

```ts
/** Catalogue collections that move from global (`[c, id]`) to household-scoped
 *  (`[c, householdId, id]`). */
const SCOPED_COLLECTIONS = [
  "items",
  "categories",
  "dishes",
  "dish_tag_groups",
] as const;

/**
 * Moves global (length-2) catalogue entries under `householdId`. Idempotent:
 * already-scoped (length-3) keys are skipped, so reruns are safe. Returns the
 * number of entries moved per collection.
 */
export async function scopeGlobalCatalogue(
  kv: Deno.Kv,
  householdId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const collection of SCOPED_COLLECTIONS) {
    let moved = 0;
    for await (const entry of kv.list({ prefix: [collection] })) {
      // key is [collection, id] (global) or [collection, householdId, id].
      if (entry.key.length !== 2) continue; // already scoped → skip
      const id = entry.key[1] as string;
      await kv
        .atomic()
        .set([collection, householdId, id], entry.value)
        .delete(entry.key)
        .commit();
      moved++;
    }
    counts[collection] = moved;
  }
  return counts;
}

/**
 * Resolves which household should own the previously-global catalogue.
 * Uses PRIMARY_USERNAME's household when set; otherwise only auto-resolves when
 * exactly one household exists. Throws rather than guess in an ambiguous DB.
 */
export async function resolvePrimaryHouseholdId(kv: Deno.Kv): Promise<string> {
  const primaryUsername = Deno.env.get("PRIMARY_USERNAME");
  if (primaryUsername) {
    const user = await UserRepo.findByUsername(primaryUsername);
    if (!user) {
      throw new Error(`PRIMARY_USERNAME '${primaryUsername}' not found.`);
    }
    if (!user.householdId) {
      throw new Error(`User '${primaryUsername}' has no household.`);
    }
    return user.householdId;
  }
  const householdIds: string[] = [];
  for await (
    const entry of kv.list<HouseholdInterface>({ prefix: ["households"] })
  ) {
    householdIds.push(entry.value.id);
  }
  if (householdIds.length === 1) return householdIds[0];
  throw new Error(
    `Cannot infer primary household (${householdIds.length} found). ` +
      `Set PRIMARY_USERNAME to choose which household owns the catalogue.`,
  );
}
```

- [ ] **Step 4: Wire the scoping step into `migrate()`**

In `migrate()`, the `try` block ends with the summary `console.log(...)`. Insert
the catalogue-scoping step just before that summary log (after the user `for`
loop closes). Replace:

```ts
    console.log(`
Migration complete.
  Passwords: ${passwordsMigrated} rehashed, ${passwordsSkipped} skipped (mismatch), ${passwordsAlready} already PBKDF2
  Households: ${usersMigrated} migrated, ${itemsMigrated} items moved`);
```

with:

```ts
    // Scope the previously-global catalogue under the primary household.
    const primaryHouseholdId = await resolvePrimaryHouseholdId(kv);
    const scopeCounts = await scopeGlobalCatalogue(kv, primaryHouseholdId);

    console.log(`
Migration complete.
  Passwords: ${passwordsMigrated} rehashed, ${passwordsSkipped} skipped (mismatch), ${passwordsAlready} already PBKDF2
  Households: ${usersMigrated} migrated, ${itemsMigrated} items moved
  Catalogue scoped to household ${primaryHouseholdId}: ${
    JSON.stringify(scopeCounts)
  }`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --unstable-kv -A scripts/migrate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate.ts scripts/migrate.test.ts
git commit -m "feat(migrate): scope global catalogue to the primary household"
```

---

### Task 10: Full verification (check + tests + browser smoke)

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

Run: `deno task check`
Expected: PASS (fmt clean, no lint errors, no type errors). If `deno fmt --check`
fails, run `deno fmt` and amend the relevant commit.

- [ ] **Step 2: Run the full test suite**

Run: `deno task test`
Expected: PASS — all repo, handler, seed, and migrate tests green.

- [ ] **Step 3: Seed and smoke-test in the browser**

Reseed the dev DB and launch the app (see `docs/…browser-e2e` conventions and
memory: isolated KV + worktree port). Then, as the seeded primary user:

- Open `/menu` — the dish catalogue and the three default tag groups render
  (tag groups were lazily seeded for this household).
- Open `/shopping/catalogue` — the full fixture catalogue and categories render.
- Create a dish, add an ingredient, add a tag value — confirm it persists on
  reload.
- Confirm no console errors and no 401s in the network panel for
  `/api/menu/*` and `/api/shopping/*`.

Expected: all pages render household-scoped data; mutations persist.

- [ ] **Step 4: Update memory**

Update the dish-catalogue / issue-42 memory entry to record that #42 is
implemented (household-scoped catalogue + migration + per-household seed) and
note the PR once opened.

---

## Self-Review

**1. Spec coverage:**
- Dishes + tag groups per household → Tasks 3, 4. ✅
- Catalogue items + categories per household → Tasks 1, 2. ✅
- API handlers derive `householdId` from state, no leakage → Tasks 5, 6 (401 + isolation tests). ✅
- SSR loaders scoped → Task 7. ✅
- Existing data migrated without loss → Task 9 (`scopeGlobalCatalogue`, idempotent). ✅
- Default tag groups seeded per household → Task 4 (`ensureDefaults(householdId)`) + per-household seed Task 8. ✅
- Primary-household selection (`PRIMARY_USERNAME`, else sole household, else error) → Task 9 (`resolvePrimaryHouseholdId`). ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**3. Type consistency:** `householdId` is the first argument on every scoped repo method across all tasks. Handler tests cast `ctx` via `Parameters<typeof handler.GET>[0]`. `scopeGlobalCatalogue(kv, householdId)` and `resolvePrimaryHouseholdId(kv)` signatures match between Task 9's implementation, its test, and the `migrate()` call site. ✅
