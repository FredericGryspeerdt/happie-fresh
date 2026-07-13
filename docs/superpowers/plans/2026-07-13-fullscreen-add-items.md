# Full-Screen "Add Items" Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shopping-list "search → add → create-with-category" loop a
roomy full-screen route (`/shopping/[id]/add`) while keeping the bottom sheet for
quick adds, so the sheet stops being cramped.

**Architecture:** A new Fresh route SSR-renders a new `AddItems` island that
reuses `useShoppingList` (optimistic, per-tap commits), `useSearchBox`, and the
shared `CategoryPickerList`. Catalogue rows are extracted into a shared
`CatalogueAddRow` used by both the page and the slimmed sheet. The sheet hands
off to the page via full navigation (`globalThis.location.href`), carrying the
current query as `?q=`. Returning to the list re-renders it from the server, so
no shared client state and no new API is needed.

**Tech Stack:** Deno, Fresh 2 (`jsr:@fresh/core`), Preact 10, `@preact/signals`,
Tailwind v4, Deno KV (untouched here).

## Global Constraints

Every task implicitly includes these. Copy exact values verbatim.

- **No data-model or API changes.** Reuse existing repos (`@/database/index.ts`),
  the `api` client (`@/services/api.ts`), and hooks. No new endpoints, no schema
  edits.
- **Preact JSX:** use `class`, never `className` (project uses `jsx: precompile`).
- **Imports:** use the `@/` alias for project root (e.g. `@/components/md3/…`).
- **Signals in islands:** local state via `useSignal()`; instantiate a
  `signal()`-based hook once with `useMemo(() => useHook(...), [])`; never call
  `signal()` inside a component body.
- **Category selection:** choose an existing category or Uncategorized only.
  **No inline category creation in v1.**
- **Idle add page shows category filter chips — never the full catalogue item
  list.**
- **Adds are optimistic, committed per tap.** Back returns to the list; there is
  no save/confirm step.
- **MD3:** use existing `components/md3/*` and design tokens.
- **Query param:** Fresh 2 reads it as `ctx.url.searchParams.get("q") ?? ""`.
- **Commits:** Conventional Commits; end every commit message with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Gates (must be green before each commit):** `deno task check`
  (`deno fmt --check && deno lint && deno check`), `deno test`, `deno task build`.
- **Branch:** `feat/fullscreen-add-items` (already cut from `develop`, which
  includes merged PR #23).

---

## File Structure

- **Create** `components/md3/CatalogueAddRow.tsx` — presentational catalogue row
  (name + category + add/Added). Shared by the sheet and the page.
- **Create** `components/md3/CatalogueAddRow.test.tsx` — render test.
- **Modify** `components/md3/Icon.tsx` — add an `expand` icon.
- **Modify** `hooks/useSearchBox.ts` — accept an optional `initialQuery` so the
  page can seed its search from `?q=` (also makes SSR render tests deterministic).
- **Create** `islands/add-items.tsx` — the full-screen add island.
- **Create** `islands/add-items.test.tsx` — SSR render tests.
- **Create** `routes/shopping/[id]/add.tsx` — the route (SSR handler + page).
- **Modify** `islands/items.tsx` — slim the add sheet; hand off to the page.
- **Modify** `islands/items.test.tsx` — adjust for the slimmed sheet.

Reused unchanged: `components/md3/CategoryPickerList.tsx`, `hooks/useShoppingList.ts`,
`services/api.ts`, `database/index.ts`, `utils/index.ts`.

---

## Task 1: Shared building blocks (`CatalogueAddRow`, `expand` icon, `useSearchBox` seed)

**Files:**
- Create: `components/md3/CatalogueAddRow.tsx`
- Create: `components/md3/CatalogueAddRow.test.tsx`
- Modify: `components/md3/Icon.tsx` (add `expand` to the union + paths)
- Modify: `hooks/useSearchBox.ts` (add `initialQuery` param)

**Interfaces:**
- Consumes: `components/md3/Icon.tsx` (`Icon`, `IconName`), `components/md3/ListItem.tsx` (`ListItem`).
- Produces:
  - `CatalogueAddRow(props: { name: string; categoryLabel?: string; added: boolean; onAdd: () => void })`
  - `IconName` gains `"expand"`.
  - `useSearchBox<T>(initialItems: T[], filterFn, initialQuery = "")` — same
    return shape as before (`{ items, query, inputRef, results, hasSearchQuery, reset }`).

- [ ] **Step 1: Write the failing test for `CatalogueAddRow`**

Create `components/md3/CatalogueAddRow.test.tsx`:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { CatalogueAddRow } from "./CatalogueAddRow.tsx";

Deno.test("CatalogueAddRow — name, category, and Add affordance", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Butter",
    categoryLabel: "Dairy",
    added: false,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Butter");
  assertStringIncludes(html, "Dairy");
  assert(!html.includes("Added"));
});

