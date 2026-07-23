# Add-Items FAB + Full-Screen Search Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the list page's dummy-search-and-sheet with an "Add items" FAB
that opens a dedicated full-screen search page, and make that page a fast
search → add → tweak (quantity/note) loop with a pinned "Added (N)" section.

**Architecture:** A new shell app-bar mode `{ mode: "none" }` lets a route own
the whole viewport (no top bar, no bottom nav). The add-items island renders its
own sticky MD3 search bar and drives all adds/edits through the existing
`useShoppingList` hook. No new data model or API.

**Tech Stack:** Deno + Fresh 2 (SSR + islands) + Preact + `@preact/signals` +
Deno KV + Tailwind v4. MD3 components in `components/md3/*`.

**Spec:** `docs/superpowers/specs/2026-07-19-add-items-fab-search-flow-design.md`

## Global Constraints

- **No data-model or API changes.** Reuse existing repos, `services/api.ts`, and
  `hooks/useShoppingList.ts` / `hooks/useSearchBox.ts`. No new endpoints, no KV
  schema edits.
- **Preact JSX:** `class` not `className`. Imports use the `@/` alias.
- **Signals in islands:** local state via `useSignal()`; the `signal()`-based
  `useShoppingList` is instantiated once via `useMemo(() => useHook(...), [])`;
  never call `signal()` in a component body; re-render-driving `.value` reads
  stay at the top level of the component body.
- **Icons:** only names from the `IconName` union in `components/md3/Icon.tsx`
  (this feature uses `back`, `search`, `x`, `check`, `chevron`, `plus` — all
  already present; no new icons).
- **Query param:** read as `ctx.url.searchParams.get("q") ?? ""`.
- **Commits:** Conventional Commits; end every commit message with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Gates green before each commit:** `deno task check` (fmt + lint + type),
  `deno test`, `deno task build`. LSP errors for `@/`, `jsr:`, `npm:`, `Deno`,
  or JSX are false positives — the authority is `deno task check`.
- **Never** commit `.DS_Store`, `deno.lock` churn (revert with
  `git checkout deno.lock` if it changes), or anything under `docs/happie/`.

---

## File Structure

**Modified**
- `utils/define.ts` — add `AppBarNone` + `AppBar` union; `StateInterface.appBar`
  becomes `AppBar`.
- `routes/_app.tsx` — pass the `AppBar` union straight to `AppChrome`.
- `islands/shell/AppChrome.tsx` — render no chrome for `mode: "none"`.
- `routes/shopping/[id]/add.tsx` — `appBar: { mode: "none" }`; drop `p-4`.
- `components/md3/CatalogueAddRow.tsx` — added-state (inline `Stepper`,
  tap-to-edit, optional remove).
- `islands/add-items.tsx` — full rewrite: sticky search bar, clean search-first
  idle, results with add/added rows, compact editor sheet, "Added (N)" section.
- `islands/items.tsx` — remove `SearchBar` + quick-add sheet + machinery; add
  the FAB (Plan mode); empty-state copy.

**New**
- `islands/shell/AppChrome.test.tsx` — covers `mode: "none"` vs `mode: "detail"`.

**Tests updated**
- `components/md3/CatalogueAddRow.test.tsx`, `islands/add-items.test.tsx`,
  `islands/items.test.tsx`.

**Reused unchanged**
- `islands/shell/Fab.tsx`, `hooks/useShoppingList.ts`, `hooks/useSearchBox.ts`,
  `components/md3/{Sheet,Stepper,CategoryPickerList,ListItem,Icon,Pressable,Button}.tsx`.

## Pre-Flight Notes (read before Task 1)

- `useShoppingList` returns (this feature uses): `addToList(itemId) →
  Promise<listItemId|null>`, `addToCatalog(name, categoryId?) →
  Promise<listItemId|null>` (creates the catalogue item **and** adds it),
  `updateListItem(listItemId, patch)`, `flushListItem(listItemId)`,
  `removeListItem(listItemId)`, `getItemName(itemId)`, `listItemsMap` (computed
  `Map<itemId, listItem>`), `list`, `categories`, `items`, `selectedCategoryId`.
