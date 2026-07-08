# MD3 Catalogue & Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the item Catalogue and category management on the MD3 foundation, wired to the existing `Lists | Catalogue` segmented, reusing the existing data layer/API.

**Architecture:** Route-per-tab. `/shopping` (Lists) and `/shopping/catalogue` (Catalogue) are sibling routes the segmented navigates between; `/shopping/categories` is a detail screen for aisle-order reordering. A new `useCatalogue` hook holds `items` + `categories` signals with optimistic CRUD over the existing REST endpoints (new thin client wrappers only — no backend change). The old plain-Tailwind catalogue/categories UI and its dead helpers are deleted, which clears the 7 pre-existing `deno task check` errors.

**Tech Stack:** Deno + Fresh 2 (`import { page } from "fresh"`, `define.handlers`/`define.page`), Preact + `@preact/signals`, Tailwind v4 (`class`, not `className`), MD3 components in `components/md3/*`, Deno KV via repos.

## Global Constraints

- **No backend changes.** Repositories, KV schema, models, and API route handlers are untouched. Only `services/api.ts` gains client wrappers that call **existing** endpoints (`POST/PATCH/DELETE /api/shopping/categories`).
- **Category ordering is context-dependent:** alphabetical (by `label`, case-insensitive) in every catalogue surface; aisle `order` only in Shop-mode list grouping (untouched) and edited on the reorder screen.
- **Signals:** island-local state uses `useSignal()`; hooks use module `signal()`/`computed()` and are instantiated once per island via `useMemo(() => useCatalogue(...), [])`. A signal that must drive re-render is read (`.value`) at the **top level** of the component body, never only inside nested JSX children.
- **JSX:** always `class`, never `className` (precompile).
- **Imports:** `@/` alias for project root.
- **Icons:** only names in the `IconName` union: `home, cart, check, checklist, plate, card, plus, minus, bell, chevron, back, search, dots, tune, people, bolt, sparkle, edit, user, swap, cog, x, trash, share, calendar, leaf, flame, tag`.
- **Commits:** Conventional Commits; end every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Per-task gate:** `deno fmt`, `deno lint <files>`, scoped `deno check <files>`, and the task's tests. **Final gate (Task 6):** whole-project `deno task check` must be **green** (the WIP files with the 7 errors are gone by then).
- **Mobile-first:** page wrappers use `max-w-md mx-auto`.

---

## Task 1: `useCatalogue` hook + category API client methods

**Files:**
- Modify: `services/api.ts` (extend the `categories` object)
- Create: `hooks/useCatalogue.ts`
- Test: `hooks/useCatalogue.test.ts`

**Interfaces:**
- Consumes: `api.items.{create,update,delete}`, new `api.categories.{create,update,reorder,delete}`; `ItemInterface`, `CategoryInterface`.
- Produces: `useCatalogue(initialItems, initialCategories)` returning
  `{ items: Signal<ItemInterface[]>, categories: Signal<CategoryInterface[]>, pendingCount: Signal<number>, sortedCategories: ReadonlySignal<CategoryInterface[]>, itemNames: ReadonlySignal<Set<string>>, hasUncategorized: ReadonlySignal<boolean>, itemsForCategory(categoryId?: string): ItemInterface[], addItem(name, categoryId?): Promise<string|null>, renameItem(id, name): Promise<void>, moveItem(id, categoryId): Promise<void>, removeItem(id): Promise<void>, createCategory(label): Promise<CategoryInterface|null>, renameCategory(id, label): Promise<void>, deleteCategory(id): Promise<void> }`
- `api.categories.create(label): Promise<CategoryInterface|null>`, `.update(id, patch: {label?: string; order?: number}): Promise<CategoryInterface|null>`, `.reorder(updates: Array<{id: string; order: number}>): Promise<void>`, `.delete(id): Promise<void>`.

- [ ] **Step 1: Extend `api.categories` in `services/api.ts`**

Replace the existing `categories` object (currently only `getAll`) with:

```ts
  categories: {
    getAll: async (): Promise<CategoryInterface[]> => {
      const res = await fetch("/api/shopping/categories");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (label: string): Promise<CategoryInterface | null> => {
      const res = await fetch("/api/shopping/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    update: async (
      id: string,
      patch: { label?: string; order?: number },
    ): Promise<CategoryInterface | null> => {
      const res = await fetch("/api/shopping/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    reorder: async (
      updates: Array<{ id: string; order: number }>,
    ): Promise<void> => {
      await fetch("/api/shopping/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/shopping/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
```

- [ ] **Step 2: Write the failing tests** — `hooks/useCatalogue.test.ts`

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useCatalogue } from "@/hooks/useCatalogue.ts";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";

const item = (id: string, name: string, categoryId?: string): ItemInterface => ({
  id,
  name,
  categoryId,
});
const cat = (id: string, label: string, order = 0): CategoryInterface => ({
  id,
  label,
  order,
});

Deno.test("sortedCategories — alphabetical by label (case-insensitive)", () => {
  const hook = useCatalogue([], [
    cat("b", "bakery"),
    cat("a", "Apples"),
    cat("c", "Dairy"),
  ]);
  assertEquals(hook.sortedCategories.value.map((c) => c.label), [
    "Apples",
    "bakery",
    "Dairy",
  ]);
});

Deno.test("itemsForCategory — filters by id and sorts by name", () => {
  const hook = useCatalogue(
    [item("i2", "Yoghurt", "d"), item("i1", "Butter", "d"), item("i3", "Bread", "b")],
    [cat("d", "Dairy"), cat("b", "Bakery")],
  );
  assertEquals(hook.itemsForCategory("d").map((i) => i.name), ["Butter", "Yoghurt"]);
});