Deno.test("CatalogueAddRow — Added state", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Bread",
    added: true,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Bread");
  assertStringIncludes(html, "Added");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `deno test components/md3/CatalogueAddRow.test.tsx`
Expected: FAIL — module `./CatalogueAddRow.tsx` not found.

- [ ] **Step 3: Create `CatalogueAddRow.tsx`**

```tsx
// components/md3/CatalogueAddRow.tsx
import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";

interface CatalogueAddRowProps {
  name: string;
  categoryLabel?: string;
  added: boolean;
  onAdd: () => void;
}

/**
 * A catalogue item row in the add flows: name + category, with an add / Added
 * state. Shared by the quick-add sheet (islands/items.tsx) and the full-screen
 * add page (islands/add-items.tsx). Tapping an un-added row calls onAdd
 * (optimistic); an added row is inert.
 */
export function CatalogueAddRow(
  { name, categoryLabel, added, onAdd }: CatalogueAddRowProps,
) {
  return (
    <ListItem
      headline={name}
      supporting={categoryLabel ?? ""}
      onClick={added ? undefined : onAdd}
      trailing={added
        ? (
          <span class="inline-flex items-center gap-1 text-primary md-label-medium">
            <Icon name="check" size={18} /> Added
          </span>
        )
        : (
          <span class="text-primary">
            <Icon name="plus" size={22} />
          </span>
        )}
    />
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `deno test components/md3/CatalogueAddRow.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the `expand` icon to `components/md3/Icon.tsx`**

Add `| "expand"` to the `IconName` union (after `"tag"`):

```tsx
  | "tag"
  | "expand";
```

Add this entry to the `paths` record (after the `tag:` entry):

```tsx
    expand: (
      <>
        <path
          d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
          {...p}
        />
      </>
    ),
```

- [ ] **Step 6: Add `initialQuery` to `hooks/useSearchBox.ts`**

Change the signature and the `query` signal only:

```tsx
export function useSearchBox<T>(
  initialItems: T[],
  filterFn: (query: string, item: T) => boolean,
  initialQuery = "",
) {
  const items = useSignal<T[]>(initialItems || []);
  const query = useSignal(initialQuery);
```

Leave the rest of the file unchanged. (Existing callers pass no third argument,
so they default to `""` — behaviour is unchanged for them.)

- [ ] **Step 7: Run the full gates**

Run: `deno task check && deno test && deno task build`
Expected: check clean; all tests pass (74 existing + 2 new = 76); build ✓.

- [ ] **Step 8: Commit**

```bash
git add components/md3/CatalogueAddRow.tsx components/md3/CatalogueAddRow.test.tsx components/md3/Icon.tsx hooks/useSearchBox.ts
git commit -m "$(cat <<'EOF'
feat(md3): shared CatalogueAddRow, expand icon, seedable useSearchBox

Building blocks for the full-screen add-items flow. No behaviour change to
existing callers (useSearchBox initialQuery defaults to "").

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `AddItems` island

**Files:**
- Create: `islands/add-items.tsx`
- Create: `islands/add-items.test.tsx`

**Interfaces:**
- Consumes: `useShoppingList` and `useSearchBox` from `@/hooks/index.ts`;
  `CategoryPickerList`, `CatalogueAddRow`, `Chip`, `Icon`, `Button`, `Pressable`
  from `@/components/md3/*`; models from `@/models/index.ts`.
  - `useShoppingList(listId, catalog, shoppingList, categories)` returns
    (used here): `addToList(itemId) => Promise<string|null>`,
    `addToCatalog(name, categoryId?) => Promise<string|null>` (creates the
    catalogue item **and** adds it to the list),
    `listItemsMap` (computed `Map<itemId, listItem>`), `categories` (signal),
    `items` (signal), `selectedCategoryId` (signal).
  - `CategoryPickerList({ categories, selectedId, onSelect })`.
  - `CatalogueAddRow({ name, categoryLabel?, added, onAdd })`.
- Produces: `default function AddItems(props: { listId: string; listName: string;
  items: Required<ItemInterface>[]; shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[]; initialQuery: string })` — consumed by Task 3.

- [ ] **Step 1: Write the failing render tests**

Create `islands/add-items.test.tsx`:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AddItems from "./add-items.tsx";

const base = {
  listId: "l1",
  listName: "Groceries",
  items: [{ id: "i1", name: "Butter", categoryId: "d" }],
  shoppingList: [],
  categories: [
    { id: "d", label: "Dairy", order: 0 },
    { id: "b", label: "Bakery", order: 1 },
  ],
};

Deno.test("AddItems — idle shows category chips and no item rows", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, "Dairy");
  assertStringIncludes(html, "Bakery");
  assertStringIncludes(html, "Adding to Groceries");
  assert(!html.includes("Butter")); // no catalogue rows when idle
});

Deno.test("AddItems — a matching query lists the catalogue item", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "But" }));
  assertStringIncludes(html, "Butter");
});

Deno.test("AddItems — a query with no match shows the Create card", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "Tofu" }));
  assertStringIncludes(html, 'Create "Tofu"');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `deno test islands/add-items.test.tsx`
Expected: FAIL — module `./add-items.tsx` not found.

- [ ] **Step 3: Create `islands/add-items.tsx`**

```tsx
import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { For } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { CategoryPickerList } from "@/components/md3/CategoryPickerList.tsx";
import { CatalogueAddRow } from "@/components/md3/CatalogueAddRow.tsx";

interface AddItemsProps {
  listId: string;
  listName: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
  initialQuery: string;
}

export default function AddItems(
  {
    listId,
    listName,
    items: catalog,
    shoppingList,
    categories: initialCategories,
    initialQuery,
  }: AddItemsProps,
) {
  // Instantiate the signal()-based hook exactly once (see CLAUDE.md).
  const {
    addToList,
    addToCatalog,
    listItemsMap,
    categories,
    items,
    selectedCategoryId,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [],
  );

  const filterFn = (searchString: string, item: ItemInterface) => {
    if (searchString.trim() === "") return false;
    return !!item?.name?.toLowerCase().includes(searchString.toLowerCase());
  };
  const { query, results, inputRef } = useSearchBox(
    catalog,
    filterFn,
    initialQuery,
  );

  // null = no chip filter; "" = the Uncategorized chip; else a category id.
  const filterCatId = useSignal<string | null>(null);
  const addedCount = useSignal(0);
  // Category-picker sub-view (mirrors the sheet's proven pattern, with room).
  const catPicking = useSignal(false);

  // Autofocus the search field on mount for a quick type-to-search flow.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleAdd = async (itemId: string) => {
    const id = await addToList(itemId);
    if (id) addedCount.value++;
  };

  const handleCreate = async (name: string) => {
    const id = await addToCatalog(name, selectedCategoryId.value || undefined);
    if (id) addedCount.value++;
    selectedCategoryId.value = "";
    query.value = "";
    inputRef.current?.focus();
  };

  const q = query.value.trim();
  const selectedCatLabel =
    categories.value.find((c) => c.id === selectedCategoryId.value)?.label ??
      "Uncategorized";

  const chipCats = [...categories.value].sort((a, b) =>
    (a.label ?? "").toLowerCase().localeCompare((b.label ?? "").toLowerCase())
  );

  const row = (item: ItemInterface) => (
    <CatalogueAddRow
      key={item.id}
      name={item.name ?? ""}
      categoryLabel={categories.value.find((c) => c.id === item.categoryId)
        ?.label ?? ""}
      added={listItemsMap.value.has(item.id ?? "")}
      onAdd={() => item.id && handleAdd(item.id)}
    />
  );

  const chipRow = (
    <div
      class="flex gap-2 overflow-x-auto px-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {chipCats.map((c) => (
        <Chip
          key={c.id}
          selected={filterCatId.value === c.id}
          onClick={() => {
            filterCatId.value = filterCatId.value === c.id
              ? null
              : (c.id ?? null);
          }}
        >
          {c.label}
        </Chip>
      ))}
      <Chip
        selected={filterCatId.value === ""}
        onClick={() => {
          filterCatId.value = filterCatId.value === "" ? null : "";
        }}
      >
        Uncategorized
      </Chip>
    </div>
  );

  // ── Category-picker sub-view (replaces the body while choosing) ──
  if (catPicking.value) {
    return (
      <div class="flex flex-col gap-2 pb-24">
        <div class="md-title-medium text-on-surface px-1">Choose category</div>
        <CategoryPickerList
          categories={categories.value}
          selectedId={selectedCategoryId.value}
          onSelect={(id) => {
            selectedCategoryId.value = id;
            catPicking.value = false;
          }}
        />
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-3 pb-24">
      {/* Search field */}
      <div class="relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <Icon name="search" size={20} />
        </span>
        <input
          ref={inputRef}
          value={query.value}
          onInput={(e) => {
            query.value = (e.target as HTMLInputElement).value;
            filterCatId.value = null; // typing overrides the chip filter
          }}
          placeholder="Search or add an item…"
          class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3.5 pl-11 pr-4 outline-none"
        />
      </div>

      {/* Running count sub-header */}
      <div class="md-label-medium text-on-surface-variant px-1">
        Adding to {listName}
        {addedCount.value > 0 ? ` · ${addedCount.value} added` : ""}
      </div>

      {(() => {
        // Typing → text search across the whole catalogue.
        if (q) {
          const exact = items.value.some((i) =>
            i.name?.toLowerCase() === q.toLowerCase()
          );
          return (
            <>
              {!exact && (
                <div class="bg-primary-container text-on-primary-container rounded-[var(--md-shape-lg)] p-3.5 mb-1 flex flex-col gap-3">
                  <div class="flex items-center gap-3.5">
                    <span class="w-9 h-9 rounded-full bg-on-primary-container text-primary-container grid place-items-center shrink-0">
                      <Icon name="plus" size={20} />
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="md-body-large">Create "{q}"</div>
                      <div class="md-body-small opacity-80">
                        New item — pick a category
                      </div>
                    </div>
                  </div>
                  <Pressable
                    onClick={() => {
                      catPicking.value = true;
                    }}
                    color="var(--md-on-primary-container)"
                    class="flex items-center justify-between gap-2 w-full rounded-[var(--md-shape-md)] border border-on-primary-container/40 px-3.5 py-2.5"
                  >
                    <span class="md-body-medium opacity-80">Category</span>
                    <span class="inline-flex items-center gap-1 md-label-large">
                      {selectedCatLabel} <Icon name="chevron" size={18} />
                    </span>
                  </Pressable>
                  <Button
                    variant="filled"
                    full
                    onClick={() => handleCreate(q)}
                    style={{
                      background: "var(--md-on-primary-container)",
                      color: "var(--md-primary-container)",
                    }}
                  >
                    Add to {selectedCatLabel}
                  </Button>
                </div>
              )}
              <div class="flex flex-col">
                <For each={results}>{(item) => row(item)}</For>
              </div>
            </>
          );
        }

        // Chip selected → that category's catalogue items.
        if (filterCatId.value !== null) {
          const catId = filterCatId.value;
          const inCat = items.value.filter((i) =>
            catId === "" ? !i.categoryId : i.categoryId === catId
          );
          return (
            <>
              {chipRow}
              <div class="flex flex-col">
                {inCat.map((item) => row(item))}
              </div>
              {inCat.length === 0 && (
                <p class="md-body-medium text-on-surface-variant px-1 py-3.5">
                  Nothing in this category yet.
                </p>
              )}
            </>
          );
        }

        // Idle → chips only.
        return chipRow;
      })()}
    </div>
  );
}
```

- [ ] **Step 4: Run the render tests to confirm they pass**

Run: `deno test islands/add-items.test.tsx`
Expected: PASS (3 tests). (The `initialQuery` seed from Task 1 is what makes the
"matching query" and "no match" cases render deterministically at SSR.)

- [ ] **Step 5: Run the full gates**

Run: `deno task check && deno test && deno task build`
Expected: check clean; tests pass (79 total); build ✓.

- [ ] **Step 6: Commit**

```bash
git add islands/add-items.tsx islands/add-items.test.tsx
git commit -m "$(cat <<'EOF'
feat(shopping): full-screen AddItems island