- **Both adders return the LIST-ITEM id.** The "Added (N)" section is therefore
  keyed by list-item id, and results-row added-state is derived from
  `listItemsMap.value.get(itemId)`.
- `Stepper` calls `e.stopPropagation()` on its buttons, so it can sit inside a
  tap-to-edit row without triggering the row's tap.
- Tests: `import { assert, assertEquals, assertStringIncludes } from
  "jsr:@std/assert@^1.0.19";`, `import { render } from
  "npm:preact-render-to-string@^6.6.3";`, `import { h } from "preact";`, render
  via `render(h(Component, props))`. `preact-render-to-string` HTML-escapes `"`
  in JSX text (`Create "{q}"` serializes as `Create &quot;Tofu&quot;`).

---

## Task 1: Shell `mode: "none"` — full-screen route surface

**Files:**
- Modify: `utils/define.ts`
- Modify: `routes/_app.tsx`
- Modify: `islands/shell/AppChrome.tsx`
- Create: `islands/shell/AppChrome.test.tsx`

**Interfaces:**
- Produces: `AppBar = AppBarDetail | AppBarNone` (`utils/define.ts`);
  `AppBarNone = { mode: "none" }`. Consumed by Task 4's `add.tsx`.
- This task does **not** touch any route's runtime behavior yet (no route sets
  `mode: "none"` until Task 4) — existing detail/section bars are unchanged.

- [ ] **Step 1: Write the failing test** — `islands/shell/AppChrome.test.tsx`

```tsx
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AppChrome from "./AppChrome.tsx";

Deno.test("AppChrome — mode:none renders no chrome (full-screen route)", () => {
  const html = render(
    h(AppChrome, { appBar: { mode: "none" }, sectionTitle: "Shopping" }),
  );
  assertEquals(html, "");
});

Deno.test("AppChrome — mode:detail renders a back + title bar", () => {
  const html = render(
    h(AppChrome, {
      appBar: { mode: "detail", title: "Add items", backUrl: "/shopping/l1" },
      sectionTitle: "Shopping",
    }),
  );
  assertStringIncludes(html, "Add items");
  assertStringIncludes(html, "/shopping/l1");
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `deno test islands/shell/AppChrome.test.tsx`
Expected: FAIL — `AppChrome` doesn't yet accept `appBar: { mode: "none" }`
(type error / non-empty output for the none case).

- [ ] **Step 3: Extend the app-bar type** — `utils/define.ts`

Replace the `AppBarDetail`/`StateInterface` block with:

```ts
export interface AppBarDetail {
  mode: "detail";
  title: string;
  backUrl: string;
}

/** The route owns the whole viewport — the shell renders no top bar and no
 *  bottom navigation (e.g. the full-screen add-items search). */
export interface AppBarNone {
  mode: "none";
}

export type AppBar = AppBarDetail | AppBarNone;

export interface StateInterface {
  userId?: string;
  householdId?: string;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
  appBar?: AppBar;
}
```

- [ ] **Step 4: Pass the union through** — `routes/_app.tsx`

Change the `AppChrome` invocation so it forwards the whole union instead of the
flattened `{ title, backUrl }`:

```tsx
{state?.userId && (
  <AppChrome
    activeId={activeTab?.id}
    appBar={state.appBar}
    sectionTitle={activeTab?.label ?? "Happie"}
  />
)}
```

- [ ] **Step 5: Handle `mode: "none"`** — `islands/shell/AppChrome.tsx`

Replace the file with:

```tsx
import { useSignal } from "@preact/signals";
import TopAppBar from "./TopAppBar.tsx";
import NavigationBar from "./NavigationBar.tsx";
import MoreSheet from "./MoreSheet.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";
import { appBarAction } from "@/utils/app-bar.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";
import type { AppBar } from "@/utils/define.ts";

interface AppChromeProps {
  activeId?: string;
  appBar?: AppBar;
  sectionTitle: string;
}

