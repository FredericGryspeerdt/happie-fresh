# Add This Week's Ingredients to a Shopping List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the _This week_ menu screen, let a household review and push the deduped ingredients of its planned dishes onto one shopping list in a single, atomic write.

**Architecture:** A pure `collectIngredients()` function turns menu entries + dishes + catalogue items + the target list's entries into preview rows (`new` / `on-list` / `bought`). A `useMenuShopping` signals hook drives the flow (pick list → preview → confirm) over the `api` service. Two presentational components (`ShoppingListPickerSheet`, `IngredientPreviewSheet`) render the sheets; the existing `WeeklyMenu` island wires them in. Server-side, `ShoppingListItemRepo.bulkAdd` performs the dedup/uncheck/note rules in one KV atomic commit behind a new `POST /api/shopping/lists/:id/items/bulk` route, and the weekly menu record gains a `shoppingListId` (last-used list) settable through `PATCH /api/menu/plan`.

**Tech Stack:** Deno + Fresh 2 (SSR + islands) + Preact + `@preact/signals` + Deno KV + Tailwind v4. Tests: `deno test --unstable-kv -A` with `jsr:@std/assert`, `jsr:@std/testing/mock`, `npm:preact-render-to-string`.

**Spec:** `docs/superpowers/specs/2026-09-08-menu-to-shopping-list-design.md` (authoritative). Issue: #100.

## Global Constraints

- **Scope:** whole-week action only; no per-dish add (#101), no shopping-side entry (#102), no pantry-staple memory (#103). No quantities on ingredients: `quantity` is always `1` for created entries and is never bumped.
- **Vocabulary** (`CONTEXT.md`): dish, ingredient, item, catalogue, shopping list, weekly menu. Button copy: "Add to shopping list". Confirm copy: "Add N items" / "Add 1 item".
- **Household scoping:** every API handler reads `ctx.state.householdId` and returns 401 when absent; list routes use `authorizeList` and return 403 when the list is not the caller's.
- **Note rule:** never overwrite a non-empty `note`; only fill an empty one. **Dedup rule:** existing unchecked entry → skipped; existing checked entry → `checked: false` (restored); none → created.
- **Conventions:** `@/` import alias; Tailwind `class`; strict types; DTO/interface types in `models/`. Islands and components use `useSignal` for local state; data hooks use module `signal()`/`computed()` and are instantiated once via `useMemo(() => useX(...), [])` in the island (mirror `useWeeklyMenu`).
- **Patterns doc:** creates are pessimistic with `Button loading` (§1/§4); every mutation surfaces failure via Snackbar (§3); typed input lives in `Dialog`, keyboard-less pickers in `Sheet` (§9).
- **Research (per CLAUDE.md):** before Task 3, confirm the Deno KV `atomic()` API (set/check/commit, 1000-mutation limit) via Context7 (`mcp__plugin_context7_context7__resolve-library-id` → `query-docs`). Before Task 4, confirm Fresh 2 `define.handlers` + `ctx.params` usage the same way.
- **Commits:** Conventional Commits. Every commit ends with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (second `-m`). Commit after each task. Run `deno fmt` before each commit.
- **Test runner:** single file → `deno test --unstable-kv -A <path>`; everything → `deno task test`; gates → `deno task check`.

## File Structure

- **Modify** `models/menu/weekly-menu.interface.ts` — `shoppingListId?: string`.
- **Create** `models/shopping-list/shopping-list-bulk.interface.ts` — `BulkAddItemInput`, `BulkAddResult`; export via `models/shopping-list/index.ts`.
- **Modify** `database/weekly-menu.repo.ts` — `setShoppingList`.
- **Modify** `database/shopping-list-item.repo.ts` — `bulkAdd`.
- **Create** `routes/api/shopping/lists/[id]/items/bulk.ts` — `POST`.
- **Modify** `routes/api/menu/plan.ts` — `PATCH { shoppingListId }`.
- **Modify** `services/api.ts` — `api.shoppingList.bulkAdd`, `api.weeklyMenu.setShoppingList`.
- **Create** `utils/menu-ingredients.ts` — `collectIngredients`, `noteFor`, row types.
- **Create** `hooks/useMenuShopping.ts` — flow hook.
- **Create** `components/menu/ShoppingListPickerSheet.tsx` — list picker (Sheet) + new-list Dialog.
- **Create** `components/menu/IngredientPreviewSheet.tsx` — review sheet.
- **Modify** `islands/menu/WeeklyMenu.tsx` — button, sheets, snackbar; new `initialItems` prop.
- **Modify** `routes/menu/index.tsx` — load catalogue items.
- **Modify** `docs/ui-ux-patterns.md` — §19 bulk writes.
- **Tests:** `database/weekly-menu.repo.test.ts`, `database/shopping-list-item.repo.test.ts`, `routes/api/shopping/lists/[id]/items/bulk.test.ts`, `routes/api/menu/plan.test.ts`, `utils/menu-ingredients.test.ts`, `hooks/useMenuShopping.test.ts`, `components/menu/ShoppingListPickerSheet.test.tsx`, `components/menu/IngredientPreviewSheet.test.tsx`, `islands/menu/WeeklyMenu.test.tsx`.

---

### Task 1: Types + glossary + spec commit

**Files:**
- Modify: `models/menu/weekly-menu.interface.ts`
- Create: `models/shopping-list/shopping-list-bulk.interface.ts`
- Modify: `models/shopping-list/index.ts`
- Already edited (uncommitted): `CONTEXT.md`, `docs/superpowers/specs/2026-09-08-menu-to-shopping-list-design.md`

**Interfaces:**
- Produces: `WeeklyMenuInterface.shoppingListId?: string`; `BulkAddItemInput { itemId: string; note?: string }`; `BulkAddResult { added: ShoppingListItemInterface[]; restored: ShoppingListItemInterface[]; skipped: string[] }`, all exported from `@/models/index.ts`.

- [ ] **Step 1: Add the remembered-list field**

In `models/menu/weekly-menu.interface.ts`, change `WeeklyMenuInterface` to:

```ts
export interface WeeklyMenuInterface {
  householdId: string;
  entries: MenuEntryInterface[];
  // Last shopping list this week's ingredients were added to
  // (→ ["shopping_lists", householdId, id]). A preference, not a "was this
  // shopped" flag — the list itself is the source of truth.
  shoppingListId?: string;
  updatedAt?: string; // ISO string, stamped on each mutation
}
```

- [ ] **Step 2: Add the bulk-add types**

Create `models/shopping-list/shopping-list-bulk.interface.ts`:

```ts
import type { ShoppingListItemInterface } from "./shopping-list-item.interface.ts";

// One ingredient to put on a list. `note` is only applied to entries the bulk
// add creates or to existing entries whose note is empty.
export interface BulkAddItemInput {
  itemId: string;
  note?: string;
}

export interface BulkAddResult {
  // Entries created by this call (quantity 1, unchecked).
  added: ShoppingListItemInterface[];
  // Entries that were checked ("bought") and are now unchecked again.
  restored: ShoppingListItemInterface[];
  // Item ids that were already on the list, unchecked — left as they were.
  skipped: string[];
}
```

Append to `models/shopping-list/index.ts`:

```ts
export * from "./shopping-list-bulk.interface.ts";
```

- [ ] **Step 3: Type-check**

Run: `deno check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
deno fmt
git add CONTEXT.md docs/superpowers/specs/2026-09-08-menu-to-shopping-list-design.md docs/superpowers/plans/2026-09-08-menu-to-shopping-list.md models/menu/weekly-menu.interface.ts models/shopping-list/shopping-list-bulk.interface.ts models/shopping-list/index.ts
git commit -m "feat(menu): types for adding week ingredients to a shopping list" -m "Adds shoppingListId to the weekly menu, bulk-add DTOs, the design spec, and the Shopping/Meals glossary terms. Part of #100." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `WeeklyMenuRepo.setShoppingList`

**Files:**
- Modify: `database/weekly-menu.repo.ts`
- Test: `database/weekly-menu.repo.test.ts`

**Interfaces:**
- Consumes: `WeeklyMenuRepo.mutate` (private CAS helper, already present).
- Produces: `static setShoppingList(householdId: string, shoppingListId: string): Promise<WeeklyMenuInterface>`.

- [ ] **Step 1: Write the failing tests**

Append to `database/weekly-menu.repo.test.ts`:

```ts
Deno.test({
  name: "setShoppingList — remembers the list and keeps entries",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    const m = await WeeklyMenuRepo.setShoppingList("h1", "list-a");
    assertEquals(m.shoppingListId, "list-a");
    assertEquals(m.entries.map((e) => e.dishId), ["d1"]);
    assertEquals((await WeeklyMenuRepo.get("h1")).shoppingListId, "list-a");
  },
});