Search-across-all, browse-by-category chips (idle), batch add via
CatalogueAddRow, and a create-with-category card reusing CategoryPickerList.
Uses useShoppingList (optimistic, per-tap commits); no API change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Route wiring — `/shopping/[id]/add`

**Files:**
- Create: `routes/shopping/[id]/add.tsx`

**Interfaces:**
- Consumes: `page` from `fresh`; `CategoryRepo`, `ItemRepo`,
  `ShoppingListItemRepo`, `ShoppingListRepo` from `@/database/index.ts`;
  `define` from `@/utils/index.ts`; `AddItems` (default) from
  `@/islands/add-items.tsx`.
- Produces: the route. Sets `ctx.state.appBar = { mode: "detail", title:
  "Add items", backUrl: "/shopping/<id>" }`. Renders `AddItems` inside
  `<main class="max-w-md mx-auto p-4">`.

- [ ] **Step 1: Create the route**

This mirrors `routes/shopping/[id]/index.tsx` exactly, plus the `q` param.

```tsx
import { page } from "fresh";
import {
  CategoryRepo,
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
} from "@/database/index.ts";
import AddItemsIsland from "@/islands/add-items.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const listId = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) {
      return new Response("Not found", { status: 404 });
    }
    ctx.state.appBar = {
      mode: "detail",
      title: "Add items",
      backUrl: `/shopping/${listId}`,
    };
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
    const initialQuery = ctx.url.searchParams.get("q") ?? "";
    return page({ list, items, shoppingList, categories, initialQuery });
  },
});

export default define.page<typeof handler>(function AddItemsPage({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <AddItemsIsland
        listId={data.list.id}
        listName={data.list.name}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
        initialQuery={data.initialQuery}
      />
    </main>
  );
});
```

