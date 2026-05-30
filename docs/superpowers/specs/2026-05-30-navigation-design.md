# Navigation Design

**Issue:**
[#10 — Redesign Application Navigation](https://github.com/FredericGryspeerdt/happie-fresh/issues/10)
**Date:** 2026-05-30 **Status:** Approved

## Overview

Replace the current flat header navbar with a two-tier navigation pattern:

- **Bottom tab bar** for top-level main features (Phase 1: visible tabs)
- **Section header with sub-nav** for sub-features within each main feature

This pattern works cleanly with 1–3 main features today and has a clear
migration path to a side drawer when 5+ main features exist.

## Information Architecture

```
App
└── Shopping Lists (main feature)
│   ├── My Lists          /lists
│   ├── Item Catalogue    /items
│   └── Categories        /categories/manage
└── [Future Feature 2]    (placeholder tab)
```

Main features are represented by bottom tabs. Sub-features are nested under
their parent and only visible after entering that feature's section. URL
structure is unchanged — only the navigation chrome changes.

## Components

### `config/navigation.ts` (new)

Single source of truth for the navigation tree. Defines each main feature with
its id, label, icon, default route, route prefixes for active-tab detection, and
sub-nav items.

```ts
export const NAV_CONFIG = [
  {
    id: "shopping-lists",
    label: "Lists",
    icon: "🛒",
    defaultRoute: "/lists",
    routes: ["/lists", "/items", "/categories"],
    subNav: [
      { label: "My Lists", route: "/lists" },
      { label: "Item Catalogue", route: "/items" },
      { label: "Categories", route: "/categories/manage" },
    ],
  },
];
```

### `components/TabBar.tsx` (new)

Fixed to the bottom of the viewport. Renders one tab per main feature using
standard `<a>` links. Receives `activeTabId` as a prop from `_app.tsx` — does
not read the URL itself. Server-rendered (no event handlers needed).

```
┌─────────────────────────────┐
│  🛒          📦             │
│  Lists    Feature 2         │
└─────────────────────────────┘
```

### `islands/AppBar.tsx` (new)

Replaces the current `<header>` in `_app.tsx`. Combines the section header bar
and the slide-down sub-nav panel into one island, since they share toggle state.
Receives `activeTabLabel`, `subNavItems`, and `activeRoute` as props.

Closed state:

```
┌─────────────────────────────┐
│  Shopping Lists         [≡] │
└─────────────────────────────┘
```

Open state:

```
┌─────────────────────────────┐
│  Shopping Lists         [✕] │
├─────────────────────────────┤
│  › My Lists                 │  ← active
│    Item Catalogue           │
│    Categories               │
└─────────────────────────────┘
```

Closes on outside tap or when the user navigates to a sub-feature link.

### `routes/_app.tsx` (modified)

- Remove the current hardcoded `<header>` nav links
- Resolve `activeTabId`, `activeTabLabel`, `subNavItems`, and `activeRoute` from
  `ctx.url.pathname` using `NAV_CONFIG`
- Render `AppBar` island at the top
- Render `TabBar` component fixed at the bottom
- Add bottom padding to page body (`pb-16` or equivalent) so content is not
  hidden behind the tab bar

## Active State Mapping

Active state is resolved server-side in `_app.tsx` and passed as props to
`AppBar` and `TabBar`. Neither reads the URL itself.

- **Active tab:** first entry in `NAV_CONFIG` whose `routes` array contains a
  prefix matching `ctx.url.pathname`
- **Active sub-nav item:** exact match of `ctx.url.pathname` against
  `subNav[].route` within the active tab

## User Flows

**Navigating between main features**

1. User taps a tab in `TabBar`
2. Browser navigates to that feature's `defaultRoute`
3. `_app.tsx` resolves new active tab; `TabBar` re-renders with updated
   highlight

**Accessing a sub-feature**

1. User taps ≡ in `AppBar`
2. Sub-nav panel slides down showing sub-features; active sub-feature is
   highlighted
3. User taps a sub-feature → sub-nav panel closes, browser navigates to that
   route

**Direct URL / deep link**

1. User opens e.g. `/categories/manage` directly
2. `_app.tsx` matches it to the "Shopping Lists" tab via `routes` prefix
3. `TabBar` highlights "Shopping Lists"; `AppBar` sub-nav (if opened) highlights
   "Categories"

## Phase 2 Migration (future, not in scope)

When 5+ main features exist, the bottom tab bar is replaced by a hamburger
button (☰) in `SectionHeader` that opens a side drawer listing all main
features. The sub-nav pattern inside each section is identical and requires zero
rework. The `NAV_CONFIG` structure and prop interfaces for both islands are
designed to support this without modification.

Trigger: team decision when the 5th main feature is being built.

## Out of Scope

- Any changes to route structure or URL patterns
- Visual restyling beyond navigation chrome
- Phase 2 drawer implementation
- Transition animations (can be layered on top after initial implementation)