export default function AppChrome(
  { activeId, appBar, sectionTitle }: AppChromeProps,
) {
  const moreOpen = useSignal(false);

  // Full-screen routes (e.g. the add-items search) own the whole viewport:
  // no top bar and no bottom navigation.
  if (appBar?.mode === "none") return null;

  const detail = appBar?.mode === "detail" ? appBar : null;

  return (
    <>
      {detail
        ? (
          <TopAppBar
            title={detail.title}
            backUrl={detail.backUrl}
            trailing={appBarAction.value
              ? (
                <IconButton
                  name={appBarAction.value.icon}
                  aria-label={appBarAction.value.label}
                  onClick={appBarAction.value.onClick}
                />
              )
              : undefined}
          />
        )
        : <TopAppBar title={sectionTitle} />}
      <NavigationBar
        items={NAV_CONFIG}
        activeId={activeId}
        onMore={() => moreOpen.value = true}
      />
      <MoreSheet
        open={moreOpen.value}
        onClose={() => moreOpen.value = false}
      />
    </>
  );
}
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `deno test islands/shell/AppChrome.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 7: Gates**

Run: `deno task check && deno test && deno task build`
Expected: all green. If `deno.lock` changed, `git checkout deno.lock`.

- [ ] **Step 8: Commit**

```bash
git add utils/define.ts routes/_app.tsx islands/shell/AppChrome.tsx islands/shell/AppChrome.test.tsx
git commit -m "feat(shell): add mode:none app-bar for full-screen routes" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `CatalogueAddRow` added-state (inline stepper + tap-to-edit)

**Files:**
- Modify: `components/md3/CatalogueAddRow.tsx`
- Modify: `components/md3/CatalogueAddRow.test.tsx`

**Interfaces:**
- Produces: `CatalogueAddRow` props
  `{ name, categoryLabel?, added, onAdd, quantity?, onQtyChange?, onEdit?,
  onRemove? }`. Consumed by Task 4's `add-items.tsx`.
- Un-added → whole row calls `onAdd`, trailing `+`. Added → row calls `onEdit`,
  trailing = inline `Stepper` (+ optional remove control when `onRemove` is
  given). Falls back to a static "✓ Added" if `quantity`/`onQtyChange` are
  absent.

- [ ] **Step 1: Update the tests** — `components/md3/CatalogueAddRow.test.tsx`

Replace the file with:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { CatalogueAddRow } from "./CatalogueAddRow.tsx";

Deno.test("CatalogueAddRow — un-added: name, category, Add affordance", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Butter",
    categoryLabel: "Dairy",
    added: false,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Butter");
  assertStringIncludes(html, "Dairy");
  assert(!html.includes("Decrease quantity")); // no stepper when un-added
});

Deno.test("CatalogueAddRow — added: inline quantity stepper", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Bread",
    added: true,
    onAdd: () => {},
    quantity: 2,
    onQtyChange: () => {},
    onEdit: () => {},
  }));
  assertStringIncludes(html, "Bread");
  assertStringIncludes(html, "Decrease quantity"); // Stepper present
  assertStringIncludes(html, "Increase quantity");
});

Deno.test("CatalogueAddRow — added with onRemove shows a remove control", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Milk",
    added: true,
    onAdd: () => {},
    quantity: 1,
    onQtyChange: () => {},
    onEdit: () => {},
    onRemove: () => {},
  }));
  assertStringIncludes(html, "Remove Milk");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `deno test components/md3/CatalogueAddRow.test.tsx`
Expected: FAIL (added-state has no stepper / no remove control yet).

- [ ] **Step 3: Implement** — replace `components/md3/CatalogueAddRow.tsx`