- [ ] **Step 2: Type-check, lint, format, build**

Run: `deno task check && deno task build`
Expected: check clean; build ✓ (a new server route asset for
`_shopping_id_add` appears in the build output).

- [ ] **Step 3: Live smoke test the route**

Start the dev server and log in (admin/admin), then visit an existing list's add
route directly:

```
/shopping/<some-list-id>/add?q=te
```

Expected: the shell shows a back arrow + "Add items" title; the search field is
focused and pre-filled with `te`; matching catalogue items are listed. The back
arrow returns to `/shopping/<id>`. Confirm zero console errors.

- [ ] **Step 4: Commit**

```bash
git add routes/shopping/[id]/add.tsx
git commit -m "$(cat <<'EOF'
feat(shopping): /shopping/[id]/add route for the full-screen add flow

SSR-loads the catalogue/categories/list and renders the AddItems island.
Seeds the search from ?q=. Back returns to the list. No API change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Slim the quick-add sheet + hand off to the page

**Files:**
- Modify: `islands/items.tsx`
- Modify: `islands/items.test.tsx`

**Interfaces:**
- Consumes: `CatalogueAddRow` and `Icon` (`expand`) from Task 1;
  the `/shopping/[id]/add` route from Task 3.
- Produces: no new exports; the add sheet now only searches + adds existing
  items, and hands off to the page for create / full browse.

**What to remove from `islands/items.tsx` (add-sheet-only machinery):**
- the `catPicking` and `wantCreate` signals;
- the `handleCreateItem` function;
- the `selectedCatLabel` computed used by the add sheet;
- the destructured `addToCatalog` and `selectedCategoryId` (they become unused
  once the sheet no longer creates — `deno task check` will flag them);
- the add sheet's `CategoryPickerList` branch and its inline create card + subtle
  "Add … as a new item" link.

**Keep intact:** the whole **item-editor** sheet, including its `editCatPicking`
signal, its `CategoryPickerList` usage, and `handleCategoryChange`. Keep the
`CategoryPickerList` import (the editor still uses it). Keep `useSearchBox`
(`query`, `results`, `inputRef`, `reset`) for the sheet's add-existing search.

- [ ] **Step 1: Add the navigation helper**

In `islands/items.tsx`, near the other add-item handlers (after the
`handleAddToList` definition), add:

```tsx
  const openAddPage = (q?: string) => {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    globalThis.location.href = `/shopping/${listId}/add${suffix}`;
  };
