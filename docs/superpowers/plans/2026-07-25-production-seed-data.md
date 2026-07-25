# Production-like Seed Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal single-user dev seed with a deterministic, hand-authored, production-like dataset (categories, catalogue, and independent demo users with populated shopping lists) that resets and reseeds on every run.

**Architecture:** Hand-authored, slug-referenced fixtures live in `scripts/seed/fixtures.ts`. A pure orchestrator in `scripts/seed/runner.ts` (`resetDatabase()`, `runSeed()`) wipes seed-owned KV collections and rebuilds them via the existing repositories, resolving slugs → generated IDs. A thin `scripts/seed.ts` entrypoint applies a production guard and env-based primary credentials, then calls `runSeed()`.

**Tech Stack:** Deno, Deno KV (`--unstable-kv`), TypeScript, existing repository classes in `database/`, `jsr:@std/assert` for tests.

## Global Constraints

- Imports use the `@/` alias for project root (e.g. `@/database/db.ts`); use relative imports (`./fixtures.ts`) only for sibling files inside `scripts/seed/`.
- All KV access goes through `getKv()` from `@/database/db.ts` — never call `Deno.openKv()` directly. The repos rely on this singleton; the seed must use the same path so tests and repos share one store.
- Tests set `Deno.env.set("KV_PATH", ":memory:")` at module load and use `sanitizeResources: false` (the `getKv()` singleton is never closed by design). This matches `database/shopping-list-item.repo.test.ts`.
- Test assertion import: `import { assert, assertEquals, assertExists } from "jsr:@std/assert@^1.0.19";`
- `docs/` is excluded from `deno fmt`/`lint`/`check`; plan/spec files do not affect `deno task check`.
- Run `deno fmt` on touched files before every commit so `deno task check` stays green.
- Commit messages follow Conventional Commits (e.g. `feat(seed): ...`, `test(seed): ...`, `docs(seed): ...`).
- `deno task db:seed` must keep pointing at `scripts/seed.ts`.

---

## File Structure

- `scripts/seed/fixtures.ts` — **Create.** Fixture types + hand-authored data (`categories`, `catalogue`, `users`). Pure data, no KV access.
- `scripts/seed/fixtures.test.ts` — **Create.** Referential-integrity checks over the fixture data (no KV).
- `scripts/seed/runner.ts` — **Create.** `resetDatabase()`, `runSeed()`, `isProductionEnv()`. Orchestration via repos + `getKv()`.
- `scripts/seed/runner.test.ts` — **Create.** In-memory KV: structure, referential integrity, edge cases, reproducibility, and the guard helper.
- `scripts/seed.ts` — **Modify (full rewrite).** Thin entrypoint: production guard → resolve env primary credentials → `runSeed()` → close KV.
- `README.md` — **Modify.** Add a "Development seed data" section.

---

## Task 1: Fixtures data + integrity test

**Files:**
- Create: `scripts/seed/fixtures.ts`
- Test: `scripts/seed/fixtures.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SeedCategory { slug: string; label: string; order: number }`
  - `interface SeedItem { slug: string; name: string; categorySlug?: string }`
  - `interface SeedListItem { itemSlug: string; quantity: number; note?: string; checked: boolean }`
  - `interface SeedList { name: string; items: SeedListItem[] }`
  - `interface SeedUser { username: string; password: string; lists: SeedList[] }`
  - `const categories: SeedCategory[]`
  - `const catalogue: SeedItem[]`
  - `const users: SeedUser[]`

- [ ] **Step 1: Write the failing integrity test**

Create `scripts/seed/fixtures.test.ts`:

```ts
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { catalogue, categories, users } from "./fixtures.ts";

Deno.test("fixtures — category slugs are unique", () => {
  const slugs = categories.map((c) => c.slug);
  assertEquals(new Set(slugs).size, slugs.length);
});

Deno.test("fixtures — category orders are contiguous from 0", () => {
  const orders = categories.map((c) => c.order).sort((a, b) => a - b);
  assertEquals(orders, categories.map((_, i) => i));
});

Deno.test("fixtures — catalogue slugs are unique", () => {
  const slugs = catalogue.map((i) => i.slug);
  assertEquals(new Set(slugs).size, slugs.length);
});

Deno.test("fixtures — every item categorySlug references a real category", () => {
  const categorySlugs = new Set(categories.map((c) => c.slug));
  for (const item of catalogue) {
    if (item.categorySlug !== undefined) {
      assert(
        categorySlugs.has(item.categorySlug),
        `item '${item.slug}' references unknown category '${item.categorySlug}'`,
      );
    }
  }
});

Deno.test("fixtures — at least one uncategorized catalogue item exists", () => {
  assert(catalogue.some((i) => i.categorySlug === undefined));
});

Deno.test("fixtures — every list item references a real catalogue item", () => {
  const itemSlugs = new Set(catalogue.map((i) => i.slug));
  for (const user of users) {
    for (const list of user.lists) {
      for (const li of list.items) {
        assert(
          itemSlugs.has(li.itemSlug),
          `list '${list.name}' references unknown item '${li.itemSlug}'`,
        );
      }
    }
  }
});

Deno.test("fixtures — usernames are unique", () => {
  const names = users.map((u) => u.username);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("fixtures — includes required edge cases", () => {
  const lists = users.flatMap((u) => u.lists);
  // A non-empty, fully-checked list ("everything bought").
  assert(
    lists.some((l) => l.items.length > 0 && l.items.every((i) => i.checked)),
    "expected a non-empty fully-checked list",
  );
  // An empty list.
  assert(lists.some((l) => l.items.length === 0), "expected an empty list");
  // A high-quantity item.
  assert(
    lists.some((l) => l.items.some((i) => i.quantity >= 20)),
    "expected a high-quantity item",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A scripts/seed/fixtures.test.ts`
Expected: FAIL — module `./fixtures.ts` cannot be resolved (file does not exist).

- [ ] **Step 3: Create the fixtures file**

Create `scripts/seed/fixtures.ts`:

```ts
// Hand-authored, deterministic seed data for local development.
// Entities reference each other by stable `slug`s; the seed runner resolves
// slugs to generated UUIDs at insert time. See
// docs/superpowers/specs/2026-07-25-production-seed-data-design.md.

export interface SeedCategory {
  slug: string;
  label: string;
  order: number;
}

export interface SeedItem {
  slug: string;
  name: string;
  categorySlug?: string;
}

export interface SeedListItem {
  itemSlug: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

export interface SeedList {
  name: string;
  items: SeedListItem[];
}

export interface SeedUser {
  username: string;
  password: string;
  lists: SeedList[];
}

export const categories: SeedCategory[] = [
  { slug: "produce", label: "Produce", order: 0 },
  { slug: "dairy-eggs", label: "Dairy & Eggs", order: 1 },
  { slug: "bakery", label: "Bakery", order: 2 },
  { slug: "meat-fish", label: "Meat & Fish", order: 3 },
  { slug: "pantry", label: "Pantry", order: 4 },
  { slug: "frozen", label: "Frozen", order: 5 },
  { slug: "beverages", label: "Beverages", order: 6 },
  { slug: "household", label: "Household", order: 7 },
];

export const catalogue: SeedItem[] = [
  // Produce
  { slug: "apples", name: "Apples", categorySlug: "produce" },
  { slug: "bananas", name: "Bananas", categorySlug: "produce" },
  { slug: "carrots", name: "Carrots", categorySlug: "produce" },
  { slug: "spinach", name: "Spinach", categorySlug: "produce" },
  { slug: "tomatoes", name: "Tomatoes", categorySlug: "produce" },
  { slug: "potatoes", name: "Potatoes", categorySlug: "produce" },
  { slug: "onions", name: "Onions", categorySlug: "produce" },
  { slug: "garlic", name: "Garlic", categorySlug: "produce" },
  { slug: "avocado", name: "Avocado", categorySlug: "produce" },
  { slug: "lemons", name: "Lemons", categorySlug: "produce" },
  { slug: "cucumber", name: "Cucumber", categorySlug: "produce" },
  { slug: "bell-peppers", name: "Bell Peppers", categorySlug: "produce" },
  // Dairy & Eggs
  { slug: "milk", name: "Milk", categorySlug: "dairy-eggs" },
  { slug: "eggs", name: "Eggs", categorySlug: "dairy-eggs" },
  { slug: "butter", name: "Butter", categorySlug: "dairy-eggs" },
  { slug: "cheddar", name: "Cheddar Cheese", categorySlug: "dairy-eggs" },
  { slug: "yogurt", name: "Yogurt", categorySlug: "dairy-eggs" },
  { slug: "cream", name: "Cream", categorySlug: "dairy-eggs" },
  { slug: "parmesan", name: "Parmesan", categorySlug: "dairy-eggs" },
  // Bakery
  { slug: "bread", name: "Bread", categorySlug: "bakery" },
  { slug: "bagels", name: "Bagels", categorySlug: "bakery" },
  { slug: "croissants", name: "Croissants", categorySlug: "bakery" },
  { slug: "tortillas", name: "Tortillas", categorySlug: "bakery" },
  { slug: "muffins", name: "Muffins", categorySlug: "bakery" },
  // Meat & Fish
  { slug: "chicken-breast", name: "Chicken Breast", categorySlug: "meat-fish" },
  { slug: "ground-beef", name: "Ground Beef", categorySlug: "meat-fish" },
  { slug: "salmon", name: "Salmon Fillet", categorySlug: "meat-fish" },
  { slug: "bacon", name: "Bacon", categorySlug: "meat-fish" },
  { slug: "sausages", name: "Sausages", categorySlug: "meat-fish" },
  { slug: "shrimp", name: "Shrimp", categorySlug: "meat-fish" },
  // Pantry
  { slug: "rice", name: "Rice", categorySlug: "pantry" },
  { slug: "pasta", name: "Pasta", categorySlug: "pantry" },
  { slug: "olive-oil", name: "Olive Oil", categorySlug: "pantry" },
  { slug: "salt", name: "Salt", categorySlug: "pantry" },
  { slug: "black-pepper", name: "Black Pepper", categorySlug: "pantry" },
  { slug: "sugar", name: "Sugar", categorySlug: "pantry" },
  { slug: "flour", name: "Flour", categorySlug: "pantry" },
  { slug: "canned-tomatoes", name: "Canned Tomatoes", categorySlug: "pantry" },
  { slug: "peanut-butter", name: "Peanut Butter", categorySlug: "pantry" },
  { slug: "cereal", name: "Cereal", categorySlug: "pantry" },
  { slug: "honey", name: "Honey", categorySlug: "pantry" },
  { slug: "coffee-beans", name: "Coffee Beans", categorySlug: "pantry" },
  // Frozen
  { slug: "frozen-peas", name: "Frozen Peas", categorySlug: "frozen" },
  { slug: "frozen-pizza", name: "Frozen Pizza", categorySlug: "frozen" },
  { slug: "ice-cream", name: "Ice Cream", categorySlug: "frozen" },
  { slug: "frozen-berries", name: "Frozen Berries", categorySlug: "frozen" },
  // Beverages
  { slug: "orange-juice", name: "Orange Juice", categorySlug: "beverages" },
  { slug: "sparkling-water", name: "Sparkling Water", categorySlug: "beverages" },
  { slug: "cola", name: "Cola", categorySlug: "beverages" },
  { slug: "green-tea", name: "Green Tea", categorySlug: "beverages" },
  { slug: "red-wine", name: "Red Wine", categorySlug: "beverages" },
  // Household
  { slug: "dish-soap", name: "Dish Soap", categorySlug: "household" },
  { slug: "paper-towels", name: "Paper Towels", categorySlug: "household" },
  { slug: "trash-bags", name: "Trash Bags", categorySlug: "household" },
  { slug: "laundry-detergent", name: "Laundry Detergent", categorySlug: "household" },
  { slug: "toilet-paper", name: "Toilet Paper", categorySlug: "household" },
  // Uncategorized (edge: items with no category)
  { slug: "batteries", name: "AA Batteries" },
  { slug: "birthday-candles", name: "Birthday Candles" },
];

export const users: SeedUser[] = [
  {
    // Primary account. The entrypoint overrides username/password from
    // SEED_USERNAME/SEED_PASSWORD when those env vars are set.
    username: "demo",
    password: "password",
    lists: [
      {
        name: "Weekly Groceries",
        items: [
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "eggs", quantity: 1, checked: true },
          {
            itemSlug: "bread",
            quantity: 1,
            note: "Sourdough if they have it",
            checked: false,
          },
          { itemSlug: "bananas", quantity: 6, checked: false },
          { itemSlug: "chicken-breast", quantity: 1, checked: true },
          { itemSlug: "spinach", quantity: 1, checked: false },
          {
            itemSlug: "olive-oil",
            quantity: 1,
            note: "Extra virgin",
            checked: false,
          },
          { itemSlug: "yogurt", quantity: 4, checked: true },
          { itemSlug: "apples", quantity: 5, checked: false },
          { itemSlug: "coffee-beans", quantity: 1, checked: true },
        ],
      },
      {
        name: "Weekend BBQ",
        items: [
          { itemSlug: "sausages", quantity: 3, checked: false },
          { itemSlug: "ground-beef", quantity: 2, checked: false },
          { itemSlug: "tortillas", quantity: 2, checked: false },
          { itemSlug: "bell-peppers", quantity: 3, checked: false },
          {
            itemSlug: "cola",
            quantity: 6,
            note: "For the kids 🥤",
            checked: false,
          },
          { itemSlug: "red-wine", quantity: 2, checked: false },
        ],
      },
      {
        // Edge: a fully-checked list ("everything bought").
        name: "Pantry Restock",
        items: [
          { itemSlug: "rice", quantity: 2, checked: true },
          { itemSlug: "pasta", quantity: 3, checked: true },
          { itemSlug: "canned-tomatoes", quantity: 4, checked: true },
          { itemSlug: "salt", quantity: 1, checked: true },
          { itemSlug: "flour", quantity: 1, checked: true },
        ],
      },
    ],
  },
  {
    username: "alex",
    password: "happie123",
    lists: [
      {
        name: "Groceries",
        items: [
          { itemSlug: "milk", quantity: 1, checked: false },
          { itemSlug: "cheddar", quantity: 1, checked: true },
          { itemSlug: "tomatoes", quantity: 4, checked: false },
          { itemSlug: "pasta", quantity: 2, checked: false },
          {
            itemSlug: "ground-beef",
            quantity: 1,
            note: "80/20",
            checked: true,
          },
          { itemSlug: "orange-juice", quantity: 1, checked: false },
          { itemSlug: "paper-towels", quantity: 1, checked: false },
        ],
      },
      {
        // Edge: an empty list.
        name: "Party Supplies",
        items: [],
      },
    ],
  },
  {
    username: "sam",
    password: "happie123",
    lists: [
      {
        // Edge: a long list spanning every category + an uncategorized item.
        name: "Big Weekly Shop",
        items: [
          { itemSlug: "apples", quantity: 3, checked: false },
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "bread", quantity: 2, checked: false },
          { itemSlug: "salmon", quantity: 2, checked: true },
          {
            // Edge: high quantity.
            itemSlug: "rice",
            quantity: 24,
            note: "Bulk buy for the whole month",
            checked: false,
          },
          { itemSlug: "frozen-peas", quantity: 2, checked: false },
          { itemSlug: "orange-juice", quantity: 3, checked: false },
          { itemSlug: "dish-soap", quantity: 1, checked: false },
          {
            // Edge: a very long note.
            itemSlug: "ice-cream",
            quantity: 2,
            note:
              "The good vanilla — the kind we got last time from the little shop on the corner, not the store brand that nobody in this house will actually eat",
            checked: true,
          },
          // Edge: an uncategorized item on a list.
          { itemSlug: "batteries", quantity: 1, checked: false },
          { itemSlug: "parmesan", quantity: 1, checked: true },
          { itemSlug: "spinach", quantity: 2, checked: false },
          { itemSlug: "coffee-beans", quantity: 1, checked: false },
          { itemSlug: "toilet-paper", quantity: 1, checked: false },
          { itemSlug: "birthday-candles", quantity: 1, note: "🎂", checked: true },
        ],
      },
      {
        // Edge: a very long list name (rename scenario).
        name:
          "Monthly Bulk & Household Restock — Costco Run (don't forget the receipt!)",
        items: [
          { itemSlug: "paper-towels", quantity: 2, checked: false },
          { itemSlug: "laundry-detergent", quantity: 1, checked: false },
          { itemSlug: "trash-bags", quantity: 3, checked: false },
          { itemSlug: "toilet-paper", quantity: 2, checked: false },
        ],
      },
    ],
  },
];
```