```tsx
import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface CatalogueAddRowProps {
  name: string;
  categoryLabel?: string;
  added: boolean;
  onAdd: () => void;
  /** When added: inline quantity + tap-to-edit affordances. */
  quantity?: number;
  onQtyChange?: (v: number) => void;
  onEdit?: () => void;
  /** Added-section variant only: a remove-from-list control. */
  onRemove?: () => void;
}

/**
 * A catalogue item row on the full-screen add page. Un-added: the whole row
 * adds the item (optimistic). Added: the row is tappable to edit (note/qty) and
 * carries an inline quantity stepper; the Added-section variant also shows a
 * remove control. The Stepper stops event propagation, so stepping never
 * triggers the row's edit tap.
 */
export function CatalogueAddRow(
  {
    name,
    categoryLabel,
    added,
    onAdd,
    quantity,
    onQtyChange,
    onEdit,
    onRemove,
  }: CatalogueAddRowProps,
) {
  if (!added) {
    return (
      <ListItem
        headline={name}
        supporting={categoryLabel ?? ""}
        onClick={onAdd}
        trailing={
          <span class="text-primary">
            <Icon name="plus" size={22} />
          </span>
        }
      />
    );
  }

  const canStep = quantity != null && !!onQtyChange;
  return (
    <ListItem
      headline={name}
      supporting={categoryLabel ?? ""}
      onClick={onEdit}
      trailing={
        <div class="flex items-center gap-1.5">
          {onRemove && (
            <Pressable
              onClick={onRemove}
              stop
              aria-label={`Remove ${name}`}
              class="w-8 h-8 grid place-items-center rounded-full text-on-surface-variant"
            >
              <Icon name="x" size={18} />
            </Pressable>
          )}
          {canStep
            ? <Stepper value={quantity!} onChange={onQtyChange!} />
            : (
              <span class="inline-flex items-center gap-1 text-primary md-label-medium">
                <Icon name="check" size={18} /> Added
              </span>
            )}
        </div>
      }
    />
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `deno test components/md3/CatalogueAddRow.test.tsx`
Expected: PASS (all three).

- [ ] **Step 5: Gates**

Run: `deno task check && deno test && deno task build`
Expected: green. `git checkout deno.lock` if it churned.

- [ ] **Step 6: Commit**

```bash
git add components/md3/CatalogueAddRow.tsx components/md3/CatalogueAddRow.test.tsx
git commit -m "feat(md3): CatalogueAddRow added-state with inline stepper + tap-to-edit" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: List page — "Add items" FAB, retire the quick-add sheet

**Files:**
- Modify: `islands/items.tsx`
- Modify: `islands/items.test.tsx`

**Interfaces:**
- Consumes: `islands/shell/Fab.tsx` (`{ icon?, label?, onClick, "aria-label" }`).
- The FAB navigates to `/shopping/${listId}/add` (the page reworked in Task 4).
  The item-editor and list-options sheets are untouched.

- [ ] **Step 1: Update the tests** — `islands/items.test.tsx`

Replace the file with:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

const base = {
  listId: "l1",
  listName: "Test list",
  items: [],
  shoppingList: [],
  categories: [],
};

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});