```

- [ ] **Step 2: Replace the add-sheet JSX**

Replace the entire add-item `<Sheet>…</Sheet>` block (the one with
`title={catPicking.value ? "Choose category" : "Add items"}`) with this slimmed
version:

```tsx
      {/* ══════════════════════ Add-item sheet (quick) ══════════════════════ */}
      <Sheet
        open={addOpen.value}
        onClose={() => {
          addOpen.value = false;
          reset();
        }}
        title="Add items"
      >
        {/* Hand off to the full-screen add page */}
        <div class="flex justify-end -mt-1 mb-1">
          <Pressable
            onClick={() => openAddPage(query.value.trim())}
            class="inline-flex items-center gap-1.5 md-label-large text-primary rounded-[var(--md-shape-full)] px-3 py-1.5"
          >
            <Icon name="expand" size={18} /> Full screen
          </Pressable>
        </div>

        {/* Search input */}
        <div class="relative mb-3">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
            <Icon name="search" size={20} />
          </span>
          <input
            ref={inputRef}
            value={query.value}
            onInput={(e) => {
              query.value = (e.target as HTMLInputElement).value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.value.trim()) {
                const qq = query.value.trim();
                const exact = items.value.some((i) =>
                  i.name?.toLowerCase() === qq.toLowerCase()
                );
                if (!exact && results.value.length === 0) openAddPage(qq);
              }
            }}
            placeholder="Search or add an item…"
            class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3.5 pl-11 pr-4 outline-none"
          />
        </div>

        {(() => {
          const qq = query.value.trim();
          if (!qq) {
            return (
              <div class="flex flex-col items-center text-center gap-1 px-6 py-10 text-on-surface-variant">
                <Icon name="search" size={28} />
                <div class="md-body-medium mt-1">Search your catalogue</div>
                <div class="md-body-small opacity-80">
                  or open full screen to add something new
                </div>
              </div>
            );
          }
          const exact = items.value.some((i) =>
            i.name?.toLowerCase() === qq.toLowerCase()
          );
          return (
            <>
              <div class="flex flex-col">
                <For each={results}>
                  {(item) => (
                    <CatalogueAddRow
                      key={item.id}
                      name={item.name ?? ""}
                      categoryLabel={categories.value.find((c) =>
                        c.id === item.categoryId
                      )?.label ?? ""}
                      added={listItemsMap.value.has(item.id ?? "")}
                      onAdd={() => item.id && handleAddToList(item.id)}
                    />
                  )}
                </For>
              </div>
              {!exact && (
                <Pressable
                  onClick={() => openAddPage(qq)}
                  class="flex items-center gap-2 w-full text-left rounded-[var(--md-shape-md)] px-3 py-3 mt-1 text-primary md-label-large"
                >
                  <Icon name="plus" size={20} /> Create "{qq}" — opens full screen
                </Pressable>
              )}
            </>
          );
        })()}
      </Sheet>