Deno.test("itemsForCategory(undefined) — includes no-category and dangling-category items", () => {
  const hook = useCatalogue(
    [item("i1", "Salt"), item("i2", "Milk", "d"), item("i3", "Mystery", "gone")],
    [cat("d", "Dairy")],
  );
  assertEquals(hook.itemsForCategory(undefined).map((i) => i.name), ["Mystery", "Salt"]);
  assertEquals(hook.hasUncategorized.value, true);
});

Deno.test("itemNames — lowercased set for duplicate detection", () => {
  const hook = useCatalogue([item("i1", "Butter")], []);
  assertEquals(hook.itemNames.value.has("butter"), true);
});

Deno.test("addItem — creates via API, appends, returns id", async () => {
  using _c = stub(api.items, "create", () => Promise.resolve(item("new", "Cheese", "d")));
  const hook = useCatalogue([], [cat("d", "Dairy")]);
  const id = await hook.addItem("Cheese", "d");
  assertEquals(id, "new");
  assertEquals(hook.items.value.map((i) => i.name), ["Cheese"]);
});

Deno.test("addItem — blank name returns null and calls nothing", async () => {
  const hook = useCatalogue([], []);
  assertEquals(await hook.addItem("   "), null);
  assertEquals(hook.items.value.length, 0);
});

Deno.test("renameItem — optimistic rename, calls update with existing categoryId", async () => {
  const calls: Array<[string, string, string | undefined]> = [];
  using _u = stub(api.items, "update", (id, name, categoryId) => {
    calls.push([id, name, categoryId]);
    return Promise.resolve(item(id, name, categoryId));
  });
  const hook = useCatalogue([item("i1", "Buttr", "d")], [cat("d", "Dairy")]);
  await hook.renameItem("i1", "Butter");
  assertEquals(hook.items.value[0].name, "Butter");
  assertEquals(calls[0], ["i1", "Butter", "d"]);
});

Deno.test("moveItem — optimistic move, calls update with existing name", async () => {
  const calls: Array<[string, string, string | undefined]> = [];
  using _u = stub(api.items, "update", (id, name, categoryId) => {
    calls.push([id, name, categoryId]);
    return Promise.resolve(item(id, name, categoryId));
  });
  const hook = useCatalogue([item("i1", "Butter", "d")], [cat("d", "Dairy"), cat("b", "Bakery")]);
  await hook.moveItem("i1", "b");
  assertEquals(hook.items.value[0].categoryId, "b");
  assertEquals(calls[0], ["i1", "Butter", "b"]);
});

Deno.test("removeItem — optimistic remove, calls delete", async () => {
  const calls: string[] = [];
  using _d = stub(api.items, "delete", (id) => {
    calls.push(id);
    return Promise.resolve();
  });
  const hook = useCatalogue([item("i1", "Butter")], []);
  await hook.removeItem("i1");
  assertEquals(hook.items.value.length, 0);
  assertEquals(calls, ["i1"]);
});

Deno.test("createCategory — creates via API and appends", async () => {
  using _c = stub(api.categories, "create", () => Promise.resolve(cat("new", "Frozen", 3)));
  const hook = useCatalogue([], []);
  const created = await hook.createCategory("Frozen");
  assertEquals(created?.label, "Frozen");
  assertEquals(hook.categories.value.length, 1);
});

Deno.test("deleteCategory — removes category; its items become uncategorized", async () => {
  using _d = stub(api.categories, "delete", () => Promise.resolve());
  const hook = useCatalogue([item("i1", "Milk", "d")], [cat("d", "Dairy")]);
  await hook.deleteCategory("d");
  assertEquals(hook.categories.value.length, 0);
  assertEquals(hook.itemsForCategory(undefined).map((i) => i.name), ["Milk"]);
});