- [ ] **Step 4: Format and run the test to verify it passes**

Run: `deno fmt scripts/seed/fixtures.ts scripts/seed/fixtures.test.ts && deno test --unstable-kv -A scripts/seed/fixtures.test.ts`
Expected: PASS — all 8 fixture tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/fixtures.ts scripts/seed/fixtures.test.ts
git commit -m "feat(seed): add hand-authored dev seed fixtures"
```

---

## Task 2: `resetDatabase()` + production guard helper

**Files:**
- Create: `scripts/seed/runner.ts`
- Test: `scripts/seed/runner.test.ts`

**Interfaces:**
- Consumes: `getKv` from `@/database/db.ts`.
- Produces:
  - `function isProductionEnv(deploymentId: string | undefined): boolean`
  - `function resetDatabase(): Promise<void>` — deletes every entry under the seed-owned prefixes.

- [ ] **Step 1: Write the failing test**

Create `scripts/seed/runner.test.ts`:

```ts
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use; set it before any repo/runner call. sanitizeResources is disabled
// because the getKv() singleton is intentionally never closed.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import { isProductionEnv, resetDatabase } from "./runner.ts";

Deno.test("isProductionEnv — true only when a deployment id is present", () => {
  assertEquals(isProductionEnv("some-deploy-id"), true);
  assertEquals(isProductionEnv(""), false);
  assertEquals(isProductionEnv(undefined), false);
});