```

- [ ] **Step 3: Add the `CatalogueAddRow` import; remove now-dead code**

Add to the imports:

```tsx
import { CatalogueAddRow } from "@/components/md3/CatalogueAddRow.tsx";
```

Then delete the `catPicking` signal, the `wantCreate` signal, the
`handleCreateItem` function, the add-sheet `selectedCatLabel` computed, and
remove `addToCatalog` and `selectedCategoryId` from the `useShoppingList`
destructure. (Do **not** touch the item-editor sheet or its `editCatPicking`.)

- [ ] **Step 4: Run the gates; fix any unused-symbol errors they surface**

Run: `deno task check`
Expected: clean. If `deno lint`/`deno check` reports an unused variable or import
(e.g. a leftover `selectedCategoryId`), delete that symbol and re-run until clean.

- [ ] **Step 5: Update `islands/items.test.tsx`**

Replace the file with assertions that the slimmed sheet renders (the add sheet
body renders at SSR because `Sheet` always renders its children):

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(
    h(Items, {
      listId: "l1",
      listName: "Test list",
      items: [],
      shoppingList: [],
      categories: [],
    }),
  );
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});

Deno.test("Items — add sheet is search-first with a full-screen handoff", () => {
  const html = render(
    h(Items, {
      listId: "l1",
      listName: "Test list",
      items: [],
      shoppingList: [],
      categories: [],
    }),
  );
  assertStringIncludes(html, "Search your catalogue"); // idle hint
  assertStringIncludes(html, "Full screen"); // expand handoff
});
```