Deno.test({
  name: "setShoppingList — same list again does not persist anything",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.setShoppingList("h1", "list-a");
    const before = await storedVersionstamp("h1");
    await WeeklyMenuRepo.setShoppingList("h1", "list-a");
    assertEquals(await storedVersionstamp("h1"), before);
  },
});

Deno.test({
  name: "setShoppingList — works on a household with no menu yet",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const m = await WeeklyMenuRepo.setShoppingList("fresh-h", "list-b");
    assertEquals(m.entries, []);
    assertEquals(m.shoppingListId, "list-b");
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A database/weekly-menu.repo.test.ts`
Expected: FAIL — `setShoppingList is not a function`.

- [ ] **Step 3: Implement**

Add to `WeeklyMenuRepo` (after `clear`):

```ts
  // Remember which shopping list this week's ingredients go to. A household-
  // wide preference: the next person to open the picker sees it preselected.
  static async setShoppingList(
    householdId: string,
    shoppingListId: string,
  ): Promise<WeeklyMenuInterface> {
    return await this.mutate(
      householdId,
      (current) =>
        current.shoppingListId === shoppingListId
          ? null
          : { ...current, shoppingListId },
    );
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A database/weekly-menu.repo.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
deno fmt
git add database/weekly-menu.repo.ts database/weekly-menu.repo.test.ts
git commit -m "feat(menu): remember the last-used shopping list on the weekly menu" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `ShoppingListItemRepo.bulkAdd`

**Files:**
- Modify: `database/shopping-list-item.repo.ts`
- Test: `database/shopping-list-item.repo.test.ts`

**Interfaces:**
- Consumes: `BulkAddItemInput`, `BulkAddResult` from `@/models/index.ts`.
- Produces: `static bulkAdd(listId: string, inputs: BulkAddItemInput[]): Promise<BulkAddResult>`.

- [ ] **Step 0: Research**

Confirm via Context7 (`deno` → "Deno.Kv atomic set commit mutation limit") that `kv.atomic().set(...).commit()` returns `{ ok }` and the per-commit mutation cap is 1000. The route (Task 4) caps input at 500, so one commit always fits.

- [ ] **Step 1: Write the failing tests**

Open `database/shopping-list-item.repo.test.ts`; keep its existing imports and KV setup. Add at the top (if not already imported):

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { getKv } from "@/database/db.ts";
```

and a helper + tests at the bottom:

```ts
async function clearListItems(listId: string) {
  const kv = await getKv();
  for await (
    const e of kv.list({ prefix: ["shopping_list_items", listId] })
  ) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "bulkAdd — creates unchecked entries with quantity 1 and the note",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L1");
    const res = await ShoppingListItemRepo.bulkAdd("L1", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "rice" },
    ]);
    assertEquals(res.added.length, 2);
    assertEquals(res.restored, []);
    assertEquals(res.skipped, []);
    const all = await ShoppingListItemRepo.getAll("L1");
    const pasta = all.find((li) => li.itemId === "pasta")!;
    assertEquals(pasta.quantity, 1);
    assertEquals(pasta.checked, false);
    assertEquals(pasta.note, "Lasagne");
    assertEquals(all.find((li) => li.itemId === "rice")!.note, undefined);
  },
});

Deno.test({
  name: "bulkAdd — an unchecked existing entry is skipped; empty note is filled, written note is kept",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L2");
    const a = await ShoppingListItemRepo.add("L2", "pasta");
    const b = await ShoppingListItemRepo.add("L2", "milk");
    await ShoppingListItemRepo.update("L2", b.id, { note: "the blue one" });
    const res = await ShoppingListItemRepo.bulkAdd("L2", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "milk", note: "Pancakes" },
    ]);
    assertEquals(res.added, []);
    assertEquals(res.restored, []);
    assertEquals(new Set(res.skipped), new Set(["pasta", "milk"]));
    const all = await ShoppingListItemRepo.getAll("L2");
    assertEquals(all.length, 2);
    assertEquals(all.find((li) => li.id === a.id)!.note, "Lasagne");
    assertEquals(all.find((li) => li.id === b.id)!.note, "the blue one");
  },
});

Deno.test({
  name: "bulkAdd — a checked existing entry is restored (unchecked), not duplicated",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L3");
    const a = await ShoppingListItemRepo.add("L3", "pasta");
    await ShoppingListItemRepo.update("L3", a.id, { checked: true });
    const res = await ShoppingListItemRepo.bulkAdd("L3", [
      { itemId: "pasta", note: "Lasagne" },
    ]);
    assertEquals(res.added, []);
    assertEquals(res.restored.map((li) => li.id), [a.id]);
    assertEquals(res.restored[0].checked, false);
    assertEquals(res.restored[0].note, "Lasagne");
    const all = await ShoppingListItemRepo.getAll("L3");
    assertEquals(all.length, 1);
    assertEquals(all[0].checked, false);
  },
});

Deno.test({
  name: "bulkAdd — repeated item ids in the input are collapsed to one entry",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L4");
    const res = await ShoppingListItemRepo.bulkAdd("L4", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "pasta", note: "Carbonara" },
    ]);
    assertEquals(res.added.length, 1);
    assertEquals((await ShoppingListItemRepo.getAll("L4")).length, 1);
  },
});

Deno.test({
  name: "bulkAdd — when the list holds both a checked and an unchecked entry for an item, the unchecked one wins (skipped)",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L5");
    const bought = await ShoppingListItemRepo.add("L5", "pasta");
    await ShoppingListItemRepo.update("L5", bought.id, { checked: true });
    await ShoppingListItemRepo.add("L5", "pasta");
    const res = await ShoppingListItemRepo.bulkAdd("L5", [{ itemId: "pasta" }]);
    assertEquals(res.skipped, ["pasta"]);
    assertEquals(res.restored, []);
    assertEquals(
      (await ShoppingListItemRepo.getAll("L5")).find((li) =>
        li.id === bought.id
      )!.checked,
      true,
    );
  },
});