Deno.test("pendingCount — returns to 0 after an operation", async () => {
  using _c = stub(api.items, "create", () => Promise.resolve(item("new", "Cheese")));
  const hook = useCatalogue([], []);
  await hook.addItem("Cheese");
  assertEquals(hook.pendingCount.value, 0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test hooks/useCatalogue.test.ts`
Expected: FAIL — `Module not found "…/hooks/useCatalogue.ts"`.

- [ ] **Step 4: Implement `hooks/useCatalogue.ts`**

```ts
import { computed, signal } from "@preact/signals";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";

export function useCatalogue(
  initialItems: ItemInterface[],
  initialCategories: CategoryInterface[],
) {
  const items = signal<ItemInterface[]>(initialItems ?? []);
  const categories = signal<CategoryInterface[]>(initialCategories ?? []);
  const pendingCount = signal<number>(0);

  const sortedCategories = computed(() =>
    [...categories.value].sort((a, b) =>
      a.label.toLowerCase().localeCompare(b.label.toLowerCase())
    )
  );
  const categoryIdSet = computed(() => new Set(categories.value.map((c) => c.id)));
  const itemNames = computed(() =>
    new Set(items.value.map((i) => i.name.trim().toLowerCase()))
  );
  const hasUncategorized = computed(() =>
    items.value.some((i) => !i.categoryId || !categoryIdSet.value.has(i.categoryId))
  );

  const itemsForCategory = (categoryId?: string): ItemInterface[] => {
    const ids = categoryIdSet.value;
    const list = categoryId
      ? items.value.filter((i) => i.categoryId === categoryId)
      : items.value.filter((i) => !i.categoryId || !ids.has(i.categoryId));
    return [...list].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  };

  const addItem = async (name: string, categoryId?: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    pendingCount.value++;
    try {
      const created = await api.items.create({ name: trimmed, categoryId });
      if (created) {
        items.value = [...items.value, created];
        return created.id ?? null;
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const renameItem = async (id: string, name: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    const trimmed = name.trim();
    if (!existing || !trimmed) return;
    items.value = items.value.map((i) => (i.id === id ? { ...i, name: trimmed } : i));
    pendingCount.value++;
    try {
      await api.items.update(id, trimmed, existing.categoryId);
    } finally {
      pendingCount.value--;
    }
  };

  const moveItem = async (id: string, categoryId: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    if (!existing) return;
    items.value = items.value.map((i) => (i.id === id ? { ...i, categoryId } : i));
    pendingCount.value++;
    try {
      await api.items.update(id, existing.name, categoryId);
    } finally {
      pendingCount.value--;
    }
  };

  const removeItem = async (id: string): Promise<void> => {
    items.value = items.value.filter((i) => i.id !== id);
    pendingCount.value++;
    try {
      await api.items.delete(id);
    } finally {
      pendingCount.value--;
    }
  };

  const createCategory = async (label: string): Promise<CategoryInterface | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    pendingCount.value++;
    try {
      const created = await api.categories.create(trimmed);
      if (created) {
        categories.value = [...categories.value, created];
        return created;
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const renameCategory = async (id: string, label: string): Promise<void> => {
    const trimmed = label.trim();
    if (!trimmed) return;
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, label: trimmed } : c
    );
    pendingCount.value++;
    try {
      await api.categories.update(id, { label: trimmed });
    } finally {
      pendingCount.value--;
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    categories.value = categories.value.filter((c) => c.id !== id);
    pendingCount.value++;
    try {
      await api.categories.delete(id);
    } finally {
      pendingCount.value--;
    }
  };

  return {
    items,
    categories,
    pendingCount,
    sortedCategories,
    itemNames,
    hasUncategorized,
    itemsForCategory,
    addItem,
    renameItem,
    moveItem,
    removeItem,
    createCategory,
    renameCategory,
    deleteCategory,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test hooks/useCatalogue.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Format, lint, type-check, commit**

```bash
deno fmt services/api.ts hooks/useCatalogue.ts hooks/useCatalogue.test.ts
deno lint services/api.ts hooks/useCatalogue.ts hooks/useCatalogue.test.ts
deno check hooks/useCatalogue.ts hooks/useCatalogue.test.ts services/api.ts
git add services/api.ts hooks/useCatalogue.ts hooks/useCatalogue.test.ts
git commit -m "feat(catalogue): useCatalogue hook + category API client methods

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Catalogue island

**Files:**
- Create: `islands/catalogue.tsx`
- Test: `islands/catalogue.test.tsx`

**Interfaces:**
- Consumes: `useCatalogue` (Task 1); md3 `Segmented, Chip, ListItem, Sheet, Button, IconButton, Icon, Pressable`.
- Produces: `export default function Catalogue({ initialItems, initialCategories }: { initialItems: ItemInterface[]; initialCategories: CategoryInterface[] })`. Rendered by `/shopping/catalogue` (Task 3).

**Behavior (ported from `docs/happie/project/md3-catalogue.jsx`, mapped to id-based categories, alphabetical):**
- Top: `Segmented` (`Lists | Catalogue`), value `"catalogue"`; choosing `"lists"` navigates to `/shopping`.
- Live **search** input. When non-empty → search mode: name matches grouped under alphabetical category headers (2-col grid). Empty → offer add-to-catalogue.
- Browse mode: category **rail** = pinned "All" (tune icon) opening the picker + alphabetical `Chip`s + a trailing "Uncategorized" chip when `hasUncategorized`. One category selected at a time.
- Category **header**: "N items in {label}" + a `dots` `IconButton` opening the category menu (rename/delete) — only for real categories, not the Uncategorized bucket.
- **Item grid**: selected category's items as tiles (tap → edit sheet) + dashed "Add item" tile (→ add sheet).
- **Sheets**: edit-item, add-to-catalogue, category-picker (with "New category" + "Aisle order" link to `/shopping/categories`), category-menu (rename/delete).

- [ ] **Step 1: Write the failing render test** — `islands/catalogue.test.tsx`

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Catalogue from "./catalogue.tsx";

Deno.test("Catalogue — renders segmented, categories, selected items, add tile", () => {
  const html = render(h(Catalogue, {
    initialItems: [
      { id: "i1", name: "Butter", categoryId: "d" },
      { id: "i2", name: "Bread", categoryId: "b" },
    ],
    initialCategories: [
      { id: "d", label: "Dairy", order: 0 },
      { id: "b", label: "Bakery", order: 1 },
    ],
  }));
  assertStringIncludes(html, "Lists");
  assertStringIncludes(html, "Catalogue");
  assertStringIncludes(html, "Bakery"); // alphabetical-first → selected by default
  assertStringIncludes(html, "Bread"); // item in the selected (Bakery) category
  assertStringIncludes(html, "Add item");
});

Deno.test("Catalogue — shows an Uncategorized chip when uncategorized items exist", () => {
  const html = render(h(Catalogue, {
    initialItems: [{ id: "i1", name: "Salt" }],
    initialCategories: [{ id: "d", label: "Dairy", order: 0 }],
  }));
  assertStringIncludes(html, "Uncategorized");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test islands/catalogue.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `islands/catalogue.tsx`**

```tsx
import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { useCatalogue } from "@/hooks/useCatalogue.ts";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

const SEGMENTED_OPTIONS: [string, "cart" | "tag", string][] = [
  ["lists", "cart", "Lists"],
  ["catalogue", "tag", "Catalogue"],
];

const UNCAT = "__uncat__"; // sentinel for the uncategorized bucket

const fieldClass =
  "flex-1 min-w-0 md-body-large text-on-surface bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-4 py-3 focus:outline-none";

interface CatalogueProps {
  initialItems: ItemInterface[];
  initialCategories: CategoryInterface[];
}

export default function Catalogue(
  { initialItems, initialCategories }: CatalogueProps,
) {
  const cat = useMemo(() => useCatalogue(initialItems, initialCategories), []);

  const firstAlpha = [...initialCategories].sort((a, b) =>
    a.label.toLowerCase().localeCompare(b.label.toLowerCase())
  )[0]?.id ?? UNCAT;

  const query = useSignal("");
  const selected = useSignal<string>(firstAlpha);
  const editing = useSignal<ItemInterface | null>(null);
  const addOpen = useSignal(false);
  const pickerOpen = useSignal(false);
  const menuCat = useSignal<CategoryInterface | null>(null);

  // top-level signal reads → island subscribes to these
  const cats = cat.sortedCategories.value;
  const names = cat.itemNames.value;
  const showUncat = cat.hasUncategorized.value;
  const q = query.value.trim().toLowerCase();
  const searching = q.length > 0;

  const selectedIsUncat = selected.value === UNCAT;
  const selectedCatId = selectedIsUncat ? undefined : selected.value;
  const selectedLabel = selectedIsUncat
    ? "Uncategorized"
    : cats.find((c) => c.id === selected.value)?.label ?? "";
  const visibleItems = cat.itemsForCategory(selectedCatId);

  const labelFor = (id?: string) =>
    !id || !cats.some((c) => c.id === id)
      ? "Uncategorized"
      : cats.find((c) => c.id === id)!.label;

  const allMatches = searching
    ? cat.items.value.filter((i) => i.name.toLowerCase().includes(q))
    : [];
  // group matches: alphabetical category labels, then Uncategorized
  const matchGroups: { label: string; items: ItemInterface[] }[] = [];
  for (const c of cats) {
    const its = allMatches.filter((i) => i.categoryId === c.id);
    if (its.length) matchGroups.push({ label: c.label, items: its });
  }
  const uncatMatches = allMatches.filter((i) =>
    !i.categoryId || !cats.some((c) => c.id === i.categoryId)
  );
  if (uncatMatches.length) {
    matchGroups.push({ label: "Uncategorized", items: uncatMatches });
  }

  const itemTile = (it: ItemInterface) => (
    <Pressable
      key={it.id}
      onClick={() => (editing.value = it)}
      class="flex items-center justify-between gap-2 bg-surface border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3.5 md-body-large text-on-surface text-left"
    >
      <span class="flex-1 min-w-0 truncate">{it.name}</span>
      <Icon name="edit" size={18} class="text-on-surface-variant shrink-0" />
    </Pressable>
  );

  return (
    <>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
        <Segmented
          options={SEGMENTED_OPTIONS}
          value="catalogue"
          onChange={(k) => {
            if (k === "lists") globalThis.location.href = "/shopping";
          }}
        />
      </div>

      <div class="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {/* search */}
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={query.value}
            onInput={(e) => (query.value = e.currentTarget.value)}
            placeholder="Search the catalogue"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {searching && (
            <IconButton
              name="x"
              size={36}
              iconSize={18}
              aria-label="Clear search"
              onClick={() => (query.value = "")}
            />
          )}
        </div>

        {searching
          ? (
            matchGroups.length === 0
              ? (
                <div class="px-2 pt-2 text-center flex flex-col items-center gap-4">
                  <div class="md-title-medium text-on-surface">
                    No items match “{query.value.trim()}”
                  </div>
                  <Button
                    variant="tonal"
                    icon="plus"
                    onClick={() => (addOpen.value = true)}
                  >
                    Add to catalogue
                  </Button>
                </div>
              )
              : (
                matchGroups.map((g) => (
                  <div key={g.label} class="flex flex-col gap-2.5">
                    <div class="md-label-medium uppercase text-on-surface-variant sticky top-0 bg-background px-1 py-1">
                      {g.label}
                    </div>
                    <div class="grid grid-cols-2 gap-2.5">
                      {g.items.map(itemTile)}
                    </div>
                  </div>
                ))
              )
          )
          : (
            <>
              {/* category rail */}
              <div class="flex items-center gap-2">
                <Pressable
                  onClick={() => (pickerOpen.value = true)}
                  class="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--md-shape-sm)] border border-outline-variant text-on-surface-variant md-label-large"
                >
                  <Icon name="tune" size={16} /> All
                </Pressable>
                <div class="flex gap-2 overflow-x-auto flex-1 pr-1">
                  {cats.map((c) => (
                    <Chip
                      key={c.id}
                      selected={c.id === selected.value}
                      leadingCheck={false}
                      onClick={() => (selected.value = c.id)}
                    >
                      {c.label}
                    </Chip>
                  ))}
                  {showUncat && (
                    <Chip
                      selected={selectedIsUncat}
                      leadingCheck={false}
                      onClick={() => (selected.value = UNCAT)}
                    >
                      Uncategorized
                    </Chip>
                  )}
                </div>
              </div>

              {/* category header */}
              <div class="flex items-center justify-between gap-2 pl-1">
                <span class="md-body-medium text-on-surface-variant">
                  {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
                  {" "}in {selectedLabel}
                </span>
                {!selectedIsUncat && selected.value && (
                  <IconButton
                    name="dots"
                    size={36}
                    iconSize={20}
                    aria-label="Category options"
                    onClick={() => {
                      menuCat.value = cats.find((c) => c.id === selected.value) ??
                        null;
                    }}
                  />
                )}
              </div>

              {/* item grid + add tile */}
              <div class="grid grid-cols-2 gap-2.5">
                {visibleItems.map(itemTile)}
                <Pressable
                  onClick={() => (addOpen.value = true)}
                  color="var(--md-primary)"
                  class={`flex items-center justify-center gap-2 border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3.5 text-primary md-label-large min-h-[52px] ${
                    visibleItems.length === 0 ? "col-span-2" : ""
                  }`}
                >
                  <Icon name="plus" size={20} stroke={2.3} /> Add item
                </Pressable>
              </div>
            </>
          )}
      </div>

      {/* ── Edit item sheet ── */}
      <EditItemSheet
        item={editing.value}
        cats={cats}
        names={names}
        onClose={() => (editing.value = null)}
        onRename={(name) => {
          if (editing.value) cat.renameItem(editing.value.id, name);
          editing.value = null;
        }}
        onMove={(categoryId) => {
          if (editing.value) cat.moveItem(editing.value.id, categoryId);
          editing.value = null;
        }}
        onRemove={() => {
          if (editing.value) cat.removeItem(editing.value.id);
          editing.value = null;
        }}
      />

      {/* ── Add-to-catalogue sheet ── */}
      <AddItemSheet
        open={addOpen.value}
        cats={cats}
        names={names}
        presetCat={selectedCatId}
        onClose={() => (addOpen.value = false)}
        onAdd={(name, categoryId) => cat.addItem(name, categoryId)}
        onCreateCategory={(label) => cat.createCategory(label)}
      />

      {/* ── Category picker sheet ── */}
      <Sheet
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        title="Categories"
      >
        <CategoryPicker
          cats={cats}
          counts={(id) => cat.itemsForCategory(id).length}
          selected={selected.value}
          onPick={(id) => {
            selected.value = id;
            pickerOpen.value = false;
          }}
          onNew={async (label) => {
            const created = await cat.createCategory(label);
            if (created) selected.value = created.id;
          }}
        />
      </Sheet>

      {/* ── Category rename / delete sheet ── */}
      <CategoryMenuSheet
        category={menuCat.value}
        itemCount={menuCat.value ? cat.itemsForCategory(menuCat.value.id).length : 0}
        onClose={() => (menuCat.value = null)}
        onRename={(label) => {
          if (menuCat.value) cat.renameCategory(menuCat.value.id, label);
          menuCat.value = null;
        }}
        onDelete={() => {
          if (menuCat.value) {
            if (selected.value === menuCat.value.id) selected.value = UNCAT;
            cat.deleteCategory(menuCat.value.id);
          }
          menuCat.value = null;
        }}
      />
    </>
  );
}

/* ── Edit one catalogue item ── */
function EditItemSheet(
  { item, cats, names, onClose, onRename, onMove, onRemove }: {
    item: ItemInterface | null;
    cats: CategoryInterface[];
    names: Set<string>;
    onClose: () => void;
    onRename: (name: string) => void;
    onMove: (categoryId: string) => void;
    onRemove: () => void;
  },
) {
  const name = useSignal(item?.name ?? "");
  useEffect(() => {
    name.value = item?.name ?? "";
  }, [item?.id]);
  const v = name.value.trim();
  const dupe = !!v && item !== null &&
    v.toLowerCase() !== item.name.toLowerCase() && names.has(v.toLowerCase());
  return (
    <Sheet open={item !== null} onClose={onClose} title="Edit item">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Name
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={name.value}
              onInput={(e) => (name.value = e.currentTarget.value)}
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!v || dupe || v === item?.name}
              onClick={() => onRename(v)}
            >
              Save
            </Button>
          </div>
          {dupe && (
            <div class="md-body-small text-error mt-2">
              “{v}” is already in your catalogue
            </div>
          )}
        </div>
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Category
          </div>
          <div class="flex gap-2 flex-wrap">
            {cats.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === item?.categoryId}
                leadingCheck={false}
                onClick={() => onMove(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <Button variant="error" icon="trash" onClick={onRemove}>
          Remove from catalogue
        </Button>
      </div>
    </Sheet>
  );
}

/* ── Add items to the catalogue (rapid-fire) ── */
function AddItemSheet(
  { open, cats, names, presetCat, onClose, onAdd, onCreateCategory }: {
    open: boolean;
    cats: CategoryInterface[];
    names: Set<string>;
    presetCat?: string;
    onClose: () => void;
    onAdd: (name: string, categoryId?: string) => void;
    onCreateCategory: (label: string) => Promise<CategoryInterface | null>;
  },
) {
  const chosen = useSignal<string | undefined>(presetCat ?? cats[0]?.id);
  const name = useSignal("");
  const newOpen = useSignal(false);
  const newName = useSignal("");
  const added = useSignal<string[]>([]);
  useEffect(() => {
    if (open) {
      chosen.value = presetCat ?? cats[0]?.id;
      name.value = "";
      added.value = [];
      newOpen.value = false;
      newName.value = "";
    }
  }, [open]);
  const n = name.value.trim();
  const dupe = !!n && names.has(n.toLowerCase());
  return (
    <Sheet open={open} onClose={onClose} title="Add to catalogue">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Category
          </div>
          <div class="flex gap-2 flex-wrap">
            {cats.map((c) => (
              <Chip
                key={c.id}
                selected={chosen.value === c.id}
                leadingCheck={false}
                onClick={() => (chosen.value = c.id)}
              >
                {c.label}
              </Chip>
            ))}
            {!newOpen.value && (
              <Chip icon="plus" leadingCheck={false} onClick={() => (newOpen.value = true)}>
                New
              </Chip>
            )}
          </div>
          {newOpen.value && (
            <div class="flex gap-2 items-center mt-3">
              <input
                value={newName.value}
                onInput={(e) => (newName.value = e.currentTarget.value)}
                placeholder="New category name"
                class={fieldClass}
              />
              <Button
                variant="filled"
                disabled={!newName.value.trim()}
                onClick={async () => {
                  const created = await onCreateCategory(newName.value.trim());
                  if (created) chosen.value = created.id;
                  newOpen.value = false;
                  newName.value = "";
                }}
              >
                Create
              </Button>
            </div>
          )}
        </div>
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Item
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={name.value}
              onInput={(e) => (name.value = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && n && !dupe) {
                  onAdd(n, chosen.value);
                  added.value = [n, ...added.value].slice(0, 12);
                  name.value = "";
                }
              }}
              placeholder="Item name"
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!n || dupe}
              onClick={() => {
                onAdd(n, chosen.value);
                added.value = [n, ...added.value].slice(0, 12);
                name.value = "";
              }}
            >
              Add
            </Button>
          </div>
          <div class={`md-body-small mt-2 ${dupe ? "text-error" : "text-on-surface-variant"}`}>
            {dupe ? `“${n}” is already in your catalogue` : "Press enter to add and keep going"}
          </div>
        </div>
        {added.value.length > 0 && (
          <div>
            <div class="md-label-medium uppercase text-on-surface-variant mb-2">
              Added just now · {added.value.length}
            </div>
            <div class="flex flex-wrap gap-2">
              {added.value.map((a, i) => (
                <span
                  key={i}
                  class="inline-flex items-center gap-1.5 md-label-large bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-full)] px-3 py-1.5"
                >
                  <Icon name="check" size={14} stroke={2.5} /> {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ── Category picker: pick, create, or jump to aisle order ── */
function CategoryPicker(
  { cats, counts, selected, onPick, onNew }: {
    cats: CategoryInterface[];
    counts: (id: string) => number;
    selected: string;
    onPick: (id: string) => void;
    onNew: (label: string) => void;
  },
) {
  const newOpen = useSignal(false);
  const newName = useSignal("");
  return (
    <div class="flex flex-col gap-1">
      <Pressable
        onClick={() => (newOpen.value = true)}
        color="var(--md-primary)"
        class="flex items-center gap-2.5 w-full text-left border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3 text-primary md-label-large mb-1"
      >
        <Icon name="plus" size={20} stroke={2.3} /> New category
      </Pressable>
      {newOpen.value && (
        <div class="flex gap-2 items-center mb-2">
          <input
            value={newName.value}
            onInput={(e) => (newName.value = e.currentTarget.value)}
            placeholder="New category name"
            class={fieldClass}
          />
          <Button
            variant="filled"
            disabled={!newName.value.trim()}
            onClick={() => {
              onNew(newName.value.trim());
              newOpen.value = false;
              newName.value = "";
            }}
          >
            Create
          </Button>
        </div>
      )}
      <a
        href="/shopping/categories"
        class="md-press flex items-center gap-2.5 w-full text-left rounded-[var(--md-shape-md)] px-4 py-3 text-on-surface md-label-large"
      >
        <span class="md-state" />
        <Icon name="swap" size={20} /> Aisle order
      </a>
      <div class="max-h-[360px] overflow-y-auto -mx-1 mt-1">
        {cats.map((c) => (
          <ListItem
            key={c.id}
            onClick={() => onPick(c.id)}
            headline={c.label}
            supporting={`${counts(c.id)} item${counts(c.id) === 1 ? "" : "s"}`}
            trailing={c.id === selected
              ? <Icon name="check" size={20} stroke={2.4} class="text-primary" />
              : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Rename / delete a category ── */
function CategoryMenuSheet(
  { category, itemCount, onClose, onRename, onDelete }: {
    category: CategoryInterface | null;
    itemCount: number;
    onClose: () => void;
    onRename: (label: string) => void;
    onDelete: () => void;
  },
) {
  const label = useSignal(category?.label ?? "");
  useEffect(() => {
    label.value = category?.label ?? "";
  }, [category?.id]);
  const v = label.value.trim();
  return (
    <Sheet open={category !== null} onClose={onClose} title="Category">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Name
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={label.value}
              onInput={(e) => (label.value = e.currentTarget.value)}
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!v || v === category?.label}
              onClick={() => onRename(v)}
            >
              Save
            </Button>
          </div>
        </div>
        <Button variant="error" icon="trash" onClick={onDelete}>
          Delete category{itemCount > 0
            ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"} become uncategorized`
            : ""}
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test islands/catalogue.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Format, lint, type-check, commit**

```bash
deno fmt islands/catalogue.tsx islands/catalogue.test.tsx
deno lint islands/catalogue.tsx islands/catalogue.test.tsx
deno check islands/catalogue.tsx islands/catalogue.test.tsx
git add islands/catalogue.tsx islands/catalogue.test.tsx
git commit -m "feat(catalogue): MD3 catalogue island (browse, search, item + category sheets)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Route wiring — `/shopping/catalogue` + segmented navigation

**Files:**
- Modify: `routes/shopping/catalogue/index.tsx` (render the new island)
- Modify: `islands/shopping-lists.tsx` (segmented navigates instead of toggling; drop the ComingSoon catalogue branch)

**Interfaces:**
- Consumes: `Catalogue` island (Task 2); `ItemRepo.readAll()`, `CategoryRepo.getAll()`, `page`, `define`.
- Produces: a working `/shopping/catalogue` route; `/shopping` segmented links to it.

- [ ] **Step 1: Replace `routes/shopping/catalogue/index.tsx`**

```tsx
import { page } from "fresh";
import { CategoryRepo, ItemRepo } from "@/database/index.ts";
import Catalogue from "@/islands/catalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(_ctx) {
    const [items, categories] = await Promise.all([
      ItemRepo.readAll(),
      CategoryRepo.getAll(),
    ]);
    return page({ items, categories });
  },
});

export default define.page<typeof handler>(function CataloguePage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <Catalogue initialItems={data.items} initialCategories={data.categories} />
    </main>
  );
});
```

- [ ] **Step 2: Update the segmented in `islands/shopping-lists.tsx`**

Remove the client-side catalogue tab: delete the `tab` signal, the `{tab.value === "catalogue" && <ComingSoon .../>}` block, and the `{tab.value === "lists" && (` wrapper (keep its inner lists markup, now unconditional). Delete the now-unused `ComingSoon` import. Change the `Segmented` to navigate:

```tsx
        <Segmented
          options={SEGMENTED_OPTIONS}
          value="lists"
          onChange={(k) => {
            if (k === "catalogue") globalThis.location.href = "/shopping/catalogue";
          }}
        />
```

The lists content (`lists.value.length === 0 ? (empty) : (cards)`) becomes the direct child of the outer `<div class="px-4 pb-[...] flex flex-col gap-3 pt-2">` (no `tab.value === "lists"` guard).

- [ ] **Step 3: Update the render test in `islands/shopping-lists.test.tsx`**

The existing test only asserts list content, which still renders — but confirm it still passes since `ComingSoon`/`tab` are gone.

Run: `deno test islands/shopping-lists.test.tsx`
Expected: PASS.

- [ ] **Step 4: Verify build + type-check**

```bash
deno check routes/shopping/catalogue/index.tsx islands/shopping-lists.tsx
deno task build
```
Expected: build ✓, check clean for these files.

- [ ] **Step 5: Format, lint, commit**

```bash
deno fmt routes/shopping/catalogue/index.tsx islands/shopping-lists.tsx
deno lint routes/shopping/catalogue/index.tsx islands/shopping-lists.tsx
git add routes/shopping/catalogue/index.tsx islands/shopping-lists.tsx
git commit -m "feat(catalogue): wire /shopping/catalogue route + segmented navigation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Category reorder screen (aisle order)

**Files:**
- Create: `islands/category-reorder.tsx`
- Test: `islands/category-reorder.test.tsx`
- Modify: `routes/shopping/categories/index.tsx`

**Interfaces:**
- Consumes: `api.categories.reorder`; md3 `IconButton`, `Icon`; `CategoryRepo.getAll()`, `page`, `define`.
- Produces: `export default function CategoryReorder({ initialCategories }: { initialCategories: CategoryInterface[] })`; a `/shopping/categories` detail route (back → `/shopping/catalogue`).

**Note (deviation from spec):** reorder is up/down buttons (parity with the old UI, reliable on mobile); drag-to-reorder is a deferred enhancement.

- [ ] **Step 1: Write the failing render test** — `islands/category-reorder.test.tsx`

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import CategoryReorder from "./category-reorder.tsx";

Deno.test("CategoryReorder — renders categories in aisle order with move controls", () => {
  const html = render(h(CategoryReorder, {
    initialCategories: [
      { id: "b", label: "Bakery", order: 1 },
      { id: "a", label: "Produce", order: 0 },
    ],
  }));
  // sorted by order → Produce (0) before Bakery (1)
  const produceAt = html.indexOf("Produce");
  const bakeryAt = html.indexOf("Bakery");
  assertStringIncludes(html, "Produce");
  assertStringIncludes(html, "Bakery");
  if (produceAt > bakeryAt) throw new Error("expected Produce before Bakery");
  assertStringIncludes(html, "Move up");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test islands/category-reorder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `islands/category-reorder.tsx`**

```tsx
import { useSignal } from "@preact/signals";
import type { CategoryInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Icon } from "@/components/md3/Icon.tsx";

interface Props {
  initialCategories: CategoryInterface[];
}

export default function CategoryReorder({ initialCategories }: Props) {
  const cats = useSignal<CategoryInterface[]>(
    [...initialCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  const move = async (index: number, dir: -1 | 1) => {
    const arr = [...cats.value];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[index];
    arr[index] = arr[j];
    arr[j] = tmp;
    const reindexed = arr.map((c, i) => ({ ...c, order: i }));
    cats.value = reindexed; // optimistic
    await api.categories.reorder(reindexed.map((c) => ({ id: c.id, order: c.order! })));
  };

  const list = cats.value;
  if (list.length === 0) {
    return (
      <div class="text-center py-12 md-body-medium text-on-surface-variant">
        No categories yet. Add one from the catalogue.
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-2">
      <p class="md-body-medium text-on-surface-variant mb-1">
        Order categories the way you walk the store — this sets the aisle order in
        Shop mode.
      </p>
      {list.map((c, i) => (
        <div
          key={c.id}
          class="flex items-center gap-2 bg-surface-clow rounded-[var(--md-shape-md)] px-4 py-2"
        >
          <span class="flex-1 min-w-0 truncate md-body-large text-on-surface">
            {c.label}
          </span>
          <IconButton
            name="chevron"
            iconSize={20}
            aria-label="Move up"
            style={{ transform: "rotate(-90deg)" }}
            onClick={() => move(i, -1)}
          />
          <IconButton
            name="chevron"
            iconSize={20}
            aria-label="Move down"
            style={{ transform: "rotate(90deg)" }}
            onClick={() => move(i, 1)}
          />
        </div>
      ))}
    </div>
  );
}
```

Note: if the base `chevron` icon does not point right, adjust the rotation so the buttons visibly point up/down.

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test islands/category-reorder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Replace `routes/shopping/categories/index.tsx`**

```tsx
import { page } from "fresh";
import { CategoryRepo } from "@/database/index.ts";
import CategoryReorder from "@/islands/category-reorder.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    ctx.state.appBar = {
      mode: "detail",
      title: "Aisle order",
      backUrl: "/shopping/catalogue",
    };
    const categories = await CategoryRepo.getAll();
    return page({ categories });
  },
});

export default define.page<typeof handler>(function CategoriesPage({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <CategoryReorder initialCategories={data.categories} />
    </main>
  );
});
```

- [ ] **Step 6: Format, lint, type-check, commit**

```bash
deno fmt islands/category-reorder.tsx islands/category-reorder.test.tsx routes/shopping/categories/index.tsx
deno lint islands/category-reorder.tsx islands/category-reorder.test.tsx routes/shopping/categories/index.tsx
deno check islands/category-reorder.tsx islands/category-reorder.test.tsx routes/shopping/categories/index.tsx
git add islands/category-reorder.tsx islands/category-reorder.test.tsx routes/shopping/categories/index.tsx
git commit -m "feat(catalogue): MD3 aisle-order reorder screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Delete the old UI + orphaned helpers (clears the 7 type errors)

**Files (delete):** `islands/item-catalog.tsx`, `islands/category-management.tsx`, `components/list.tsx`, `components/Button.tsx`, `hooks/useCollection.ts`, `hooks/useCategoryManagement.ts`, `routes/shopping/catalogue/new.tsx`, `routes/shopping/catalogue/overview.tsx`, `routes/shopping/catalogue/[id]/index.tsx`, `routes/shopping/catalogue/[id]/edit.tsx`
**Files (modify):** `hooks/index.ts` (drop the `useCategoryManagement` re-export)

- [ ] **Step 1: Find any tests bound to the doomed modules**

```bash
grep -rlnE "item-catalog|category-management|components/list|components/Button|useCollection|useCategoryManagement" \
  --include='*.test.ts' --include='*.test.tsx' --include='*_test.ts' . | grep -v "/docs/"
```
Delete any files this lists (e.g. `git rm <path>`).

- [ ] **Step 2: Delete the old source files**

```bash
git rm islands/item-catalog.tsx islands/category-management.tsx \
  components/list.tsx components/Button.tsx \
  hooks/useCollection.ts hooks/useCategoryManagement.ts \
  routes/shopping/catalogue/new.tsx routes/shopping/catalogue/overview.tsx \
  "routes/shopping/catalogue/[id]/index.tsx" "routes/shopping/catalogue/[id]/edit.tsx"
```
Then remove the now-empty directory if git left it: `rmdir "routes/shopping/catalogue/[id]" 2>/dev/null || true`.

- [ ] **Step 3: Drop the `useCategoryManagement` re-export from `hooks/index.ts`**

Open `hooks/index.ts` and delete the line `export * from "./useCategoryManagement.ts";`. (Leave the other exports.) Verify nothing else imports the deleted hooks: `grep -rnE "useCollection|useCategoryManagement" --include='*.ts' --include='*.tsx' . | grep -v "/docs/"` should return nothing.

- [ ] **Step 4: Whole-project type-check must now be GREEN**

Run: `deno task check`
Expected: PASS with **no errors** (the 7 pre-existing WIP errors are gone). If any error remains, it names a file that still imports a deleted module — fix that import.

- [ ] **Step 5: Full test suite + build**

```bash
deno test
deno task build
```
Expected: all tests pass; build ✓.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(catalogue): remove old catalogue/categories UI and orphaned helpers

Deletes item-catalog/category-management islands, legacy catalogue routes,
and the now-unused list/Button components + useCollection/useCategoryManagement
hooks. Clears the 7 pre-existing deno task check type errors.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Live QA + final gates

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and log in**

Use the preview tooling; log in with `admin` / `admin`. If port 5173 has an orphaned process: `lsof -ti:5173 | xargs kill -9` before starting.

- [ ] **Step 2: Catalogue walkthrough**

- `/shopping` → tap the **Catalogue** segment → lands on `/shopping/catalogue`; tap **Lists** → back to `/shopping`.
- Category rail selects one category at a time (alphabetical order); "Uncategorized" chip appears only when such items exist.
- Add an item via the ghost tile (rapid-fire Enter); duplicate name shows the inline error.
- Tap an item → rename, move category, remove — each reflects immediately.
- Category "All" (tune) → picker: create a new category, jump to "Aisle order".
- Category header ⋮ → rename / delete (delete shows the "N items become uncategorized" note).
- Search → matches grouped under alphabetical headers; clear resets to browse.

- [ ] **Step 3: Reorder + aisle-order verification**

- `/shopping/categories`: move a category up/down; reload → order persists.
- Open a list in **Shop mode** → item groups follow the new aisle order (confirms the reorder feeds Shop-mode grouping and nothing in the list detail broke).

- [ ] **Step 4: Responsive + console**

Check mobile (375px) and desktop widths; confirm zero console errors on catalogue, reorder, and a list detail.

- [ ] **Step 5: Final gate + capture proof**

```bash
deno task check && deno test && deno task build && deno fmt --check && deno lint
```
Expected: all green. Capture a screenshot of the catalogue and reorder screens.

- [ ] **Step 6: No commit** (verification only). Report results and any follow-ups.

---

## Self-Review (completed during authoring)

- **Spec coverage:** Catalogue browse/search/grid + 3 sheets → Task 2; alphabetical selection + aisle-order split → hook (Task 1) + reorder screen (Task 4); route-per-tab + segmented nav → Task 3; reorder → Task 4; cleanup + 7-error resolution → Task 5; `useCatalogue`/no-backend-change → Task 1; testing + QA → all tasks + Task 6. No gaps.
- **Deviations from spec (intentional, noted):** (1) reorder access lives in the category picker sheet, not the top app bar (section-mode screens have no trailing slot in `AppChrome`); (2) reorder uses up/down buttons (parity with old UI), drag deferred.
- **Type consistency:** hook method names (`addItem/renameItem/moveItem/removeItem/createCategory/renameCategory/deleteCategory/itemsForCategory/sortedCategories/itemNames/hasUncategorized`) are identical across Task 1's definition and Task 2's usage; `api.categories.{create,update,reorder,delete}` signatures match between Task 1 Step 1 and their callers; `page`/`define` import sites match the verified route pattern.
- **Placeholders:** none.