- [ ] **Step 6: Run the full gates**

Run: `deno task check && deno test && deno task build`
Expected: check clean; all tests pass; build ✓.

- [ ] **Step 7: Commit**

```bash
git add islands/items.tsx islands/items.test.tsx
git commit -m "$(cat <<'EOF'
refactor(shopping): slim quick-add sheet; hand off create/browse to the page

The sheet now only searches and adds existing items (via the shared
CatalogueAddRow). A "Full screen" control and the "Create …" affordance
navigate to /shopping/[id]/add, removing the in-sheet create card and nested
category picker. Item editor is unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Live QA of the full loop + final gates

**Files:** none (verification only).

- [ ] **Step 1: Ensure the gates are green**

Run: `deno task check && deno test && deno task build`
Expected: all green.

- [ ] **Step 2: Live-verify the whole flow on a mobile viewport**

Start the dev server, log in (admin/admin), open a list with a large catalogue,
and confirm, capturing evidence for each:

1. **Sheet (quick):** Plan search bar → sheet opens, field autofocused; typing
   shows matching rows; tapping a row adds it (row → Added ✓); the sheet stays
   open for more. No create card, no nested category picker in the sheet.
2. **Handoff:** the sheet's "Full screen" control opens `/shopping/<id>/add`
   (carrying the typed query); the "Create '<q>'" affordance (no match) also
   opens the page with `?q=`.
3. **Page idle:** category chips shown, **no** item list dumped; "Adding to
   <list>" sub-header present.
4. **Page chip browse:** tapping a chip lists that category's items; tapping
   again clears it.
5. **Page search:** typing filters across all; batch-add several (count
   increments); rows flip to Added ✓.
6. **Page create:** type a novel name → "Create '<q>'" card → Category button →
   picker → choose a category → returns → "Add to <category>" creates the item,
   adds it to the list, and clears the field.
7. **Return:** back arrow → `/shopping/<id>` shows the list with all newly added
   items in place. Zero console errors.

- [ ] **Step 3: Confirm no data-model/API drift**

Run: `git diff --stat develop...HEAD`
Expected: only the files in this plan changed. No files under `database/`,
`models/`, `services/`, or `routes/api/` are modified.

- [ ] **Step 4: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill to push and open a
PR into `develop`.

---

## Self-review notes

- **Spec coverage:** two-tier (Tasks 2–4), expand-from-sheet handoff (Task 4),
  idle chips (Task 2), inline category-create excluded (Task 2 uses select-only
  `CategoryPickerList`), shared `CatalogueAddRow` (Task 1, used in Tasks 2 & 4),
  no API change (verified Task 5 Step 3), return-with-no-save (Task 3 back arrow +
  optimistic adds). All spec sections map to a task.
- **`addToCatalog` already adds to the list** (`hooks/useShoppingList.ts`), so
  §5.2's open question is resolved: "Create" is a single call.
- **Type consistency:** `AddItems` props in Task 2 match the render in Task 3;
  `CatalogueAddRow` props match its uses in Tasks 2 and 4; `useSearchBox`'s new
  third arg is optional and backward-compatible.