Deno.test({
  name: "bulkAdd — empty input writes nothing",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L6");
    const res = await ShoppingListItemRepo.bulkAdd("L6", []);
    assertEquals(res, { added: [], restored: [], skipped: [] });
    assertEquals(await ShoppingListItemRepo.getAll("L6"), []);
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A database/shopping-list-item.repo.test.ts`
Expected: FAIL — `bulkAdd is not a function`.

- [ ] **Step 3: Implement**

In `database/shopping-list-item.repo.ts`, extend the import and add the method:

```ts
import type {
  BulkAddItemInput,
  BulkAddResult,
  ShoppingListItemInterface,
} from "@/models/index.ts";
```

```ts
  // Put many items on a list at once (the weekly-menu "Add to shopping list"
  // action). The rules live here, not in the caller, so two people tapping at
  // once cannot double-add:
  //   - no entry for the item      → create it (quantity 1, unchecked, note)
  //   - unchecked entry exists     → skip; fill its note only if empty
  //   - checked entry exists       → uncheck it ("restored"); fill note if empty
  // Never overwrites a written note, never bumps quantity. One atomic commit.
  static async bulkAdd(
    listId: string,
    inputs: BulkAddItemInput[],
  ): Promise<BulkAddResult> {
    const kv = await getKv();
    const existing = await this.getAll(listId);
    // One entry per item; when the list holds duplicates, an unchecked entry
    // is the one that represents "still to buy".
    const byItem = new Map<string, ShoppingListItemInterface>();
    for (const li of existing) {
      const cur = byItem.get(li.itemId);
      if (!cur || (cur.checked && !li.checked)) byItem.set(li.itemId, li);
    }

    const result: BulkAddResult = { added: [], restored: [], skipped: [] };
    const seen = new Set<string>();
    let atomic = kv.atomic();
    let writes = 0;

    for (const input of inputs) {
      if (seen.has(input.itemId)) continue;
      seen.add(input.itemId);
      const cur = byItem.get(input.itemId);

      if (!cur) {
        const entry: ShoppingListItemInterface = {
          id: crypto.randomUUID(),
          listId,
          itemId: input.itemId,
          quantity: 1,
          checked: false,
          ...(input.note ? { note: input.note } : {}),
        };
        atomic = atomic.set(["shopping_list_items", listId, entry.id], entry);
        writes++;
        result.added.push(entry);
        continue;
      }

      const note = cur.note?.trim() ? cur.note : input.note;
      const next: ShoppingListItemInterface = {
        ...cur,
        checked: false,
        ...(note ? { note } : {}),
      };
      if (cur.checked) result.restored.push(next);
      else result.skipped.push(cur.itemId);
      if (next.checked !== cur.checked || next.note !== cur.note) {
        atomic = atomic.set(["shopping_list_items", listId, cur.id], next);
        writes++;
      }
    }

    if (writes > 0) {
      const { ok } = await atomic.commit();
      if (!ok) throw new Error("Failed to add items to the list.");
    }
    return result;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A database/shopping-list-item.repo.test.ts`
Expected: PASS (all, including pre-existing tests).

- [ ] **Step 5: Commit**

```bash
deno fmt
git add database/shopping-list-item.repo.ts database/shopping-list-item.repo.test.ts
git commit -m "feat(shopping): atomic bulk add with dedup, restore and note rules" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `POST /api/shopping/lists/:id/items/bulk` + client

**Files:**
- Create: `routes/api/shopping/lists/[id]/items/bulk.ts`
- Test: `routes/api/shopping/lists/[id]/items/bulk.test.ts`
- Modify: `services/api.ts` (inside `shoppingList`)

**Interfaces:**
- Consumes: `ShoppingListItemRepo.bulkAdd`, `authorizeList(ctx, listId)`, `ItemRepo.readAll(householdId)`, `json`/`badRequest` from `@/utils/index.ts`.
- Produces: HTTP `POST` body `{ items: BulkAddItemInput[] }` → `201 BulkAddResult`; `api.shoppingList.bulkAdd(listId: string, items: BulkAddItemInput[]): Promise<BulkAddResult | null>`.

- [ ] **Step 0: Research**

Confirm via Context7 (`fresh` → "define.handlers ctx.params ctx.state") that `ctx.params.id` and `ctx.req.json()` are the current Fresh 2 accessors (they are what `items.ts` uses today).

- [ ] **Step 1: Write the failing tests**

Create `routes/api/shopping/lists/[id]/items/bulk.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/shopping/lists/[id]/items/bulk.ts";
import {
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
} from "@/database/index.ts";
import { getKv } from "@/database/db.ts";
import type { StateInterface } from "@/utils/index.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  id: string,
  householdId: string | undefined = "h1",
): Context<StateInterface> {
  return {
    req,
    params: { id },
    state: { householdId },
  } as unknown as Context<StateInterface>;
}

async function clearAll() {
  const kv = await getKv();
  for (
    const prefix of [["shopping_lists"], ["shopping_list_items"], ["items"]]
  ) {
    for await (const e of kv.list({ prefix })) await kv.delete(e.key);
  }
}

async function seedList(householdId = "h1") {
  return await ShoppingListRepo.create({
    householdId,
    name: "Groceries",
    createdBy: "m1",
    createdAt: new Date().toISOString(),
  });
}

const post = (listId: string, body: unknown) =>
  new Request(`http://x/api/shopping/lists/${listId}/items/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test({
  name: "POST — 403 when the list belongs to another household",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList("h2");
    const res = await handler.POST(
      ctx(post(list.id, { items: [{ itemId: "x" }] }), list.id),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "POST — 400 on malformed JSON, missing items, empty items, bad entries",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    for (
      const body of [
        "not json",
        {},
        { items: [] },
        { items: [{}] },
        { items: [{ itemId: 3 }] },
        { items: [{ itemId: "a", note: 5 }] },
      ]
    ) {
      const res = await handler.POST(ctx(post(list.id, body), list.id));
      assertEquals(res.status, 400, JSON.stringify(body));
    }
  },
});

Deno.test({
  name: "POST — 400 when more than 500 items are sent",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const items = Array.from({ length: 501 }, (_, i) => ({ itemId: `i${i}` }));
    const res = await handler.POST(ctx(post(list.id, { items }), list.id));
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "POST — 201 with added/restored/skipped; unknown catalogue items are ignored",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const pasta = await ItemRepo.create("h1", { name: "Pasta" });
    const milk = await ItemRepo.create("h1", { name: "Milk" });
    const bought = await ShoppingListItemRepo.add(list.id, milk.id);
    await ShoppingListItemRepo.update(list.id, bought.id, { checked: true });

    const res = await handler.POST(
      ctx(
        post(list.id, {
          items: [
            { itemId: pasta.id, note: "Lasagne" },
            { itemId: milk.id, note: "Pancakes" },
            { itemId: "deleted-item" },
          ],
        }),
        list.id,
      ),
    );
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.added.map((li: { itemId: string }) => li.itemId), [
      pasta.id,
    ]);
    assertEquals(body.restored.map((li: { id: string }) => li.id), [bought.id]);
    assertEquals(body.skipped, []);
    const all = await ShoppingListItemRepo.getAll(list.id);
    assertEquals(all.length, 2);
    assertEquals(all.some((li) => li.itemId === "deleted-item"), false);
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A "routes/api/shopping/lists/[id]/items/bulk.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `routes/api/shopping/lists/[id]/items/bulk.ts`:

```ts
import { ItemRepo, ShoppingListItemRepo } from "@/database/index.ts";
import type { BulkAddItemInput } from "@/models/index.ts";
import { badRequest, define, json } from "@/utils/index.ts";
import { authorizeList } from "@/utils/authorize-list.ts";

// Deno KV allows 1000 mutations per atomic commit; bulkAdd writes at most one
// per item, so 500 leaves comfortable headroom.
const MAX_ITEMS = 500;

function parseItems(body: unknown): BulkAddItemInput[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > MAX_ITEMS) return null;
  const out: BulkAddItemInput[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const { itemId, note } = raw as { itemId?: unknown; note?: unknown };
    if (typeof itemId !== "string" || itemId.length === 0) return null;
    if (note !== undefined && typeof note !== "string") return null;
    out.push(note ? { itemId, note } : { itemId });
  }
  return out;
}

export const handler = define.handlers({
  // Put many catalogue items on this list at once. Dedup/restore/note rules
  // are applied by ShoppingListItemRepo.bulkAdd in one atomic commit.
  async POST(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest("invalid JSON");
    }
    const items = parseItems(body);
    if (!items) return badRequest("items required");
    // Ingredients whose catalogue item was deleted are dropped silently.
    const known = new Set(
      (await ItemRepo.readAll(list.householdId)).map((i) => i.id),
    );
    const result = await ShoppingListItemRepo.bulkAdd(
      list.id,
      items.filter((i) => known.has(i.itemId)),
    );
    return json(result, 201);
  },
});
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A "routes/api/shopping/lists/[id]/items/bulk.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the client call**

In `services/api.ts`, extend the models import with `BulkAddItemInput, BulkAddResult` and add inside `shoppingList` (after `clearChecked`):

```ts
    bulkAdd: async (
      listId: string,
      items: BulkAddItemInput[],
    ): Promise<BulkAddResult | null> => {
      const res = await fetch(`/api/shopping/lists/${listId}/items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) return null;
      return res.json();
    },
```

Run: `deno check` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
deno fmt
git add "routes/api/shopping/lists/[id]/items/bulk.ts" "routes/api/shopping/lists/[id]/items/bulk.test.ts" services/api.ts
git commit -m "feat(shopping): bulk add endpoint for a shopping list" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `PATCH /api/menu/plan { shoppingListId }` + client

**Files:**
- Modify: `routes/api/menu/plan.ts`
- Test: `routes/api/menu/plan.test.ts`
- Modify: `services/api.ts` (inside `weeklyMenu`)

**Interfaces:**
- Consumes: `WeeklyMenuRepo.setShoppingList`, `ShoppingListRepo.getById(householdId, id)`.
- Produces: `PATCH` body `{ shoppingListId: string }` → `200 WeeklyMenuInterface`, `400` when the list is not the household's; `api.weeklyMenu.setShoppingList(shoppingListId: string): Promise<WeeklyMenuInterface | null>`.

- [ ] **Step 1: Write the failing tests**

Append to `routes/api/menu/plan.test.ts` (add `ShoppingListRepo` to the existing `@/database/index.ts` import):

```ts
async function clearLists() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["shopping_lists"] })) {
    await kv.delete(e.key);
  }
}
async function seedList(householdId = "h1") {
  return await ShoppingListRepo.create({
    householdId,
    name: "Groceries",
    createdBy: "m1",
    createdAt: new Date().toISOString(),
  });
}

Deno.test({
  name: "PATCH { shoppingListId } remembers the household's list",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearLists();
    const list = await seedList();
    const res = await handler.PATCH(
      ctx(req("PATCH", { shoppingListId: list.id })),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).shoppingListId, list.id);
    assertEquals(
      (await (await handler.GET(ctx(req("GET")))).json()).shoppingListId,
      list.id,
    );
  },
});

Deno.test({
  name: "PATCH { shoppingListId } is 400 for an unknown or foreign list",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearLists();
    const foreign = await seedList("h2");
    assertEquals(
      (await handler.PATCH(ctx(req("PATCH", { shoppingListId: "nope" }))))
        .status,
      400,
    );
    assertEquals(
      (await handler.PATCH(
        ctx(req("PATCH", { shoppingListId: foreign.id })),
      )).status,
      400,
    );
    assertEquals(
      (await (await handler.GET(ctx(req("GET")))).json()).shoppingListId,
      undefined,
    );
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A routes/api/menu/plan.test.ts`
Expected: FAIL — first new test gets 400 ("entryId required").

- [ ] **Step 3: Implement**

In `routes/api/menu/plan.ts`, import `ShoppingListRepo` alongside the others and replace the `PATCH` handler with:

```ts
  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return badRequest("invalid JSON");
    const { entryId, day, shoppingListId } = parsed.body as {
      entryId?: string;
      day?: Weekday | null;
      shoppingListId?: string;
    };
    // Remember the shopping list this week's ingredients go to.
    if (shoppingListId !== undefined) {
      if (typeof shoppingListId !== "string" || !shoppingListId) {
        return badRequest("invalid shoppingListId");
      }
      const list = await ShoppingListRepo.getById(householdId, shoppingListId);
      if (!list) return badRequest("unknown shopping list");
      return json(
        await WeeklyMenuRepo.setShoppingList(householdId, shoppingListId),
      );
    }
    if (!entryId) return badRequest("entryId required");
    if (day !== null && !WEEKDAY_ORDER.includes(day as Weekday)) {
      return badRequest("invalid day");
    }
    return json(await WeeklyMenuRepo.setDay(householdId, entryId, day ?? null));
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A routes/api/menu/plan.test.ts`
Expected: PASS (all, including the pre-existing PATCH tests).

- [ ] **Step 5: Add the client call**

In `services/api.ts`, inside `weeklyMenu` (after `clear`):

```ts
    setShoppingList: async (
      shoppingListId: string,
    ): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shoppingListId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
```

Run: `deno check` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
deno fmt
git add routes/api/menu/plan.ts routes/api/menu/plan.test.ts services/api.ts
git commit -m "feat(menu): PATCH the remembered shopping list on the weekly menu" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `collectIngredients` (pure preview builder)

**Files:**
- Create: `utils/menu-ingredients.ts`
- Test: `utils/menu-ingredients.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type IngredientState = "new" | "on-list" | "bought";
  export interface IngredientRow { itemId: string; name: string; dishNames: string[]; state: IngredientState }
  export interface IngredientPreview { rows: IngredientRow[]; emptyDishes: DishInterface[] }
  export function collectIngredients(entries: MenuEntryInterface[], dishes: DishInterface[], items: ItemInterface[], listItems: ShoppingListItemInterface[]): IngredientPreview
  export function noteFor(row: IngredientRow): string   // "Lasagne, Curry"
  ```

- [ ] **Step 1: Write the failing tests**

Create `utils/menu-ingredients.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { collectIngredients, noteFor } from "@/utils/menu-ingredients.ts";
import type {
  DishInterface,
  ItemInterface,
  MenuEntryInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

const items: ItemInterface[] = [
  { id: "pasta", name: "pasta" },
  { id: "mince", name: "Mince" },
  { id: "rice", name: "rice" },
  { id: "curry", name: "Curry paste" },
];
const dishes: DishInterface[] = [
  { id: "d1", name: "Lasagne", ingredientIds: ["pasta", "mince"], tagValueIds: [] },
  { id: "d2", name: "Curry", ingredientIds: ["rice", "curry", "mince"], tagValueIds: [] },
  { id: "d3", name: "Pizza night", ingredientIds: [], tagValueIds: [] },
  { id: "d4", name: "Ghost", ingredientIds: ["gone"], tagValueIds: [] },
];
const entries: MenuEntryInterface[] = [
  { id: "e1", dishId: "d1", day: "Mon" },
  { id: "e2", dishId: "d2", day: null },
  { id: "e3", dishId: "d3", day: null },
  { id: "e4", dishId: "d4", day: null },
  { id: "e5", dishId: "deleted-dish", day: null },
];
const li = (
  itemId: string,
  checked: boolean,
  id = crypto.randomUUID(),
): ShoppingListItemInterface => ({
  id,
  listId: "L",
  itemId,
  quantity: 1,
  checked,
});

Deno.test("collectIngredients — dedups across dishes, sorts case-insensitively, keeps dish order in dishNames", () => {
  const { rows } = collectIngredients(entries, dishes, items, []);
  assertEquals(rows.map((r) => r.name), ["Curry paste", "Mince", "pasta", "rice"]);
  assertEquals(rows.find((r) => r.itemId === "mince")!.dishNames, [
    "Lasagne",
    "Curry",
  ]);
  assertEquals(rows.every((r) => r.state === "new"), true);
});

Deno.test("collectIngredients — states come from the target list", () => {
  const { rows } = collectIngredients(entries, dishes, items, [
    li("pasta", false),
    li("rice", true),
  ]);
  const state = (id: string) => rows.find((r) => r.itemId === id)!.state;
  assertEquals(state("pasta"), "on-list");
  assertEquals(state("rice"), "bought");
  assertEquals(state("mince"), "new");
});

Deno.test("collectIngredients — an unchecked list entry beats a checked duplicate", () => {
  const { rows } = collectIngredients(entries, dishes, items, [
    li("pasta", true),
    li("pasta", false),
  ]);
  assertEquals(rows.find((r) => r.itemId === "pasta")!.state, "on-list");
});

Deno.test("collectIngredients — dangling items are skipped; dishes with nothing resolvable are empty; unknown dishes vanish", () => {
  const { rows, emptyDishes } = collectIngredients(entries, dishes, items, []);
  assertEquals(rows.some((r) => r.itemId === "gone"), false);
  assertEquals(emptyDishes.map((d) => d.name), ["Pizza night", "Ghost"]);
});

Deno.test("collectIngredients — empty menu yields nothing", () => {
  assertEquals(collectIngredients([], dishes, items, []), {
    rows: [],
    emptyDishes: [],
  });
});

Deno.test("noteFor — joins dish names with a comma", () => {
  assertEquals(
    noteFor({ itemId: "x", name: "x", dishNames: ["Lasagne", "Curry"], state: "new" }),
    "Lasagne, Curry",
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A utils/menu-ingredients.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `utils/menu-ingredients.ts`:

```ts
import type {
  DishInterface,
  ItemInterface,
  MenuEntryInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

// How an ingredient relates to the target shopping list:
//   new     — not on the list; will be created
//   on-list — already on the list, unchecked; nothing to do
//   bought  — on the list but checked off; will be unchecked again
export type IngredientState = "new" | "on-list" | "bought";

export interface IngredientRow {
  itemId: string;
  name: string;
  // Names of the planned dishes that call for this item, in menu order.
  dishNames: string[];
  state: IngredientState;
}

export interface IngredientPreview {
  rows: IngredientRow[];
  // Planned dishes that contribute no resolvable ingredient at all.
  emptyDishes: DishInterface[];
}

// The single place the client-side preview rules live: dedup across dishes,
// resolve list state, drop dangling references, sort for reading.
export function collectIngredients(
  entries: MenuEntryInterface[],
  dishes: DishInterface[],
  items: ItemInterface[],
  listItems: ShoppingListItemInterface[],
): IngredientPreview {
  const dishById = new Map(dishes.map((d) => [d.id, d]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // One state per item; an unchecked entry means "still to buy" and wins over
  // a checked duplicate.
  const stateByItem = new Map<string, IngredientState>();
  for (const li of listItems) {
    if (stateByItem.get(li.itemId) === "on-list") continue;
    stateByItem.set(li.itemId, li.checked ? "bought" : "on-list");
  }

  const rowByItem = new Map<string, IngredientRow>();
  const emptyDishes: DishInterface[] = [];
  for (const entry of entries) {
    const dish = dishById.get(entry.dishId);
    if (!dish) continue; // dish deleted since it was planned
    let resolved = 0;
    for (const itemId of dish.ingredientIds) {
      const item = itemById.get(itemId);
      if (!item) continue; // catalogue item deleted
      resolved++;
      const row = rowByItem.get(itemId);
      if (row) {
        if (!row.dishNames.includes(dish.name)) row.dishNames.push(dish.name);
        continue;
      }
      rowByItem.set(itemId, {
        itemId,
        name: item.name,
        dishNames: [dish.name],
        state: stateByItem.get(itemId) ?? "new",
      });
    }
    if (resolved === 0) emptyDishes.push(dish);
  }

  const rows = [...rowByItem.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return { rows, emptyDishes };
}

// The note written on a list entry this action creates: which dishes want it.
export function noteFor(row: IngredientRow): string {
  return row.dishNames.join(", ");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A utils/menu-ingredients.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
deno fmt
git add utils/menu-ingredients.ts utils/menu-ingredients.test.ts
git commit -m "feat(menu): collect a deduped ingredient preview for the week" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `useMenuShopping` flow hook

**Files:**
- Create: `hooks/useMenuShopping.ts`
- Test: `hooks/useMenuShopping.test.ts`

**Interfaces:**
- Consumes: `api.shoppingLists.getAll/create`, `api.shoppingList.getItems/bulkAdd`, `api.weeklyMenu.setShoppingList`, `collectIngredients`/`noteFor`, `beginBusy`/`endBusy`.
- Produces:
  ```ts
  export type ShoppingStep = "idle" | "pick" | "preview";
  export interface AddOutcome { count: number; list: ShoppingListInterface }
  export function useMenuShopping(menu: Signal<WeeklyMenuInterface>, dishes: DishInterface[], items: ItemInterface[]): {
    step: Signal<ShoppingStep>; lists: Signal<ShoppingListInterface[]>; chosenList: Signal<ShoppingListInterface | null>;
    rows: Signal<IngredientRow[]>; emptyDishes: Signal<DishInterface[]>; loading: Signal<boolean>; adding: Signal<boolean>;
    rememberedListId: ReadonlySignal<string | null>; selectedCount: ReadonlySignal<number>;
    isSelected: (row: IngredientRow) => boolean;
    start(): Promise<void>; chooseList(list): Promise<void>; createList(name: string): Promise<boolean>;
    toggle(itemId: string): void; confirm(): Promise<AddOutcome | null>; cancel(): void;
  }
  ```

- [ ] **Step 1: Write the failing tests**

Create `hooks/useMenuShopping.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { signal } from "@preact/signals";
import { api } from "@/services/api.ts";
import { useMenuShopping } from "@/hooks/useMenuShopping.ts";
import type {
  DishInterface,
  ItemInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";

const items: ItemInterface[] = [
  { id: "pasta", name: "Pasta" },
  { id: "mince", name: "Mince" },
];
const dishes: DishInterface[] = [
  { id: "d1", name: "Lasagne", ingredientIds: ["pasta", "mince"], tagValueIds: [] },
];
const menuOf = (shoppingListId?: string) =>
  signal<WeeklyMenuInterface>({
    householdId: "h1",
    entries: [{ id: "e1", dishId: "d1", day: null }],
    ...(shoppingListId ? { shoppingListId } : {}),
  });
const list = (id: string): ShoppingListInterface => ({
  id,
  householdId: "h1",
  name: `List ${id}`,
  createdBy: "m1",
  createdAt: "2026-09-08T00:00:00.000Z",
});
const li = (itemId: string, checked: boolean): ShoppingListItemInterface => ({
  id: `li-${itemId}`,
  listId: "A",
  itemId,
  quantity: 1,
  checked,
});

Deno.test("start — one list goes straight to the preview and remembers it", async () => {
  const menu = menuOf();
  const getAll = stub(api.shoppingLists, "getAll", () => Promise.resolve([list("A")]));
  const getItems = stub(api.shoppingList, "getItems", () => Promise.resolve([]));
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve({ ...menu.value, shoppingListId: "A" }),
  );
  const hook = useMenuShopping(menu, dishes, items);
  try {
    await hook.start();
    assertEquals(hook.step.value, "preview");
    assertEquals(hook.chosenList.value?.id, "A");
    assertEquals(getItems.calls[0].args, ["A"]);
    assertEquals(hook.rows.value.map((r) => r.name), ["Mince", "Pasta"]);
    assertEquals(hook.selectedCount.value, 2);
    assertEquals(remember.calls.length, 1);
    await Promise.resolve();
    assertEquals(menu.value.shoppingListId, "A");
    assertEquals(hook.loading.value, false);
  } finally {
    getAll.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("start — several lists opens the picker; remembered id is exposed", async () => {
  const getAll = stub(
    api.shoppingLists,
    "getAll",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const hook = useMenuShopping(menuOf("B"), dishes, items);
  try {
    await hook.start();
    assertEquals(hook.step.value, "pick");
    assertEquals(hook.lists.value.length, 2);
    assertEquals(hook.rememberedListId.value, "B");
  } finally {
    getAll.restore();
  }
});

Deno.test("chooseList — does not re-remember the already remembered list", async () => {
  const getItems = stub(api.shoppingList, "getItems", () => Promise.resolve([]));
  const remember = stub(api.weeklyMenu, "setShoppingList", () => Promise.resolve(null));
  const hook = useMenuShopping(menuOf("A"), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(remember.calls.length, 0);
  } finally {
    getItems.restore();
    remember.restore();
  }
});

Deno.test("toggle — flips new/bought rows, ignores on-list rows", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItems",
    () => Promise.resolve([li("pasta", false)]),
  );
  const remember = stub(api.weeklyMenu, "setShoppingList", () => Promise.resolve(null));
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(hook.selectedCount.value, 1); // pasta is on-list
    hook.toggle("pasta");
    assertEquals(hook.selectedCount.value, 1);
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 0);
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 1);
  } finally {
    getItems.restore();
    remember.restore();
  }
});

Deno.test("confirm — sends only selected rows with dish-name notes and reports the count", async () => {
  const getItems = stub(api.shoppingList, "getItems", () => Promise.resolve([]));
  const remember = stub(api.weeklyMenu, "setShoppingList", () => Promise.resolve(null));
  const bulk = stub(
    api.shoppingList,
    "bulkAdd",
    () =>
      Promise.resolve({
        added: [li("mince", false)],
        restored: [],
        skipped: [],
      }),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    hook.toggle("pasta");
    const out = await hook.confirm();
    assertEquals(bulk.calls[0].args, ["A", [{ itemId: "mince", note: "Lasagne" }]]);
    assertEquals(out, { count: 1, list: list("A") });
    assertEquals(hook.step.value, "idle");
    assertEquals(hook.adding.value, false);
  } finally {
    getItems.restore();
    remember.restore();
    bulk.restore();
  }
});

Deno.test("confirm — a failed write returns null and keeps the preview open", async () => {
  const getItems = stub(api.shoppingList, "getItems", () => Promise.resolve([]));
  const remember = stub(api.weeklyMenu, "setShoppingList", () => Promise.resolve(null));
  const bulk = stub(api.shoppingList, "bulkAdd", () => Promise.resolve(null));
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(await hook.confirm(), null);
    assertEquals(hook.step.value, "preview");
  } finally {
    getItems.restore();
    remember.restore();
    bulk.restore();
  }
});

Deno.test("createList — creates, appends, and continues to the preview", async () => {
  const create = stub(api.shoppingLists, "create", () => Promise.resolve(list("N")));
  const getItems = stub(api.shoppingList, "getItems", () => Promise.resolve([]));
  const remember = stub(api.weeklyMenu, "setShoppingList", () => Promise.resolve(null));
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    assertEquals(await hook.createList("  "), false);
    assertEquals(create.calls.length, 0);
    assertEquals(await hook.createList(" Groceries "), true);
    assertEquals(create.calls[0].args, ["Groceries"]);
    assertEquals(hook.lists.value.map((l) => l.id), ["N"]);
    assertEquals(hook.step.value, "preview");
    assertEquals(hook.chosenList.value?.id, "N");
  } finally {
    create.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("cancel — returns to idle", async () => {
  const getAll = stub(api.shoppingLists, "getAll", () => Promise.resolve([list("A"), list("B")]));
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.start();
    hook.cancel();
    assertEquals(hook.step.value, "idle");
  } finally {
    getAll.restore();
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A hooks/useMenuShopping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `hooks/useMenuShopping.ts`:

```ts
import { computed, signal, type Signal } from "@preact/signals";
import type {
  DishInterface,
  ItemInterface,
  ShoppingListInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";
import {
  collectIngredients,
  type IngredientRow,
  noteFor,
} from "@/utils/menu-ingredients.ts";

export type ShoppingStep = "idle" | "pick" | "preview";

export interface AddOutcome {
  // Entries created + entries restored (unchecked again).
  count: number;
  list: ShoppingListInterface;
}

// Drives "Add to shopping list" on the weekly menu: pick a list (skipped when
// there is exactly one), review the deduped ingredients, confirm one bulk
// write. `menu` is the live signal from useWeeklyMenu so the remembered list
// stays in sync. Instantiate once per island via useMemo (see CLAUDE.md).
export function useMenuShopping(
  menu: Signal<WeeklyMenuInterface>,
  dishes: DishInterface[],
  items: ItemInterface[],
) {
  const step = signal<ShoppingStep>("idle");
  const lists = signal<ShoppingListInterface[]>([]);
  const chosenList = signal<ShoppingListInterface | null>(null);
  const rows = signal<IngredientRow[]>([]);
  const emptyDishes = signal<DishInterface[]>([]);
  // Rows start ticked; we only track the ones the user unticked.
  const unticked = signal<Set<string>>(new Set());
  const loading = signal(false); // fetching lists / list items
  const adding = signal(false); // bulk write in flight

  const rememberedListId = computed<string | null>(
    () => menu.value.shoppingListId ?? null,
  );
  const isSelected = (row: IngredientRow): boolean =>
    row.state !== "on-list" && !unticked.value.has(row.itemId);
  const selectedCount = computed(() => rows.value.filter(isSelected).length);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    loading.value = true;
    beginBusy();
    try {
      return await fn();
    } finally {
      loading.value = false;
      endBusy();
    }
  };

  const chooseList = async (list: ShoppingListInterface): Promise<void> => {
    chosenList.value = list;
    const listItems = await withLoading(() => api.shoppingList.getItems(list.id));
    const preview = collectIngredients(
      menu.value.entries,
      dishes,
      items,
      listItems,
    );
    rows.value = preview.rows;
    emptyDishes.value = preview.emptyDishes;
    unticked.value = new Set();
    step.value = "preview";
    // Remember the choice household-wide. Fire-and-forget: a failure here
    // costs nothing but next time's preselection.
    if (menu.value.shoppingListId !== list.id) {
      void api.weeklyMenu.setShoppingList(list.id).then((m) => {
        if (m) menu.value = { ...menu.value, shoppingListId: m.shoppingListId };
      });
    }
  };

  const start = async (): Promise<void> => {
    const all = await withLoading(() => api.shoppingLists.getAll());
    lists.value = all;
    if (all.length === 1) return await chooseList(all[0]);
    step.value = "pick";
  };

  const createList = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const created = await withLoading(() => api.shoppingLists.create(trimmed));
    if (!created) return false;
    lists.value = [...lists.value, created];
    await chooseList(created);
    return true;
  };

  const toggle = (itemId: string): void => {
    const row = rows.value.find((r) => r.itemId === itemId);
    if (!row || row.state === "on-list") return;
    const next = new Set(unticked.value);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    unticked.value = next;
  };

  const confirm = async (): Promise<AddOutcome | null> => {
    const list = chosenList.value;
    if (!list) return null;
    const payload = rows.value.filter(isSelected).map((r) => ({
      itemId: r.itemId,
      note: noteFor(r),
    }));
    adding.value = true;
    beginBusy();
    try {
      const result = await api.shoppingList.bulkAdd(list.id, payload);
      if (!result) return null;
      step.value = "idle";
      return { count: result.added.length + result.restored.length, list };
    } finally {
      adding.value = false;
      endBusy();
    }
  };

  const cancel = (): void => {
    step.value = "idle";
  };

  return {
    step,
    lists,
    chosenList,
    rows,
    emptyDishes,
    loading,
    adding,
    rememberedListId,
    selectedCount,
    isSelected,
    start,
    chooseList,
    createList,
    toggle,
    confirm,
    cancel,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A hooks/useMenuShopping.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
deno fmt
git add hooks/useMenuShopping.ts hooks/useMenuShopping.test.ts
git commit -m "feat(menu): useMenuShopping flow hook (pick list, preview, bulk add)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `ShoppingListPickerSheet` component

**Files:**
- Create: `components/menu/ShoppingListPickerSheet.tsx`
- Test: `components/menu/ShoppingListPickerSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Dialog`, `ListItem`, `Icon`, `Button`, `TextField` from `components/md3/`.
- Produces:
  ```ts
  export function ShoppingListPickerSheet(props: {
    open: boolean; lists: ShoppingListInterface[]; rememberedListId: string | null; busy: boolean;
    onPick: (list: ShoppingListInterface) => void; onCreate: (name: string) => Promise<boolean>; onClose: () => void;
  })
  ```
  Zero lists → the Dialog opens directly (no Sheet). Otherwise the Sheet lists the lists with a "New list" text button that opens the Dialog.

- [ ] **Step 1: Write the failing tests**

Create `components/menu/ShoppingListPickerSheet.test.tsx`:

```tsx
import {
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { ShoppingListPickerSheet } from "./ShoppingListPickerSheet.tsx";
import type { ShoppingListInterface } from "@/models/index.ts";

const list = (id: string, name: string): ShoppingListInterface => ({
  id,
  householdId: "h1",
  name,
  createdBy: "m1",
  createdAt: "2026-09-08T00:00:00.000Z",
});
const noop = () => {};
const never = () => Promise.resolve(false);

Deno.test("ShoppingListPickerSheet — lists every list and marks the remembered one", () => {
  const html = render(h(ShoppingListPickerSheet, {
    open: true,
    lists: [list("A", "Weekly shop"), list("B", "DIY store")],
    rememberedListId: "B",
    busy: false,
    onPick: noop,
    onCreate: never,
    onClose: noop,
  }));
  assertStringIncludes(html, "Which list?");
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "DIY store");
  assertStringIncludes(html, "Used last time");
  assertStringIncludes(html, "New list");
});

Deno.test("ShoppingListPickerSheet — with no lists, opens the create dialog prefilled with Groceries", () => {
  const html = render(h(ShoppingListPickerSheet, {
    open: true,
    lists: [],
    rememberedListId: null,
    busy: false,
    onPick: noop,
    onCreate: never,
    onClose: noop,
  }));
  assertStringIncludes(html, "New shopping list");
  assertStringIncludes(html, 'value="Groceries"');
  assertStringIncludes(html, "Create list");
  assertEquals(html.includes("Which list?"), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A components/menu/ShoppingListPickerSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/menu/ShoppingListPickerSheet.tsx`:

```tsx
import { useSignal } from "@preact/signals";
import type { ShoppingListInterface } from "@/models/index.ts";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { TextField } from "@/components/md3/TextField.tsx";

interface Props {
  open: boolean;
  lists: ShoppingListInterface[];
  rememberedListId: string | null;
  busy: boolean;
  onPick: (list: ShoppingListInterface) => void;
  onCreate: (name: string) => Promise<boolean>;
  onClose: () => void;
}

const DEFAULT_NAME = "Groceries";

// "Which list?" — a keyboard-less picker on a Sheet; typing a new list's name
// happens in a centered Dialog (patterns doc §9). With no lists at all the
// Dialog opens directly.
export function ShoppingListPickerSheet(
  { open, lists, rememberedListId, busy, onPick, onCreate, onClose }: Props,
) {
  const creating = useSignal(false);
  const name = useSignal(DEFAULT_NAME);
  const noLists = lists.length === 0;
  const dialogOpen = open && (noLists || creating.value);

  const closeDialog = () => {
    creating.value = false;
    if (noLists) onClose();
  };
  const submit = async () => {
    if (await onCreate(name.value)) {
      creating.value = false;
      name.value = DEFAULT_NAME;
    }
  };

  return (
    <>
      {/* Not rendered at all with no lists — a closed Sheet still puts its
          title in the DOM, and there is nothing to pick from. */}
      {!noLists && (
        <Sheet open={open} onClose={onClose} title="Which list?">
        <div class="-mx-6">
          {lists.map((l) => {
            const remembered = l.id === rememberedListId;
            return (
              <ListItem
                key={l.id}
                headline={l.name}
                supporting={remembered ? "Used last time" : undefined}
                trailing={remembered
                  ? <Icon name="check" size={20} />
                  : undefined}
                onClick={() => onPick(l)}
              />
            );
          })}
        </div>
        <div class="pt-2">
          <Button
            variant="text"
            icon="plus"
            onClick={() => (creating.value = true)}
          >
            New list
          </Button>
        </div>
        </Sheet>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        headline="New shopping list"
        actions={
          <>
            <Button variant="text" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="text"
              loading={busy}
              disabled={!name.value.trim()}
              onClick={() => void submit()}
            >
              Create list
            </Button>
          </>
        }
      >
        {noLists && (
          <p class="md-body-medium text-on-surface-variant">
            You don't have a shopping list yet. Let's make one for these
            ingredients.
          </p>
        )}
        <TextField
          label="List name"
          value={name.value}
          onInput={(v) => (name.value = v)}
        />
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A components/menu/ShoppingListPickerSheet.test.tsx`
Expected: PASS (2 tests). If the `value="Groceries"` assertion fails because `TextField` renders the value differently, open `components/md3/TextField.tsx`, find how `value` reaches the `<input>`, and adjust the assertion to the exact attribute it emits — do not change the component.

- [ ] **Step 5: Commit**

```bash
deno fmt
git add components/menu/ShoppingListPickerSheet.tsx components/menu/ShoppingListPickerSheet.test.tsx
git commit -m "feat(menu): shopping list picker sheet with inline create dialog" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `IngredientPreviewSheet` component

**Files:**
- Create: `components/menu/IngredientPreviewSheet.tsx`
- Test: `components/menu/IngredientPreviewSheet.test.tsx`

**Interfaces:**
- Consumes: `IngredientRow` from `@/utils/menu-ingredients.ts`; `Sheet`, `ListItem`, `ListSubheader`, `RoundCheck`, `Icon`, `Button`.
- Produces:
  ```ts
  export function IngredientPreviewSheet(props: {
    open: boolean; listName: string; rows: IngredientRow[]; isSelected: (row: IngredientRow) => boolean;
    emptyDishes: DishInterface[]; selectedCount: number; adding: boolean;
    onToggle: (itemId: string) => void; onConfirm: () => void; onOpenDish: (dish: DishInterface) => void; onClose: () => void;
  })
  ```

- [ ] **Step 1: Write the failing tests**

Create `components/menu/IngredientPreviewSheet.test.tsx`:

```tsx
import {
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { IngredientPreviewSheet } from "./IngredientPreviewSheet.tsx";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import type { DishInterface } from "@/models/index.ts";

const rows: IngredientRow[] = [
  { itemId: "mince", name: "Mince", dishNames: ["Lasagne", "Curry"], state: "new" },
  { itemId: "pasta", name: "Pasta", dishNames: ["Lasagne"], state: "on-list" },
  { itemId: "rice", name: "Rice", dishNames: ["Curry"], state: "bought" },
];
const emptyDishes: DishInterface[] = [
  { id: "d3", name: "Pizza night", ingredientIds: [], tagValueIds: [] },
];
const noop = () => {};
const base = {
  open: true,
  listName: "Weekly shop",
  rows,
  isSelected: (r: IngredientRow) => r.state !== "on-list",
  emptyDishes,
  adding: false,
  onToggle: noop,
  onConfirm: noop,
  onOpenDish: noop,
  onClose: noop,
};

Deno.test("IngredientPreviewSheet — rows, states, empty dishes, and the count button", () => {
  const html = render(h(IngredientPreviewSheet, { ...base, selectedCount: 2 }));
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "Mince");
  assertStringIncludes(html, "Lasagne, Curry");
  assertStringIncludes(html, "Already on the list");
  assertStringIncludes(html, "Will be put back · Curry");
  assertStringIncludes(html, "No ingredients yet");
  assertStringIncludes(html, "Pizza night");
  assertStringIncludes(html, "Add 2 items");
});

Deno.test("IngredientPreviewSheet — singular label and disabled at zero", () => {
  assertStringIncludes(
    render(h(IngredientPreviewSheet, { ...base, selectedCount: 1 })),
    "Add 1 item",
  );
  const zero = render(h(IngredientPreviewSheet, { ...base, selectedCount: 0 }));
  assertStringIncludes(zero, "Add 0 items");
  assertStringIncludes(zero, "disabled");
});

Deno.test("IngredientPreviewSheet — nothing to add message when there are no rows or empty dishes", () => {
  const html = render(h(IngredientPreviewSheet, {
    ...base,
    rows: [],
    emptyDishes: [],
    selectedCount: 0,
  }));
  assertStringIncludes(html, "Nothing to add");
  assertEquals(html.includes("No ingredients yet"), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A components/menu/IngredientPreviewSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/menu/IngredientPreviewSheet.tsx`:

```tsx
import type { DishInterface } from "@/models/index.ts";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { ListSubheader } from "@/components/md3/ListSubheader.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";

interface Props {
  open: boolean;
  listName: string;
  rows: IngredientRow[];
  isSelected: (row: IngredientRow) => boolean;
  emptyDishes: DishInterface[];
  selectedCount: number;
  adding: boolean;
  onToggle: (itemId: string) => void;
  onConfirm: () => void;
  onOpenDish: (dish: DishInterface) => void;
  onClose: () => void;
}

function supportingFor(row: IngredientRow): string {
  const dishes = row.dishNames.join(", ");
  if (row.state === "on-list") return "Already on the list";
  if (row.state === "bought") return `Will be put back · ${dishes}`;
  return dishes;
}

// Review step before the bulk write: every ingredient this week needs, flat
// and alphabetical, ticked by default. Rows already on the list are shown but
// locked so nobody wonders where their pasta went.
export function IngredientPreviewSheet(
  {
    open,
    listName,
    rows,
    isSelected,
    emptyDishes,
    selectedCount,
    adding,
    onToggle,
    onConfirm,
    onOpenDish,
    onClose,
  }: Props,
) {
  const label = selectedCount === 1 ? "Add 1 item" : `Add ${selectedCount} items`;
  const nothing = rows.length === 0 && emptyDishes.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title={listName} size="large">
      <div class="-mx-6">
        {nothing && (
          <p class="md-body-medium text-on-surface-variant px-6 py-6 text-center">
            Nothing to add — the planned dishes have no ingredients yet.
          </p>
        )}
        {rows.map((row) => {
          const locked = row.state === "on-list";
          return (
            <ListItem
              key={row.itemId}
              class={locked ? "opacity-50" : undefined}
              leading={<RoundCheck checked={locked || isSelected(row)} />}
              headline={row.name}
              supporting={supportingFor(row)}
              onClick={locked ? undefined : () => onToggle(row.itemId)}
            />
          );
        })}
        {emptyDishes.length > 0 && (
          <>
            <ListSubheader>No ingredients yet</ListSubheader>
            {emptyDishes.map((d) => (
              <ListItem
                key={d.id}
                headline={d.name}
                supporting="Add ingredients to this dish"
                trailing={<Icon name="chevron" size={20} />}
                onClick={() => onOpenDish(d)}
              />
            ))}
          </>
        )}
      </div>
      {/* Sticky so the confirm stays reachable on a long week. */}
      <div class="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-surface-clow">
        <Button
          full
          icon="cart"
          loading={adding}
          disabled={selectedCount === 0}
          onClick={onConfirm}
        >
          {label}
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `deno test --unstable-kv -A components/menu/IngredientPreviewSheet.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
deno fmt
git add components/menu/IngredientPreviewSheet.tsx components/menu/IngredientPreviewSheet.test.tsx
git commit -m "feat(menu): ingredient preview sheet" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Wire `WeeklyMenu` island and the `/menu` route

**Files:**
- Modify: `routes/menu/index.tsx`
- Modify: `islands/menu/WeeklyMenu.tsx`
- Test: `islands/menu/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `useMenuShopping`, `ShoppingListPickerSheet`, `IngredientPreviewSheet`, `ItemRepo.readAll`.
- Produces: `WeeklyMenu` prop `initialItems: ItemInterface[]` (required).

- [ ] **Step 1: Write the failing tests**

In `islands/menu/WeeklyMenu.test.tsx`, add `initialItems: []` to both existing `render(...)` prop objects, extend the imports with `assertEquals`, and append:

```tsx
Deno.test("WeeklyMenu — offers 'Add to shopping list' when the week has dishes", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: {
      householdId: "h1",
      entries: [{ id: "e1", dishId: "d1", day: null }],
    },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
    initialItems: [],
  }));
  assertStringIncludes(html, "Add to shopping list");
});

Deno.test("WeeklyMenu — no shopping action on an empty week", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: { householdId: "h1", entries: [] },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
    initialItems: [],
  }));
  assertEquals(html.includes("Add to shopping list"), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A islands/menu/WeeklyMenu.test.tsx`
Expected: FAIL — type error on `initialItems` / missing button text.

- [ ] **Step 3: Load catalogue items in the route**

In `routes/menu/index.tsx`, add `ItemRepo` to the database import and load items:

```tsx
    const [menu, dishes, tagGroups, items] = await Promise.all([
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(householdId),
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
    ]);
    return page({ menu, dishes, tagGroups, items });
```

and pass `initialItems={data.items}` to `<WeeklyMenu>`.

- [ ] **Step 4: Wire the island**

In `islands/menu/WeeklyMenu.tsx`:

Imports — add:

```tsx
import type { ItemInterface } from "@/models/index.ts";
import { useMenuShopping } from "@/hooks/useMenuShopping.ts";
import { ShoppingListPickerSheet } from "@/components/menu/ShoppingListPickerSheet.tsx";
import { IngredientPreviewSheet } from "@/components/menu/IngredientPreviewSheet.tsx";
```

Props — add `initialItems: ItemInterface[];` and destructure it.

After the `useWeeklyMenu` `useMemo`, instantiate the flow once:

```tsx
  const shopping = useMemo(
    () => useMenuShopping(menu, initialDishes, initialItems),
    [],
  );
```

After `onClear`, add the confirm handler (uses the existing `showSnack`):

```tsx
  // Pessimistic bulk write; the preview stays open on failure so nothing is
  // lost (patterns doc §1/§3).
  const onConfirmShopping = () => {
    void shopping.confirm().then((out) => {
      if (!out) return showSnack("Couldn't add to the list — try again");
      if (out.count === 0) {
        return showSnack("Everything was already on the list");
      }
      showSnack(
        `Added ${out.count} to ${out.list.name}`,
        "Open list",
        () => navigateTo(`/shopping/${out.list.id}`),
      );
    });
  };
```

In the JSX, directly under the header `div` (the `flex items-center justify-between px-4 pt-4` block) and before the empty/entries ternary, add:

```tsx
        {entries.length > 0 && (
          <div class="px-4 pt-3">
            <Button
              full
              icon="cart"
              loading={shopping.loading.value && shopping.step.value === "idle"}
              onClick={() => void shopping.start()}
            >
              Add to shopping list
            </Button>
          </div>
        )}
```

Before the closing `</PullToRefresh>` (next to the day-picker `Sheet`), add both sheets:

```tsx
      <ShoppingListPickerSheet
        open={shopping.step.value === "pick"}
        lists={shopping.lists.value}
        rememberedListId={shopping.rememberedListId.value}
        busy={shopping.loading.value}
        onPick={(l) => void shopping.chooseList(l)}
        onCreate={shopping.createList}
        onClose={shopping.cancel}
      />
      <IngredientPreviewSheet
        open={shopping.step.value === "preview"}
        listName={shopping.chosenList.value?.name ?? ""}
        rows={shopping.rows.value}
        isSelected={shopping.isSelected}
        emptyDishes={shopping.emptyDishes.value}
        selectedCount={shopping.selectedCount.value}
        adding={shopping.adding.value}
        onToggle={shopping.toggle}
        onConfirm={onConfirmShopping}
        onOpenDish={(d) => navigateTo(`/menu/${d.id}`)}
        onClose={shopping.cancel}
      />
```

- [ ] **Step 5: Run to verify pass**

Run: `deno test --unstable-kv -A islands/menu/WeeklyMenu.test.tsx && deno check`
Expected: PASS (4 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
deno fmt
git add routes/menu/index.tsx islands/menu/WeeklyMenu.tsx islands/menu/WeeklyMenu.test.tsx
git commit -m "feat(menu): add this week's ingredients to a shopping list" -m "Wires the picker + preview sheets and the bulk write into the This week screen. Closes #100." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Patterns doc, full gates, live verification, PR

**Files:**
- Modify: `docs/ui-ux-patterns.md`

- [ ] **Step 1: Document the pattern**

In `docs/ui-ux-patterns.md`, insert before `## Review checklist for user-facing changes`:

```md
## 19. Bulk writes go through a review sheet and one server-side endpoint

**Rule:** When one tap would write many records (e.g. "Add to shopping list"
on the weekly menu), show a review `Sheet` first — every row ticked by
default, rows that would be no-ops shown but locked — and send the confirmed
set as **one** request whose handler applies the dedup/merge rules and commits
atomically. Never loop single-record POSTs from the client.

**Why:** A blind bulk add is noisy (pantry staples) and hard to undo; per-row
requests leave half-written state on flaky mobile connections and race when two
members tap at once. The preview *is* the undo, and the server is the only
place the "already there" decision can be made safely.

**How:** Pure row-builder (`collectIngredients`) → flow hook holds
`step`/selection signals → presentational sheet renders rows with `RoundCheck`
+ `ListItem` and a `Button loading` confirm labelled with the count → `api`
call to a `/bulk` route → repo method builds one `kv.atomic()`.

**See:** `utils/menu-ingredients.ts`, `hooks/useMenuShopping.ts`,
`components/menu/IngredientPreviewSheet.tsx`,
`routes/api/shopping/lists/[id]/items/bulk.ts`,
`database/shopping-list-item.repo.ts` (`bulkAdd`).

---
```

- [ ] **Step 2: Run the full gates**

Run: `deno task check && deno task test`
Expected: fmt/lint/check clean; all tests pass. Fix anything that fails before continuing.

- [ ] **Step 3: Live verification (browser)**

Follow the `browser-e2e-setup` recipe: `.env` with `KV_PATH=data/kv.db`, `deno task db:seed`, then `preview_start` with the `dev-wt` launch config (port 5178). Log in (curl the cookie, set via `document.cookie`). Then:

1. Open `/menu/dishes`, open two dishes and give them overlapping ingredients (or rely on seed data if it has ingredients — check `scripts/seed.ts`). Add both to the week.
2. On `/menu`: confirm the "Add to shopping list" button appears under the header and not on an empty week.
3. With one list in the household: tapping goes straight to the preview; rows are alphabetical, shared ingredient shows both dish names; confirm label counts ticked rows; untick one row → count drops.
4. Confirm → snackbar "Added N to <list>", "Open list" navigates to `/shopping/<id>` and the entries are there, unchecked, quantity 1, note = dish names.
5. Repeat the action: rows now show "Already on the list", locked; confirm disabled at zero.
6. In the list, check one added item off, go back, repeat: that row shows "Will be put back", confirming unchecks it.
7. Create a second list at `/shopping`; the action now shows the picker with the first list marked "Used last time". Pick the second one; reload `/menu`, repeat: the second list is now the remembered one.
8. A dish with no ingredients appears under "No ingredients yet" and tapping it opens `/menu/<dishId>`.
9. Use the `computer` tool for real clicks (see memory `synthetic-clicks-give-false-passes`); take a screenshot of the preview sheet for the PR.

- [ ] **Step 4: Commit and open the PR**

```bash
deno fmt
git add docs/ui-ux-patterns.md
git commit -m "docs: pattern 19 — bulk writes via review sheet + single endpoint" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feature/shopping-list-meal-plan-8f461f
gh pr create --base main --title "feat(menu): add this week's ingredients to a shopping list" --body "$(cat <<'EOF'
Closes #100. Part of #14.

Once the weekly menu is assembled, "Add to shopping list" on *This week* reviews the deduped ingredients of the planned dishes and puts them on one shopping list in a single atomic write.

- Picker skipped when there is one list; last-used list remembered household-wide; inline create when there is none
- Preview sheet: flat alphabetical rows with dish names, already-listed rows locked, checked-off rows restored, dishes without ingredients linked to their editor
- `POST /api/shopping/lists/:id/items/bulk` applies dedup / restore / note rules server-side in one KV atomic commit; quantity is never bumped, written notes are never overwritten
- `PATCH /api/menu/plan { shoppingListId }` remembers the list
- Glossary: Catalogue, Item, Shopping list, Dish, Ingredient, Weekly menu added to CONTEXT.md; patterns doc §19

Spec: docs/superpowers/specs/2026-09-08-menu-to-shopping-list-design.md
Follow-ups: #101 per-dish add, #102 shopping-side entry, #103 pantry staples.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Update memory**

Update `menu-to-shopping-list-status.md` in the memory directory: PR number, "implemented + verified", anything learned during live verification.