Deno.test("Items — Plan mode shows the Add items FAB, no quick-add sheet", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Add items"); // FAB label
  assert(!html.includes("Search your catalogue")); // old quick-add sheet gone
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `deno test islands/items.test.tsx`
Expected: FAIL — the current island still renders the quick-add sheet
("Search your catalogue") and no FAB.

- [ ] **Step 3: Edit imports** — `islands/items.tsx`

- Change the hooks import to drop `useSearchBox`:
  ```tsx
  import { useShoppingList } from "@/hooks/index.ts";
  ```
- **Remove** these two import lines:
  ```tsx
  import { SearchBar } from "@/components/md3/SearchBar.tsx";
  import { CatalogueAddRow } from "@/components/md3/CatalogueAddRow.tsx";
  ```
- **Add** (next to the other island imports):
  ```tsx
  import Fab from "@/islands/shell/Fab.tsx";
  ```

- [ ] **Step 4: Trim the hook destructure**

In the `useMemo(() => useShoppingList(...))` destructure, **remove** `addToList,`
and `listItemsMap,`. Keep everything else (`items`, `categories`, `getItemName`
are still used by the item-editor sheet).

- [ ] **Step 5: Delete the quick-add machinery**

Remove all of the following from the component body:
- `const addOpen = useSignal(false);`
- the search/filter block:
  ```tsx
  const filterFn = (searchString: string, item: ItemInterface) => { ... };
  const { query, results, inputRef, reset } = useSearchBox(catalog, filterFn);
  ```
- the autofocus `useEffect` that focuses `inputRef` when `addOpen.value` changes.
- `const handleAddToList = async (itemId: string) => { ... };`
- `const openAddPage = (q?: string) => { ... };`
- the `<SearchBar placeholder="Add item or search catalogue…" ... />` block at
  the top of Plan mode.
- the **entire** quick-add `<Sheet open={addOpen.value} ... title="Add items"
  size={...}> ... </Sheet>` block (the one containing the "Full screen"
  handoff, the search input, and the "Create …" pressable).

- [ ] **Step 6: Update the empty-state copy**

Change the Plan-mode empty message from:
```tsx
Tap the search bar to add items.
```
to:
```tsx
Tap Add items to get started.
```

- [ ] **Step 7: Add the FAB (Plan mode only)**

Immediately before the closing Snackbar (`<Snackbar data={snackData.value} />`),
add:

```tsx
{/* FAB — opens the full-screen add page (Plan mode only) */}
{mode.value === "plan" && (
  <div
    class="fixed right-4 z-30"
    style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
  >
    <Fab
      icon="plus"
      label="Add items"
      aria-label="Add items"
      onClick={() => {
        globalThis.location.href = `/shopping/${listId}/add`;
      }}
    />
  </div>
)}
```

- [ ] **Step 8: Run — expect PASS**

Run: `deno test islands/items.test.tsx`
Expected: PASS.

- [ ] **Step 9: Gates**

Run: `deno task check && deno test && deno task build`
Expected: green (in particular, no "unused variable"/"unused import" lint errors
— that confirms every removed symbol was fully cleaned up). `git checkout
deno.lock` if it churned.

- [ ] **Step 10: Commit**

```bash
git add islands/items.tsx islands/items.test.tsx
git commit -m "feat(shopping): replace list quick-add sheet with an Add items FAB" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Add page — full-screen search + tweak + "Added (N)" section

**Files:**
- Modify: `routes/shopping/[id]/add.tsx`
- Modify: `islands/add-items.tsx` (full rewrite)
- Modify: `islands/add-items.test.tsx`

**Interfaces:**
- Consumes: `AppBar` union / `{ mode: "none" }` (Task 1); `CatalogueAddRow`
  added-state props (Task 2); `useShoppingList` (see Pre-Flight Notes),
  `useSearchBox(catalog, filterFn, initialQuery)`, `Sheet`, `Stepper`,
  `CategoryPickerList`, `Button`, `Pressable`, `Icon`.

- [ ] **Step 1: Update the tests** — `islands/add-items.test.tsx`

Replace the file with:

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

Deno.test("AddItems — idle: search-first hint, no chips, no rows", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, "Search your catalogue"); // idle hint
  assertStringIncludes(html, "Adding to Groceries"); // context line
  assert(!html.includes("Butter")); // no catalogue rows when idle
  assert(!html.includes("Bakery")); // category chips are gone
});

Deno.test("AddItems — a back link to the list is always present", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, `href="/shopping/l1"`);
});

Deno.test("AddItems — a matching query lists the catalogue item", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "But" }));
  assertStringIncludes(html, "Butter");
});

Deno.test("AddItems — a no-match query shows the Create card", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "Tofu" }));
  // preact-render-to-string HTML-escapes the literal quotes in Create "{q}".
  assertStringIncludes(html, "Create &quot;Tofu&quot;");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `deno test islands/add-items.test.tsx`
Expected: FAIL — the current island renders chips (so "Bakery" appears when
idle) and no back link / no "Search your catalogue" hint.

- [ ] **Step 3: Turn the route into a full-screen surface** — `routes/shopping/[id]/add.tsx`

Change the app-bar assignment and drop the `p-4`:

```tsx
    // Full-screen search surface: the island owns the top bar and there is no
    // bottom nav. The shell renders no chrome for mode:"none".
    ctx.state.appBar = { mode: "none" };
```

```tsx
export default define.page<typeof handler>(function AddItemsPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
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

- [ ] **Step 4: Rewrite the island** — replace `islands/add-items.tsx`

```tsx
import { useEffect, useMemo } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import { For } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
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
    updateListItem,
    flushListItem,
    removeListItem,
    getItemName,
    listItemsMap,
    list,
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

  // List-item ids added during this visit — the "Added (N)" building cart.
  const addedThisVisit = useSignal<string[]>([]);
  // Create-flow category picker sub-screen.
  const catPicking = useSignal(false);
  // Compact editor sheet — holds the list-item id being edited (qty + note).
  const editingId = useSignal<string | null>(null);
  // "Added (N)" section collapse state (collapsed by default).
  const addedOpen = useSignal(false);

  // Autofocus the search field on mount for a quick type-to-search flow.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const trackAdded = (liId: string | null) => {
    if (liId) addedThisVisit.value = [...addedThisVisit.value, liId];
  };

  const handleAdd = async (itemId: string) => {
    trackAdded(await addToList(itemId));
  };

  const handleCreate = async (name: string) => {
    trackAdded(await addToCatalog(name, selectedCategoryId.value || undefined));
    selectedCategoryId.value = "";
    query.value = "";
    inputRef.current?.focus();
  };

  const handleRemove = async (liId: string) => {
    addedThisVisit.value = addedThisVisit.value.filter((id) => id !== liId);
    if (editingId.value === liId) editingId.value = null;
    await removeListItem(liId);
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushListItem(id);
    editingId.value = null;
  };

  const q = query.value.trim();
  const selectedCatLabel =
    categories.value.find((c) => c.id === selectedCategoryId.value)?.label ??
      "Uncategorized";

  // Memoized so each row does a Map lookup, not an O(n) find over categories.
  const catLabelById = useComputed(() =>
    new Map(categories.value.map((c) => [c.id, c.label ?? ""]))
  );

  // Render a catalogue item as a row: un-added → Add; added → inline stepper +
  // tap-to-edit. `withRemove` adds a remove control (Added section only).
  const catalogueRow = (item: ItemInterface, withRemove: boolean) => {
    const li = listItemsMap.value.get(item.id ?? "");
    return (
      <CatalogueAddRow
        key={item.id}
        name={item.name ?? ""}
        categoryLabel={catLabelById.value.get(item.categoryId ?? "") ?? ""}
        added={!!li}
        onAdd={() => {
          if (item.id) handleAdd(item.id);
        }}
        quantity={li?.quantity ?? 1}
        onQtyChange={(v) => {
          if (li?.id) updateListItem(li.id, { quantity: v });
        }}
        onEdit={() => {
          if (li?.id) editingId.value = li.id;
        }}
        onRemove={withRemove && li?.id ? () => handleRemove(li.id!) : undefined}
      />
    );
  };

  // ── Create-flow category picker sub-screen (replaces the body) ──────────
  if (catPicking.value) {
    return (
      <div class="flex flex-col">
        <header
          class="bg-surface sticky top-0 z-20"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
            <Pressable
              onClick={() => (catPicking.value = false)}
              aria-label="Back to search"
              class="grid place-items-center text-on-surface-variant rounded-full shrink-0"
              style={{ width: 40, height: 40 }}
            >
              <Icon name="back" size={22} />
            </Pressable>
            <div class="md-title-large text-on-surface">Choose category</div>
          </div>
        </header>
        <div class="px-4 pt-1 pb-28">
          <CategoryPickerList
            categories={categories.value}
            selectedId={selectedCategoryId.value}
            onSelect={(id) => {
              selectedCategoryId.value = id;
              catPicking.value = false;
            }}
          />
        </div>
      </div>
    );
  }

  // ── "Added (N)" building-cart rows (newest first) ───────────────────────
  const addedRows = addedThisVisit.value
    .map((liId) => list.value.find((li) => li.id === liId))
    .filter((li): li is ShoppingListItemInterface => !!li)
    .reverse();

  const editingLi = editingId.value
    ? list.value.find((li) => li.id === editingId.value) ?? null
    : null;

  return (
    <div class="flex flex-col">
      {/* Sticky search top bar — this island owns the top region */}
      <header
        class="bg-surface sticky top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
          <a
            href={`/shopping/${listId}`}
            aria-label="Back"
            class="md-press grid place-items-center text-on-surface-variant rounded-full shrink-0"
            style={{ width: 40, height: 40 }}
          >
            <span class="md-state" />
            <Icon name="back" size={22} />
          </a>
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <Icon name="search" size={20} />
            </span>
            <input
              ref={inputRef}
              value={query.value}
              onInput={(e) => {
                query.value = (e.target as HTMLInputElement).value;
              }}
              placeholder="Search or add an item…"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-2.5 pl-10 pr-10 outline-none"
            />
            {q && (
              <Pressable
                onClick={() => {
                  query.value = "";
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                class="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center text-on-surface-variant rounded-full"
                style={{ width: 32, height: 32 }}
              >
                <Icon name="x" size={18} />
              </Pressable>
            )}
          </div>
        </div>
      </header>

      <div class="px-4 pt-2 pb-28 flex flex-col gap-2">
        {/* Context line */}
        <div class="md-label-medium text-on-surface-variant px-1">
          Adding to {listName}
        </div>

        {/* Added (N) — the building cart, collapsed by default */}
        {addedRows.length > 0 && (
          <div class="rounded-[var(--md-shape-lg)] bg-surface-chigh overflow-hidden">
            <Pressable
              as="div"
              onClick={() => (addedOpen.value = !addedOpen.value)}
              class="flex items-center gap-2 px-4 py-3"
            >
              <Icon name="check" size={18} class="text-primary" />
              <span class="md-title-small text-on-surface flex-1">
                Added · {addedRows.length}
              </span>
              <span
                class="text-on-surface-variant"
                style={{
                  transform: addedOpen.value ? "rotate(90deg)" : "rotate(0)",
                  transition: "transform .15s",
                  display: "inline-flex",
                }}
              >
                <Icon name="chevron" size={18} />
              </span>
            </Pressable>
            {addedOpen.value && (
              <div class="flex flex-col pb-1">
                {addedRows.map((li) => {
                  const item = items.value.find((i) => i.id === li.itemId);
                  return item ? catalogueRow(item, true) : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Main content: idle hint, or create card + live results */}
        {q
          ? (() => {
            // Two intentional predicates: the create card gates on an EXACT
            // (case-insensitive) match, while `results` is useSearchBox's
            // SUBSTRING filter — both can legitimately show at once. Do not
            // unify these.
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
                      onClick={() => (catPicking.value = true)}
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
                  <For each={results}>{(item) => catalogueRow(item, false)}</For>
                </div>
              </>
            );
          })()
          : (
            <div class="flex flex-col items-center text-center gap-1 px-6 py-16 text-on-surface-variant">
              <Icon name="search" size={30} />
              <div class="md-body-large text-on-surface mt-2">
                Search your catalogue
              </div>
              <div class="md-body-medium opacity-80">
                Find an item to add, or create a new one.
              </div>
            </div>
          )}
      </div>

      {/* Compact editor sheet — quantity + note */}
      <Sheet
        open={editingId.value !== null}
        onClose={closeEditor}
        title={editingLi ? getItemName(editingLi.itemId) : ""}
      >
        {editingLi && (
          <div class="flex flex-col gap-1.5 pb-1">
            <div class="flex items-center justify-between px-1 py-1.5">
              <span class="md-body-large text-on-surface">Quantity</span>
              <Stepper
                value={editingLi.quantity ?? 1}
                onChange={(v) => updateListItem(editingLi.id!, { quantity: v })}
              />
            </div>
            <div class="h-px bg-surface-chigh mx-1" />
            <div class="px-1 py-1.5">
              <div class="md-body-large text-on-surface mb-2">Note</div>
              <textarea
                value={editingLi.note ?? ""}
                onInput={(e) =>
                  updateListItem(editingLi.id!, {
                    note: (e.target as HTMLTextAreaElement).value,
                  })}
                rows={2}
                placeholder="e.g. the red ones, big pack, any brand…"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
              />
            </div>
            <Button variant="filled" full onClick={closeEditor} class="mt-2.5">
              Done
            </Button>
            <Button
              variant="error"
              full
              onClick={() => handleRemove(editingLi.id!)}
              class="mt-2"
            >
              Remove from list
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `deno test islands/add-items.test.tsx`
Expected: PASS (all four).

- [ ] **Step 6: Gates**

Run: `deno task check && deno test && deno task build`
Expected: green (whole suite). `git checkout deno.lock` if it churned.

- [ ] **Step 7: Commit**

```bash
git add routes/shopping/[id]/add.tsx islands/add-items.tsx islands/add-items.test.tsx
git commit -m "feat(shopping): full-screen search add page with inline tweak + Added cart" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Live QA + final gates

**Files:** none (verification only; small fixes committed if QA turns them up).

- [ ] **Step 1: Whole-suite gates**

Run: `deno task check && deno test && deno task build`
Expected: all green; test count increased (new AppChrome tests + reworked
CatalogueAddRow / add-items / items tests).

- [ ] **Step 2: Start the dev server and log in**

Start the dev server (via the preview tool / `deno task dev`), log in
`admin` / `admin`, open a seeded list at `/shopping/<id>`.

- [ ] **Step 3: Verify the flow (mobile viewport)**

Confirm, and capture a screenshot of the add page:
1. Plan mode shows the **"Add items" FAB** (bottom-right, above the nav); no
   search bar at the top of the list. Shop mode shows **no FAB**.
2. Tapping the FAB opens `/shopping/<id>/add` as a **full-screen search**: no
   shell top bar, **no bottom nav**, a sticky search bar (back arrow + input +
   clear), autofocused.
3. Idle shows the **"Search your catalogue"** hint — **no category chips**.
4. Typing lists matching items **below the bar**; tapping one **adds** it (row
   flips to a stepper); the **"Added · N"** header appears and increments.
5. The added row's **inline stepper** changes quantity; tapping the row opens
   the **editor sheet** (quantity + note); **Done** closes it; the note/qty
   persist.
6. Expanding **"Added · N"** lists this visit's items; **remove (×)** drops one
   and decrements N; N=0 hides the section.
7. A no-match query shows **Create "<q>"** → category picker → **Add** creates +
   adds + resets to idle, and the item appears in "Added".
8. **Back** returns to the list; added items appear grouped with the right
   quantities/notes.
9. `read_console_messages` / `preview_logs` show **no errors**; adds/edits fire
   successful requests (`read_network_requests`).

- [ ] **Step 4: Address any QA findings**

If QA surfaces a defect, fix the source, re-run the gates, and commit with a
`fix(...)` message (+ the co-author trailer). If QA is clean, no commit.

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch to push and open the PR (base
branch: `feat/fullscreen-add-items` while PR #26 is open; otherwise `develop`).
PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-Review (author checklist — done before handing off)

- **Spec coverage:** FAB entry (T3) ✓; retire quick-add sheet (T3) ✓;
  `mode: "none"` full-screen surface, no top bar + no bottom nav (T1 + T4) ✓;
  sticky island search bar (T4) ✓; clean search-first idle, no chips (T4) ✓;
  add → inline qty + tap-for-note editor sheet (T2 + T4) ✓; pinned "Added (N)"
  (T4) ✓; create-on-no-match kept (T4) ✓; no API/data changes ✓; tests (all
  tasks) ✓.
- **Placeholder scan:** every code step carries complete code or an exact edit;
  no TBD/TODO.
- **Type consistency:** `CatalogueAddRow` props defined in T2 are exactly those
  consumed by `catalogueRow` in T4; `AppBar`/`mode: "none"` defined in T1 is
  what `add.tsx` sets in T4; both adders return the list-item id, which is what
  `addedThisVisit` / `listItemsMap` / the editor all key on.
