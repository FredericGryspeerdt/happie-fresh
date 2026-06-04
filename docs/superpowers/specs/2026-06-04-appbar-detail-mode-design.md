# AppBar Detail Mode Design

**Date:** 2026-06-04
**Status:** Approved

## Overview

The `AppBar` island gains a **detail mode** that replaces the section title + ≡ toggle with a back button + page title when the user drills into a detail page (e.g. a specific shopping list). Logout is moved from the AppBar header into the section sub-nav as the last item.

## AppBar Modes

### Section mode (unchanged pages)

Rendered on all section-level pages: `/shopping`, `/shopping/catalogue`, `/shopping/categories`.

```
┌──────────────────────────────────┐
│ Shopping                    [≡]  │
└──────────────────────────────────┘
```

Sub-nav (opened by ≡):

```
┌──────────────────────────────────┐
│  Shopping               [✕]      │
├──────────────────────────────────┤
│  › My Lists                      │
│    Item Catalogue                │
│    Categories                    │
│  ─────────────────               │
│    Logout                        │
└──────────────────────────────────┘
```

### Detail mode (new)

Rendered on `/shopping/[id]`. Back button navigates to `/shopping`. Title shows the list name. No ≡ toggle, no logout.

```
┌──────────────────────────────────┐
│ [←]  Weekly Groceries            │
└──────────────────────────────────┘
```

## Data Flow

Route handlers set an optional `appBar` object on `ctx.state`. `_app.tsx` reads it to decide which AppBar mode to render. Pages that do not set `ctx.state.appBar` get section mode automatically.

### `utils/define.ts` — extend `StateInterface`

Add `AppBarDetail` interface and an optional `appBar` field:

```ts
export interface AppBarDetail {
  mode: "detail";
  title: string;
  backUrl: string;
}

export interface StateInterface {
  userId?: string;
  householdId?: string;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
  appBar?: AppBarDetail;
}
```

### `routes/shopping/[id]/index.tsx` — set detail context

After fetching the list, before calling `page()`:

```ts
ctx.state.appBar = {
  mode: "detail",
  title: list.name,
  backUrl: "/shopping",
};
```

The existing `← Lists` back link inside the page component is removed — the AppBar now owns back navigation.

### `routes/_app.tsx` — branch on appBar state

```tsx
// Import StateInterface from utils
{state?.appBar ? (
  <AppBar mode="detail" title={state.appBar.title} backUrl={state.appBar.backUrl} />
) : (
  <AppBar
    mode="section"
    activeTabLabel={activeTab?.label ?? "Happie"}
    subNavItems={activeTab?.subNav ?? []}
    activeRoute={url.pathname}
    logoutRoute="/logout"
  />
)}
```

`_app.tsx` switches its local `State` interface to import `StateInterface` from `@/utils/define.ts`.

## AppBar Component Changes

### Props — discriminated union

```ts
type AppBarProps =
  | {
      mode: "section";
      activeTabLabel: string;
      subNavItems: SubNavItem[];
      activeRoute: string;
      logoutRoute?: string;
    }
  | {
      mode: "detail";
      title: string;
      backUrl: string;
    };
```

### Section mode render (modified)

Logout moves from the header to the bottom of the sub-nav list, separated by a visual divider. The `logoutRoute` prop drives it as before.

```tsx
<ul class="py-2">
  {subNavItems.map((item) => (
    <li key={item.route}>...</li>
  ))}
  {logoutRoute && (
    <>
      <li role="separator" class="my-2 border-t border-gray-100" />
      <li>
        <a href={logoutRoute} class="block px-6 py-3 text-sm text-red-500">
          Logout
        </a>
      </li>
    </>
  )}
</ul>
```

### Detail mode render (new branch)

```tsx
<div class="relative z-50">
  <header class="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
    <a href={backUrl} class="text-blue-600 text-xl" aria-label="Back">←</a>
    <span class="flex-1 font-bold text-xl truncate">{title}</span>
  </header>
</div>
```

`useSignal` and `useEffect` always execute (hooks run on every render), but in detail mode no toggle button exists so `open.value` stays `false` and the `useEffect` early-return guard prevents any listener from being registered.

## Files Changed

| File | Change |
|------|--------|
| `utils/define.ts` | Add `AppBarDetail` interface, add `appBar?: AppBarDetail` to `StateInterface` |
| `islands/AppBar.tsx` | Discriminated union props, detail mode render, logout moved to sub-nav |
| `islands/AppBar.test.tsx` | Update tests: logout in sub-nav, add detail mode tests |
| `routes/shopping/[id]/index.tsx` | Set `ctx.state.appBar`, remove `← Lists` link from page content |
| `routes/_app.tsx` | Switch to `StateInterface`, branch on `state.appBar` |

## Out of Scope

- Detail mode for catalogue or categories pages (no nested detail pages exist yet)
- Transition animations between section and detail AppBar
- Any other route setting `ctx.state.appBar` (only list detail for now)