Deno.test({
  name: "resetDatabase — clears all seed-owned collections",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
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
    // Seed one entry under each prefix.
    for (const p of prefixes) {
      await kv.set([...p, "x"], { marker: true });
    }

    await resetDatabase();

    for (const p of prefixes) {
      let count = 0;
      for await (const _ of kv.list({ prefix: p })) count++;
      assertEquals(count, 0, `prefix ${JSON.stringify(p)} not cleared`);
    }
    assert(true);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: FAIL — module `./runner.ts` cannot be resolved (file does not exist).

- [ ] **Step 3: Create `runner.ts` with the guard + reset**

Create `scripts/seed/runner.ts`:

```ts
import { getKv } from "@/database/db.ts";

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

/** True on Deno Deploy (production), where seeding must never run. */
export function isProductionEnv(deploymentId: string | undefined): boolean {
  return !!deploymentId;
}

/** Deletes every entry under the seed-owned prefixes. */
export async function resetDatabase(): Promise<void> {
  const kv = await getKv();
  for (const prefix of SEED_PREFIXES) {
    for await (const entry of kv.list({ prefix })) {
      await kv.delete(entry.key);
    }
  }
}
```

- [ ] **Step 4: Format and run the test to verify it passes**

Run: `deno fmt scripts/seed/runner.ts scripts/seed/runner.test.ts && deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: PASS — `isProductionEnv` and `resetDatabase` tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/runner.ts scripts/seed/runner.test.ts
git commit -m "feat(seed): add production guard and database reset"
```

---

## Task 3: `runSeed()` orchestration

**Files:**
- Modify: `scripts/seed/runner.ts`
- Test: `scripts/seed/runner.test.ts`

**Interfaces:**
- Consumes: `resetDatabase` (Task 2); `getKv` from `@/database/db.ts`; `HouseholdRepo` (`create(name)`), `CategoryRepo` (`create(label, userId)`), `ItemRepo` (`create({ name, categoryId })`, `readAll()`), `ShoppingListRepo` (`create(dto)`, `getAll(householdId)`), `ShoppingListItemRepo` (`add(listId, itemId)`, `update(listId, id, patch)`, `getAll(listId)`) from `@/database/*`; `hashPassword` from `@/utils/index.ts`; `UserInterface` from `@/models/index.ts`; `categories`, `catalogue`, `users` from `./fixtures.ts`.
- Produces:
  - `interface SeedOptions { primaryUsername?: string; primaryPassword?: string }`
  - `function runSeed(opts?: SeedOptions): Promise<void>` — resets then inserts all fixtures. The first fixture user is the "primary" account; `opts` overrides its username/password (from env in production usage).

- [ ] **Step 1: Write the failing test**

Append to `scripts/seed/runner.test.ts` (extend the imports at the top, then add the tests at the bottom):

```ts
// --- extend the existing runner import to also pull in runSeed ---
// import { isProductionEnv, resetDatabase, runSeed } from "./runner.ts";
// --- and add these imports to the top of the file ---
import { catalogue, categories, users } from "./fixtures.ts";
import { CategoryRepo } from "@/database/category.repo.ts";
import { ItemRepo } from "@/database/item.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";

// --- add at the bottom of the file ---
Deno.test({
  name: "runSeed — inserts categories, catalogue, users, lists, and items",
  sanitizeResources: false,
  async fn() {
    await runSeed();

    // Categories: count + contiguous order.
    const seededCategories = await CategoryRepo.getAll();
    assertEquals(seededCategories.length, categories.length);
    assertEquals(
      seededCategories.map((c) => c.order),
      categories.map((_, i) => i),
    );

    // Catalogue: count + referential integrity + uncategorized preserved.
    const seededItems = await ItemRepo.readAll();
    assertEquals(seededItems.length, catalogue.length);
    const categoryIds = new Set(seededCategories.map((c) => c.id));
    for (const item of seededItems) {
      if (item.categoryId !== undefined) {
        assert(categoryIds.has(item.categoryId), "item has orphan categoryId");
      }
    }
    const expectedUncategorized =
      catalogue.filter((i) => i.categorySlug === undefined).length;
    const actualUncategorized =
      seededItems.filter((i) => i.categoryId === undefined).length;
    assertEquals(actualUncategorized, expectedUncategorized);

    // Users, households, lists, and list items.
    const catalogueNames = new Set(seededItems.map((i) => i.name));
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user, `user '${fixtureUser.username}' missing`);
      assert(user.householdId.length > 0);

      const lists = await ShoppingListRepo.getAll(user.householdId);
      assertEquals(lists.length, fixtureUser.lists.length);

      for (const fixtureList of fixtureUser.lists) {
        const list = lists.find((l) => l.name === fixtureList.name);
        assertExists(list, `list '${fixtureList.name}' missing`);
        const listItems = await ShoppingListItemRepo.getAll(list.id);
        assertEquals(listItems.length, fixtureList.items.length);
        // Every list item references a real catalogue item.
        for (const li of listItems) {
          const item = seededItems.find((i) => i.id === li.itemId);
          assertExists(item, "list item references unknown catalogue item");
          assert(catalogueNames.has(item.name));
        }
      }
    }
  },
});

Deno.test({
  name: "runSeed — a fully-checked list and an empty list both exist",
  sanitizeResources: false,
  async fn() {
    await runSeed();
    let hasFullyChecked = false;
    let hasEmpty = false;
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user);
      const lists = await ShoppingListRepo.getAll(user.householdId);
      for (const list of lists) {
        const items = await ShoppingListItemRepo.getAll(list.id);
        if (items.length === 0) hasEmpty = true;
        if (items.length > 0 && items.every((i) => i.checked)) {
          hasFullyChecked = true;
        }
      }
    }
    assert(hasFullyChecked, "expected a non-empty fully-checked list");
    assert(hasEmpty, "expected an empty list");
  },
});

Deno.test({
  name: "runSeed — is reproducible (reset then reseed yields identical counts)",
  sanitizeResources: false,
  async fn() {
    await runSeed();
    const firstCategories = (await CategoryRepo.getAll()).length;
    const firstItems = (await ItemRepo.readAll()).length;

    await runSeed(); // second run resets and rebuilds

    assertEquals((await CategoryRepo.getAll()).length, firstCategories);
    assertEquals((await ItemRepo.readAll()).length, firstItems);
    // Exactly the fixture number of users (no duplicates from the second run).
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user);
      const lists = await ShoppingListRepo.getAll(user.householdId);
      assertEquals(lists.length, fixtureUser.lists.length);
    }
  },
});

Deno.test({
  name: "runSeed — primary credentials can be overridden",
  sanitizeResources: false,
  async fn() {
    await runSeed({ primaryUsername: "boss", primaryPassword: "s3cret" });
    const overridden = await UserRepo.findByUsername("boss");
    assertExists(overridden, "override username should exist");
    const original = await UserRepo.findByUsername(users[0].username);
    assertEquals(original, null, "default primary username should be replaced");
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: FAIL — `runSeed` is not exported from `./runner.ts`.

- [ ] **Step 3: Implement `runSeed` in `runner.ts`**

Add these imports to the top of `scripts/seed/runner.ts`:

```ts
import { HouseholdRepo } from "@/database/household.repo.ts";
import { CategoryRepo } from "@/database/category.repo.ts";
import { ItemRepo } from "@/database/item.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { hashPassword } from "@/utils/index.ts";
import { UserInterface } from "@/models/index.ts";
import { catalogue, categories, users } from "./fixtures.ts";
```

Append to `scripts/seed/runner.ts`:

```ts
export interface SeedOptions {
  primaryUsername?: string;
  primaryPassword?: string;
}

/**
 * Wipes the seed-owned collections and rebuilds them from the fixtures.
 * The first fixture user is the "primary" account; `opts` overrides its
 * credentials (supplied from SEED_USERNAME/SEED_PASSWORD by the entrypoint).
 */
export async function runSeed(opts: SeedOptions = {}): Promise<void> {
  const kv = await getKv();
  await resetDatabase();

  // 1. Users + households. Bypass UserRepo.create (it force-creates an empty
  //    "Shopping List") and write the same records it would, so fixture lists
  //    are the only lists.
  const userIdBySlug = new Map<string, string>();
  const householdIdBySlug = new Map<string, string>();
  let primaryUserId = "";
  for (let i = 0; i < users.length; i++) {
    const fixtureUser = users[i];
    const username = i === 0
      ? opts.primaryUsername ?? fixtureUser.username
      : fixtureUser.username;
    const password = i === 0
      ? opts.primaryPassword ?? fixtureUser.password
      : fixtureUser.password;

    const household = await HouseholdRepo.create(`${username}'s household`);
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const record: UserInterface = {
      id,
      username,
      passwordHash,
      householdId: household.id,
    };
    await kv
      .atomic()
      .set(["users", id], record)
      .set(["users_by_username", username], record)
      .commit();

    // Key maps by the fixture username so the list phase can look users up
    // regardless of any primary-credential override.
    userIdBySlug.set(fixtureUser.username, id);
    householdIdBySlug.set(fixtureUser.username, household.id);
    if (i === 0) primaryUserId = id;
  }

  // 2. Categories (creator = primary user). Insert in `order` so the repo's
  //    append-at-end ordering reproduces the fixture order.
  const categoryIdBySlug = new Map<string, string>();
  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
  for (const category of orderedCategories) {
    const created = await CategoryRepo.create(category.label, primaryUserId);
    categoryIdBySlug.set(category.slug, created.id);
  }

  // 3. Catalogue items (resolve categoryId; undefined => uncategorized).
  const itemIdBySlug = new Map<string, string>();
  for (const item of catalogue) {
    const categoryId = item.categorySlug
      ? categoryIdBySlug.get(item.categorySlug)
      : undefined;
    const created = await ItemRepo.create({ name: item.name, categoryId });
    itemIdBySlug.set(item.slug, created.id);
  }

  // 4. Shopping lists + list items.
  for (const fixtureUser of users) {
    const userId = userIdBySlug.get(fixtureUser.username)!;
    const householdId = householdIdBySlug.get(fixtureUser.username)!;
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

- [ ] **Step 4: Format and run the test to verify it passes**

Run: `deno fmt scripts/seed/runner.ts scripts/seed/runner.test.ts && deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: PASS — all `runSeed` tests green (structure, edge cases, reproducibility, override).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/runner.ts scripts/seed/runner.test.ts
git commit -m "feat(seed): implement runSeed fixture orchestration"
```

---

## Task 4: Entrypoint rewrite (`scripts/seed.ts`)

**Files:**
- Modify: `scripts/seed.ts` (full rewrite)

**Interfaces:**
- Consumes: `getKv` from `@/database/db.ts`; `isProductionEnv`, `runSeed` from `./seed/runner.ts`.
- Produces: a CLI entrypoint only (no exports relied on by other tasks).

- [ ] **Step 1: Rewrite `scripts/seed.ts`**

Replace the entire contents of `scripts/seed.ts` with:

```ts
// scripts/seed.ts
// Dev-only seed entrypoint. Resets the seed-owned KV collections and rebuilds
// them from hand-authored fixtures. Never runs on Deno Deploy (production).
import { getKv } from "@/database/db.ts";
import { isProductionEnv, runSeed } from "./seed/runner.ts";

async function main() {
  if (isProductionEnv(Deno.env.get("DENO_DEPLOYMENT_ID"))) {
    console.error(
      "❌ Refusing to seed: DENO_DEPLOYMENT_ID is set (production). " +
        "The dev seed is destructive and must only run locally.",
    );
    Deno.exit(1);
  }

  console.log("🌱 Resetting and seeding database...");
  await runSeed({
    primaryUsername: Deno.env.get("SEED_USERNAME") ?? undefined,
    primaryPassword: Deno.env.get("SEED_PASSWORD") ?? undefined,
  });
  console.log("✅ Seed complete.");

  const kv = await getKv();
  kv.close();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Seeding failed:", err);
    Deno.exit(1);
  });
}
```

- [ ] **Step 2: Verify type/lint/format pass**

Run: `deno fmt scripts/seed.ts && deno task check`
Expected: PASS — no fmt diff, no lint errors, no type errors across the project.

- [ ] **Step 3: Verify the full test suite is green**

Run: `deno task test`
Expected: PASS — all tests including `scripts/seed/*.test.ts`.

- [ ] **Step 4: End-to-end smoke test against a throwaway KV**

Seed a throwaway database and inspect it:
```bash
export KV_PATH="$(mktemp -d)/seed-smoke.db"
deno task db:seed
deno task db:view
unset KV_PATH
```
Expected: the seed prints `🌱 Resetting and seeding database...` then `✅ Seed complete.` with no errors; `db:view` then lists `users`, `households`, `categories`, `items`, `shopping_lists`, and `shopping_list_items` entries (`Total entries` well above 100).

Verify the production guard trips (must NOT seed):
```bash
DENO_DEPLOYMENT_ID=fake deno task db:seed; echo "exit=$?"
```
Expected: prints the refusal message and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): reset-and-reseed entrypoint with production guard"
```

---

## Task 5: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: developer-facing docs only.

- [ ] **Step 1: Add a "Development seed data" section to `README.md`**

Append the following to `README.md`:

```markdown
## Development seed data

Populate your local database with a realistic, production-like dataset:

```
deno task db:seed
```

This **resets** the seed-owned collections (users, households, shopping lists
and their items, categories, and the item catalogue) and rebuilds them from
hand-authored fixtures in `scripts/seed/fixtures.ts`. It is **destructive** and
**dev-only** — it refuses to run when `DENO_DEPLOYMENT_ID` is set (Deno Deploy).

What it creates:

- ~8 categories and a ~58-item global catalogue.
- 3 demo users, each with their own household and 1–3 populated shopping lists,
  including deliberate edge cases (a fully-checked list, an empty list, a long
  list spanning every category, long notes/names, high quantities, emoji, and
  uncategorized items).

Demo credentials:

| User | Username | Password |
| --- | --- | --- |
| Primary | `SEED_USERNAME` (default `demo`) | `SEED_PASSWORD` (default `password`) |
| Second | `alex` | `happie123` |
| Third | `sam` | `happie123` |

Set `SEED_USERNAME` / `SEED_PASSWORD` in your `.env` to control the primary
account. To edit the dataset, change `scripts/seed/fixtures.ts` and re-run
`deno task db:seed`.
```

- [ ] **Step 2: Verify the docs render sanity**

Run: `deno task check`
Expected: PASS (README is not linted/typed, but confirm nothing else regressed).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(seed): document development seed data"
```

---

## Self-Review notes

- **Spec coverage:** categories/catalogue/users/lists (Tasks 1, 3); reset-then-reseed (Task 2 + `runSeed`); hand-authored fixtures (Task 1); dev-only guard (Task 2 helper + Task 4 entrypoint); documentation (Task 5); testing incl. reproducibility (Tasks 1–3); credentials incl. env override (Tasks 3–4). All spec sections map to a task.
- **Edge cases:** every edge listed in the spec is present in the Task 1 fixtures and asserted in Tasks 1/3 (fully-checked list, empty list, long list, long note, long name, high quantity, emoji, uncategorized item, shared item across users, mixed checked states).
- **Type consistency:** `runSeed(opts?: SeedOptions)`, `resetDatabase()`, `isProductionEnv(deploymentId)` are named identically across `runner.ts`, its tests, and the entrypoint. Fixture type names (`SeedCategory`/`SeedItem`/`SeedListItem`/`SeedList`/`SeedUser`) and exports (`categories`/`catalogue`/`users`) match between `fixtures.ts` and every consumer. Repo method signatures match those verified in `database/*`.
