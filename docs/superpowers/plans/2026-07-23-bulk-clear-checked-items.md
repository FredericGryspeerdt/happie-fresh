# Bulk-clear Checked Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear all checked-off items in a shopping list with a single API call, and wire the existing "Clear checked items" UI action to use it (replacing the current one-request-per-item loop).

**Architecture:** A new `ShoppingListItemRepo.clearChecked(listId)` deletes only checked items in one Deno KV atomic transaction. A dedicated `DELETE /api/shopping/lists/:id/items/checked` route calls it. A shared `authorizeList` helper (extracted from the existing items route) guards both routes. Client-side, `api.shoppingList.clearChecked` and a `clearCheckedItems()` hook action perform an optimistic clear with rollback on failure.

**Tech Stack:** Deno 2.7 + Fresh 2 (`define.handlers`) + Preact + `@preact/signals` + Deno KV. Tests use `jsr:@std/assert` and `jsr:@std/testing/mock` (`stub`).

## Global Constraints

- **Imports:** use the `@/` alias for project root (e.g. `@/database/index.ts`). Route/DB imports use `.ts` extensions.
- **JSX/Styling:** Preact JSX with `class` (never `className`). Not relevant to most tasks here but applies to the island edit.
- **Fresh handlers:** API routes export `export const handler = define.handlers({ ... })`; handler methods take a single `ctx` (request via `ctx.req`, params via `ctx.params`). API routes return JSON `Response` objects.
- **KV access:** never call `Deno.openKv()` in routes — go through repository classes and the `getKv()` singleton in `database/db.ts`.
- **Signals in islands:** local island state uses `useSignal()`, never `signal()`. (The `useShoppingList` hook deliberately uses module-`signal()` semantics via `useMemo([])` — do not change that.)
- **Commits:** Conventional Commits (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`). End commit messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- **Clearing = deletion:** "clear checked" permanently deletes the checked items (existing behaviour), it does not un-check them.

---

## File Structure

- `deno.json` — add a `test` task (KV tests need `--unstable-kv -A`).
- `CLAUDE.md` — update the test-command note.
- `database/shopping-list-item.repo.ts` — add `clearChecked(listId)` (core logic).
- `database/shopping-list-item.repo.test.ts` *(new)* — repo test on in-memory KV.
- `utils/authorize-list.ts` *(new)* — shared list-ownership auth helper (server-only; imported directly, NOT via the `utils/index.ts` barrel, so it never leaks into client bundles).
- `routes/api/shopping/lists/[id]/items.ts` — remove the local `authorizeList`, import the shared one.
- `routes/api/shopping/lists/[id]/items/checked.ts` *(new)* — `DELETE` route for bulk-clear.
- `services/api.ts` — add `shoppingList.clearChecked`.
- `hooks/useShoppingList.ts` — add and export `clearCheckedItems`.
- `hooks/useShoppingList.test.ts` — add success + rollback tests.
- `islands/items.tsx` — wire the "Clear checked items" button to `clearCheckedItems`.

**Note on routing:** `routes/api/shopping/lists/[id]/items.ts` (file) and `routes/api/shopping/lists/[id]/items/checked.ts` (dir) coexist — the codebase already does this with `routes/api/shopping/lists.ts` + `routes/api/shopping/lists/[id]/`.

---

## Task 1: Repo `clearChecked` + test tooling

**Files:**
- Modify: `deno.json` (tasks block)
- Modify: `CLAUDE.md` (build commands note)
- Modify: `database/shopping-list-item.repo.ts`
- Test: `database/shopping-list-item.repo.test.ts` (create)

**Interfaces:**
- Consumes: `getKv()` from `database/db.ts`; `ShoppingListItemInterface` from `@/models/index.ts`; existing `ShoppingListItemRepo.add`, `.update`, `.getAll`.
- Produces: `ShoppingListItemRepo.clearChecked(listId: string): Promise<number>` — deletes only items whose `checked === true`, returns how many were deleted (0 if none).

- [ ] **Step 1: Add the `test` task to `deno.json`**

In the `"tasks"` block, add the `test` line immediately after `check`:

```jsonc
  "tasks": {
    "check": "deno fmt --check && deno lint && deno check",
    "test": "deno test --unstable-kv -A",
    "dev": "deno run --env-file --unstable-kv -A vite",
```

(Deliberately no `--env-file` for `test`, so `.env` cannot point KV at the real dev database — the test sets an in-memory path itself.)

- [ ] **Step 2: Write the failing repo test**

Create `database/shopping-list-item.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use (inside a repo method), and no repo method is called until a test
// body runs — so setting it here at module load is early enough. Each test uses
// a distinct listId because the process-wide KV singleton is shared.
Deno.env.set("KV_PATH", ":memory:");

Deno.test("clearChecked — removes only checked items and returns their count", async () => {
  const listId = "list-clear-1";
  const a = await ShoppingListItemRepo.add(listId, "item-a");
  const b = await ShoppingListItemRepo.add(listId, "item-b");
  const c = await ShoppingListItemRepo.add(listId, "item-c");
  await ShoppingListItemRepo.update(listId, a.id, { checked: true });
  await ShoppingListItemRepo.update(listId, c.id, { checked: true });

  const cleared = await ShoppingListItemRepo.clearChecked(listId);

  assertEquals(cleared, 2);
  const remaining = await ShoppingListItemRepo.getAll(listId);
  assertEquals(remaining.map((i) => i.id), [b.id]);
});

Deno.test("clearChecked — returns 0 and deletes nothing when no item is checked", async () => {
  const listId = "list-clear-2";
  await ShoppingListItemRepo.add(listId, "item-a");
  await ShoppingListItemRepo.add(listId, "item-b");

  const cleared = await ShoppingListItemRepo.clearChecked(listId);

  assertEquals(cleared, 0);
  const remaining = await ShoppingListItemRepo.getAll(listId);
  assertEquals(remaining.length, 2);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `deno test --unstable-kv -A database/shopping-list-item.repo.test.ts`
Expected: FAIL — `ShoppingListItemRepo.clearChecked is not a function` (TypeError).

- [ ] **Step 4: Implement `clearChecked`**

In `database/shopping-list-item.repo.ts`, add this method to the `ShoppingListItemRepo` class (place it after `deleteAll`):

```ts
  static async clearChecked(listId: string): Promise<number> {
    const kv = await getKv();
    let atomic = kv.atomic();
    let count = 0;
    for await (
      const entry of kv.list<ShoppingListItemInterface>({
        prefix: ["shopping_list_items", listId],
      })
    ) {
      if (entry.value.checked) {
        atomic = atomic.delete(entry.key);
        count++;
      }
    }
    if (count === 0) return 0;
    const { ok } = await atomic.commit();
    if (!ok) throw new Error("Failed to clear checked items.");
    return count;
  }
```

(`getKv` and `ShoppingListItemInterface` are already imported at the top of the file. `const { ok } = await atomic.commit()` destructures the commit result correctly — the raw result object is always truthy, so check `.ok`, not the object.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test --unstable-kv -A database/shopping-list-item.repo.test.ts`
Expected: PASS — 2 tests ok.

- [ ] **Step 6: Update the test-command note in `CLAUDE.md`**

In the "Build & Development Commands" list, replace:

```md
- `deno test` — Run tests
```

with:

```md
- `deno task test` — Run tests (uses `--unstable-kv -A`; required for KV-backed repo tests)
```

- [ ] **Step 7: Verify the full suite + checks are green**

Run: `deno task test`
Expected: PASS — all existing tests plus the 2 new repo tests.

Run: `deno task check`
Expected: no fmt/lint/type errors.

- [ ] **Step 8: Commit**

```bash
git add deno.json CLAUDE.md database/shopping-list-item.repo.ts database/shopping-list-item.repo.test.ts
git commit -m "$(cat <<'EOF'
feat(shopping): add ShoppingListItemRepo.clearChecked bulk delete

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared auth helper + bulk-clear endpoint

**Files:**
- Create: `utils/authorize-list.ts`
- Modify: `routes/api/shopping/lists/[id]/items.ts` (top imports + remove local `authorizeList`)
- Create: `routes/api/shopping/lists/[id]/items/checked.ts`

**Interfaces:**
- Consumes: `ShoppingListRepo.getById(householdId, listId)` from `@/database/index.ts`; `StateInterface` from `@/utils/define.ts`; `Context` from `fresh`; `ShoppingListItemRepo.clearChecked` (Task 1); `define` from `@/utils/index.ts`.
- Produces: `authorizeList(ctx: Context<StateInterface>, listId: string): Promise<ShoppingListInterface | null>`; route `DELETE /api/shopping/lists/:id/items/checked` → `200 { cleared: number }` or `403`.

> No automated route test is added: the repo has no route-test harness and the handler is thin glue (authorize → repo → JSON). Its correctness is covered by the repo test (Task 1), the hook test (Task 3), `deno task check`, and the manual end-to-end check (Task 4).

- [ ] **Step 1: Create the shared auth helper**

Create `utils/authorize-list.ts`:

```ts
import { type Context } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";
import { type StateInterface } from "@/utils/define.ts";

/**
 * Resolve a shopping list and authorize it for the current household.
 * Returns the list when it belongs to the caller's household, otherwise null.
 */
export async function authorizeList(
  ctx: Context<StateInterface>,
  listId: string,
) {
  const householdId = ctx.state.householdId;
  if (!householdId) return null;
  const list = await ShoppingListRepo.getById(householdId, listId);
  if (!list) return null;
  return list;
}
```

- [ ] **Step 2: Refactor `items.ts` to use the shared helper**

In `routes/api/shopping/lists/[id]/items.ts`, replace the top of the file — the imports (lines 1-3) and the local `authorizeList` function (lines 5-14) — with:

```ts
import { ShoppingListItemRepo } from "@/database/index.ts";
import { define } from "@/utils/index.ts";
import { authorizeList } from "@/utils/authorize-list.ts";
```

Leave the entire `export const handler = define.handlers({ ... })` block unchanged. (This removes the now-unused `Context`, `StateInterface`, and `ShoppingListRepo` imports — `ShoppingListRepo` was only used by the local `authorizeList`.)

- [ ] **Step 3: Create the bulk-clear route**

Create `routes/api/shopping/lists/[id]/items/checked.ts`:

```ts
import { ShoppingListItemRepo } from "@/database/index.ts";
import { define } from "@/utils/index.ts";
import { authorizeList } from "@/utils/authorize-list.ts";

export const handler = define.handlers({
  async DELETE(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const cleared = await ShoppingListItemRepo.clearChecked(list.id);
    return new Response(JSON.stringify({ cleared }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
```

- [ ] **Step 4: Verify checks pass**

Run: `deno task check`
Expected: no fmt/lint/type errors (in particular, no "unused import" errors in `items.ts`).

- [ ] **Step 5: Commit**

```bash
git add utils/authorize-list.ts "routes/api/shopping/lists/[id]/items.ts" "routes/api/shopping/lists/[id]/items/checked.ts"
git commit -m "$(cat <<'EOF'
feat(shopping): add DELETE .../items/checked bulk-clear endpoint

Extract authorizeList into a shared helper reused by both the items
route and the new checked-items route.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Client service + hook action (with tests)

**Files:**
- Modify: `services/api.ts` (`shoppingList` object)
- Modify: `hooks/useShoppingList.ts`
- Test: `hooks/useShoppingList.test.ts`

**Interfaces:**
- Consumes: `api.shoppingList.clearChecked` (added here); `patchScheduler.cancel`, `checkedItems`, `pendingCount`, `listId` (existing in the hook).
- Produces: `api.shoppingList.clearChecked(listId: string): Promise<number | null>` (`null` = request failed); `useShoppingList(...).clearCheckedItems(): Promise<void>` — optimistically empties `checkedItems`, rolls back on failure.

- [ ] **Step 1: Add the service method**

In `services/api.ts`, inside the `shoppingList` object, add `clearChecked` immediately after `removeItem`:

```ts
    clearChecked: async (listId: string): Promise<number | null> => {
      const res = await fetch(`/api/shopping/lists/${listId}/items/checked`, {
        method: "DELETE",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.cleared as number;
    },
```

- [ ] **Step 2: Write the failing hook tests**

Append to `hooks/useShoppingList.test.ts` (the `stub`, `api`, `useShoppingList`, `assertEquals`, `makeItem`, `makeListItem`, and `TEST_LIST_ID` helpers already exist at the top of the file):

```ts
// ── clearCheckedItems ──────────────────────────────────────────────────────────

Deno.test("clearCheckedItems — empties checkedItems with a single api call", async () => {
  using clear = stub(
    api.shoppingList,
    "clearChecked",
    () => Promise.resolve(2),
  );

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", true),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.checkedItems.value.length, 2);
  await hook.clearCheckedItems();

  assertEquals(hook.checkedItems.value.length, 0);
  assertEquals(clear.calls.length, 1);
});

Deno.test("clearCheckedItems — rolls back checkedItems when the request fails", async () => {
  using _clear = stub(
    api.shoppingList,
    "clearChecked",
    () => Promise.resolve(null),
  );

  const hook = useShoppingList(
    TEST_LIST_ID,
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.clearCheckedItems();

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-1");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `deno test --unstable-kv -A hooks/useShoppingList.test.ts`
Expected: FAIL — `hook.clearCheckedItems is not a function`.

- [ ] **Step 4: Implement `clearCheckedItems` in the hook**

In `hooks/useShoppingList.ts`, add this function immediately after `uncheckItem` (before `refresh`):

```ts
  const clearCheckedItems = async () => {
    const snapshot = checkedItems.value;
    if (snapshot.length === 0) return;
    // Cancel any in-flight debounced writes for items being cleared, so a
    // late flush can't resurrect a deleted item.
    for (const li of snapshot) {
      if (li.id) patchScheduler.cancel(li.id);
    }
    checkedItems.value = [];
    pendingCount.value++;
    try {
      const cleared = await api.shoppingList.clearChecked(listId);
      if (cleared === null) checkedItems.value = snapshot; // rollback on failure
    } finally {
      pendingCount.value--;
    }
  };
```

Then add `clearCheckedItems,` to the object returned at the end of the hook (next to `flushListItem,`):

```ts
    lastSaved,
    flushListItem,
    clearCheckedItems,
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno test --unstable-kv -A hooks/useShoppingList.test.ts`
Expected: PASS — both new tests ok.

- [ ] **Step 6: Verify full checks**

Run: `deno task check`
Expected: no fmt/lint/type errors.

- [ ] **Step 7: Commit**

```bash
git add services/api.ts hooks/useShoppingList.ts hooks/useShoppingList.test.ts
git commit -m "$(cat <<'EOF'
feat(shopping): add clearCheckedItems client action with rollback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire the UI + end-to-end verification

**Files:**
- Modify: `islands/items.tsx` (hook destructure ~line 60; "Clear checked items" `onClick` ~lines 500-508)

**Interfaces:**
- Consumes: `clearCheckedItems` from `useShoppingList` (Task 3).
- Produces: the "Clear checked items" button issues a single `DELETE .../items/checked` instead of N per-item DELETEs.

- [ ] **Step 1: Destructure `clearCheckedItems` from the hook**

In `islands/items.tsx`, in the `useMemo(() => useShoppingList(...))` destructure, add `clearCheckedItems` after `flushListItem`:

```tsx
    lastSaved,
    flushListItem,
    clearCheckedItems,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );
```

- [ ] **Step 2: Replace the per-item clear loop with the bulk action**

Find the "Clear checked" `ListItem`'s `onClick` (currently):

```tsx
            onClick={async () => {
              const ids = checkedItems.value.map((li) => li.id!).filter(
                Boolean,
              );
              mgmtOpen.value = false;
              for (const id of ids) {
                await removeListItem(id);
              }
            }}
```

Replace it with:

```tsx
            onClick={async () => {
              mgmtOpen.value = false;
              await clearCheckedItems();
            }}
```

(Keep `removeListItem` in the destructure — it is still used elsewhere in the file, e.g. the item-editor delete.)

- [ ] **Step 3: Verify checks pass**

Run: `deno task check`
Expected: no fmt/lint/type errors (no "unused var" for `removeListItem` — still used; `checkedItems` still used elsewhere).

Run: `deno task test`
Expected: PASS — whole suite green.

- [ ] **Step 4: Manual end-to-end verification (browser preview)**

Use the browser preview tooling (not manual hand-off):

1. Start the dev server: `preview_start` with the dev launch config (Vite dev server). If `.claude/launch.json` has no entry, add one running `deno task dev` on its port.
2. Log in (seed a demo user first if needed: `deno task db:seed`), open a shopping list, and add a few items.
3. Check off 2-3 items (they move to the "In cart" section).
4. Open the list management sheet and tap **Clear checked items**.
5. In `read_network_requests`, confirm exactly **one** `DELETE` request to `/api/shopping/lists/<id>/items/checked` (not one per item), returning `200` with `{ "cleared": <n> }`.
6. Confirm via `read_page` / screenshot that the checked section is now empty and no console errors appear (`read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add islands/items.tsx
git commit -m "$(cat <<'EOF'
feat(shopping): clear checked items in one request from the UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (completed while writing)

- **Spec coverage:** repo method (Task 1), dedicated endpoint + shared auth (Task 2), client service + hook with rollback (Task 3), UI wiring + e2e (Task 4), repo + hook tests + tooling (Tasks 1 & 3). All spec sections mapped.
- **Placeholders:** none — every code step shows complete code and exact commands.
- **Type consistency:** `clearChecked` returns `Promise<number>` (repo) / `Promise<number | null>` (service, `null` = failure); `clearCheckedItems(): Promise<void>`; endpoint returns `{ cleared: number }`. Names consistent across tasks.
- **Known deviation from spec snippet:** the repo uses `const { ok } = await atomic.commit()` (correct `.ok` check) rather than the spec's `const ok = ...`; this is a correctness refinement, noted in Task 1 Step 4.
