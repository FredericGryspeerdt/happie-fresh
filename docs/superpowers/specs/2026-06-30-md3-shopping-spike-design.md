# Design: MD3 Foundation + Shopping Spike

- **Date:** 2026-06-30
- **Status:** Approved (design); pending implementation plan
- **Branch:** `feat/md3-shopping-spike` (off `develop`)
- **Author:** brainstormed with Claude

## 1. Context & goal

The user mocked up a full Material Design 3 redesign of Happie in Claude Design and
exported it as a handoff bundle (`docs/happie/project/`). The prototype is a React +
Babel-standalone app that reimagines Happie as the broader household platform from the
product vision: Home dashboard, Shopping, To-dos, Menu planner, Loyalty cards, More.

Implementing the whole prototype is several subsystems' worth of work. We deliberately
scope this first effort as a **spike**: build the **MD3 design-system foundation** and
prove it on the **only feature that actually exists today — Shopping**. The point is to
de-risk the design system on real screens before committing to the rest of the prototype.

Success = the existing Shopping feature, rebuilt on a reusable MD3 foundation, visually
faithful to the mockups, with no regression in shopping behavior and `deno task check`
green.

## 2. Scope

**In scope**
- MD3 token layer (baked amber palette, type scale, shape scale, motion, state layers).
- A scoped MD3 component library (~15 primitives) — see §5.
- App shell: MD3 `TopAppBar`, 5-tab bottom `NavigationBar`, context-aware `Fab`.
- Two reskinned screens: **Lists overview** and **List detail** (Plan + Shop modes).
- Sheets used by those screens: add-item, item-editor, list-management, More/household.
- "Coming soon" placeholder for the non-shopping nav tabs.

**Out of scope (deferred to later phases)**
- **Assignees / family members** — no avatars, no Assign sheet, no "needs an owner"
  nudge. ⇒ **No data-model or API changes** in this spike.
- Catalogue tab and Category management screens (kept working as-is under the new shell,
  but not reskinned).
- Home, To-dos, Menu planner, Loyalty cards modules (placeholders only).
- Runtime dynamic color (seed picker), self-hosted fonts, offline/PWA enhancements.

## 3. Decisions of record

| # | Decision | Choice |
|---|----------|--------|
| D1 | Overall approach | Foundation + Shopping **spike** (not full prototype). |
| D2 | Surface area | **Lists overview + List detail** only. Catalogue/Categories deferred. |
| D3 | Assignees / members | **Deferred entirely.** No data-model change. |
| D4 | Color theming | **Static baked** OKLCH amber palette as CSS vars. |
| D5 | Build approach | **A — scoped MD3 library**: only the primitives these screens need. |
| D6 | App shell | Real **5-tab** bottom nav; Shop functional, others → "Coming soon"; More → sheet. |
| D7 | `AppBar`/`TabBar` | **Replaced** by MD3 `TopAppBar`/`NavigationBar`. Detail-mode → small+back variant. |
| D8 | Plan/Shop state | Client-only UI state (`useSignal`), not persisted. |

## 4. Architecture & file layout

```
assets/styles.css        MD3 token layer: baked --md-* vars, font imports, @theme mapping,
                         type-scale / state-layer / motion utilities, ripple keyframes.
components/md3/           Scoped primitive library (plain Preact components; press/ripple
                         behavior activates when hydrated inside an island, CSS state layer
                         works in pure SSR):
                           Pressable, Icon, Card, Button, IconButton, Chip, ListItem,
                           Segmented, Progress, SearchBar, Sheet, Snackbar, RoundCheck, Stepper
islands/                 Shell + reskinned screens (the only hydrated entry points):
                           app-shell: NavigationBar, TopAppBar, Fab  (see §6)
                           shopping-lists.tsx  → MD3 Lists overview (reskin)
                           items.tsx           → MD3 List detail, Plan/Shop (reskin)
routes/                  Data-loading unchanged. _app.tsx swaps AppBar/TabBar → MD3 shell.
                         Add placeholder routes for non-shopping tabs + More sheet trigger.
```

**Fresh islands rule that shapes the design:** only islands hydrate. MD3 primitives are
ordinary Preact components in `components/md3/`; when composed inside an island (the two
screens, the shell) they hydrate and get `useRipple` + JS press behavior. When rendered in
pure SSR they still render the `.md-state` CSS state layer (hover/active) but no JS ripple.
Therefore the shell and the two screens are islands; everything else is a component.

**Replaces:** `islands/AppBar.tsx` + `components/TabBar.tsx`. The section/detail concept
from recent AppBar work maps onto `TopAppBar`'s large vs small+back variants.

## 5. Design tokens & theming (D4)

1. **Palette (baked).** Run the prototype's `buildScheme(seedHex)` once for the amber seed
   (`docs/happie/project/md3-tokens.jsx:32-104`) and hardcode the resulting ~35 tokens as
   `--md-*` CSS variables on `:root` in `assets/styles.css`. Token set mirrors
   `schemeToVars()` (`md3-tokens.jsx:107-145`): primary/secondary/tertiary (+ container +
   on-*), error, success, background, surface + 5 surface-container tiers
   (lowest→highest), on-surface, on-surface-variant, outline, outline-variant, inverse-*.
   Values are OKLCH strings (modern-browser target, no fallback).
2. **Tailwind v4 mapping.** Expose tokens through a Tailwind `@theme` block so components
   use semantic utilities (`bg-surface-container-high`, `text-on-surface-variant`,
   `text-primary`, `border-outline-variant`) instead of raw `var(--md-*)`.
3. **Type scale.** Import **Baloo 2** (brand/headers) + **Roboto Flex** (body/labels) via
   Google Fonts `<link>` in `_app.tsx` head. Express the 12 MD3 roles
   (`md3-tokens.jsx:149-167`) as utility classes (`md-display-large` … `md-label-small`).
   Brand headers use Baloo 2 700.
4. **Shape scale.** CSS vars from `MD3_SHAPE` (`md3-tokens.jsx:175-177`):
   `--md-shape-xs:4px … --md-shape-xl:28px`, `--md-shape-full:999px`.
5. **Motion.** MD3 easing as CSS vars from `MD3_MOTION` (`md3-tokens.jsx:178-185`):
   `--md-emphasized`, `--md-emphasized-decel`, `--md-emphasized-accel`, `--md-spring`.
6. **State layer + ripple.** `.md-state` overlay (8% hover / 10% press, current-color
   tinted) + a ripple `@keyframes` (~0.5s, emphasized easing). Owned by `Pressable`.

## 6. Component library (D5) — the 15 primitives + shell

Reference implementation: `docs/happie/project/md3-ui.jsx:40-345`,
`md3-nav.jsx:5-145`. Recreate the **visual output**, not the React structure.

**Presentational (SSR-friendly):**
- `Icon` — line/stroke SVG set; include only the icons these screens use (cart, check,
  plus, minus, back, search, dots, chevron, edit, trash, share, tag, plate/leaf as needed).
- `Card` — variants filled / elevated / outlined; `pad`, radius from shape scale.
- `Button` — variants filled / tonal / elevated / outlined / text; optional leading icon;
  pill (40px h, 999px radius), `labelLarge`; disabled per MD3 (12%/38% mixes).
- `IconButton` — variants standard / filled / tonal / outlined; circular.
- `Chip` — selected (secondaryContainer + leading check) / unselected (outline); used for
  category chips in sheets. (The Lists/Catalogue and Plan/Shop selectors use `Segmented`,
  not chips.)
- `ListItem` — leading / headline / supporting / trailing row (56px min-height).
- `Progress` — MD3 linear w/ rounded gap (`value`/`total`); used on list cards & Shop mode.
- `RoundCheck` — round checkbox (unfilled ↔ filled + check), 0.15s fill; Shop-mode rows.

**Interaction-bearing (hydrate inside islands):**
- `Pressable` — `as`, `color`, `onClick`, `disabled`; renders `.md-state` + `useRipple`.
  All clickable primitives build on it.
- `Segmented` — option group ([key, icon, label]); selected = secondaryContainer + check.
  Drives **Plan|Shop** and **Lists|Catalogue**.
- `SearchBar` / add-bar — 52px pill, surfaceContainerHigh, search icon + text + trailing.
- `Sheet` — bottom sheet (**replaces `components/BottomSheet.tsx`**): scrim rgba(0,0,0,.32),
  28px top radius, translateY 110%→0 with emphasized-decel (~400ms), 32×4 drag handle,
  max-height ~84%. Preserve the existing touch-drag-to-close affordance.
- `Snackbar` — inverseSurface toast, bottom above nav; optional action (e.g. undo).
- `Stepper` — restyle of `components/quantity-stepper.tsx`; minus/count/plus, amber + button.

**Shell (islands):**
- `TopAppBar` — **small** variant only for this spike (Shopping list + detail): leading
  back button when in detail, title (emoji + list name), trailing actions (search /
  overflow). The large variant (Home greeting) is deferred along with Home. Ref:
  `md3-nav.jsx`.
- `NavigationBar` — 5 tabs (Home · Shop · To-dos · Menu · More), icon + label, animated
  active pill (secondaryContainer), `onSurfaceVariant` inactive. Active state derived from
  current route. Ref: `md3-nav.jsx:5-40`.
- `Fab` — context-aware label: Lists → "New list", List detail → "Add item". Ref:
  `md3-nav.jsx:72-92`. (Speed-dial `FabMenu` not needed; single FAB is fine for the spike.)

**Skipped this spike:** `Avatar`/`AvatarStack` (members deferred), `Switch` (no settings).

## 7. Screens

Recreate against mockups `docs/happie/project/mocks/02-shopping.png` (Lists),
`03-list-detail.png` (Plan). Reference code: `md3-screens.jsx`, `md3-app.jsx`.

### 7.1 Lists overview — reskin `islands/shopping-lists.tsx`
- `TopAppBar` small: "Shopping" + trailing search icon.
- `Segmented` **Lists | Catalogue**; Catalogue → "Coming soon" placeholder for now.
- List **`Card`s** (filled, ~20px radius): emoji circle + list name + `Progress` bar +
  "x/y done" + relative "updated" timestamp. **No avatar stack** (members deferred).
- Dashed **"New list"** card.
- `Fab` "New list".
- Keep existing create / rename / delete logic; move rename + delete-confirm into a `Sheet`.
- Empty state: icon + blurb + "New list" (ref `md3-screens.jsx` ShopLists empty state).

### 7.2 List detail — reskin `islands/items.tsx`
- `TopAppBar` small: back button + emoji + list name + overflow (⋮) → list-management `Sheet`.
- `Segmented` **Plan | Shop** (client `useSignal`, D8).
- **Plan mode** (`md3-screens.jsx:190-265`): add/search bar (+ opens add-item `Sheet`);
  items grouped by **category** in `Card`s; each row = name + optional note + `Stepper`;
  tapping a row opens the **item-editor `Sheet`** (qty stepper, category chips, note
  textarea, Remove). Category headers uppercase, primary color. *(No assignee row.)*
- **Shop mode** (`md3-screens.jsx:416-494`): progress `Card` ("x / y in cart" + bar);
  items grouped by **aisle** (category) with large-tap-target `RoundCheck` rows (name
  strikethrough + dimmed when done, qty badge if >1); checked items collapse under
  "In cart · x" with a chevron toggle; completion celebration card when all done.

### 7.3 Sheets
- **Add item** (`md3-app.jsx` / `md3-screens.jsx:269-333`): search input; if new, a
  primaryContainer "Add '<query>'" card with category chips + add button; catalogue matches
  below (added vs add). Wire to `useShoppingList.addToList` / `addToCatalog`.
- **Item editor** (`md3-screens.jsx:338-413`): qty `Stepper`, category `Chip`s, note
  textarea; "Saved" pill flashes on change (tertiaryContainer); Done + Remove. *(Assigned-to
  grid omitted.)* Wire to `updateListItem` / `removeListItem`.
- **List management** (`md3-app.jsx:462-479`): Rename, Share (coming soon), Clear checked,
  Delete (error color). Reuse existing list APIs.
- **More / household** (`md3-app.jsx:437-459`): modules list (mostly coming soon) +
  Members/Settings/Switch household (coming soon). Opened from the More nav tab.

### 7.4 Shell & placeholders (D6)
5-tab bottom nav. **Shop** fully functional. Home / To-dos / Menu → a shared `ComingSoon`
component (icon + title + blurb + "Coming soon" pill, ref `md3-app.jsx` ComingSoon).
More → household `Sheet` (no route). New routes `routes/home/index.tsx`,
`routes/todos/index.tsx`, `routes/menu/index.tsx` render `ComingSoon`. Index `/` keeps
redirecting → `/shopping` so the app opens on the working feature. Deferred
Catalogue/Categories pages still load under the new shell (inner content stays old-styled
— accepted rough edge).

## 8. Data flow

**No data-model or API changes** (D3). Both screens keep `useShoppingList` +
`utils/debounce-update.ts` exactly as today:
- Plan mode → `addToList`, `updateListItem` (qty/note/category), `removeListItem`.
- Shop mode → `checkItem`, `uncheckItem`.
- Existing category grouping feeds Plan groups and Shop aisles.
- Plan/Shop is client UI state, not persisted (D8).
- Lists overview keeps list CRUD against `/api/shopping/lists`.

## 9. Error handling & edge cases

- Empty states for no-lists and empty-list.
- Optimistic update + rollback behavior inherited unchanged from the hook/scheduler.
- OKLCH targets modern browsers (Deno Deploy audience) — no fallback.
- Fonts via Google Fonts `<link>` (self-hosting = later perf/PWA improvement).
- Accepted rough edge: deferred Catalogue/Categories keep old inner styling under new shell.
- Deep-linking straight to a list detail must render the new shell + small TopAppBar.

## 10. Testing & verification

- `deno task check` (fmt + lint + type) green throughout.
- Unit tests (follow `islands/AppBar.test.tsx` pattern) for logic-bearing pieces:
  `useRipple`, `Segmented`, `Pressable` state, Plan/Shop mode switching.
- Visual fidelity: run dev server, screenshot Lists + List-detail (Plan & Shop) and compare
  to the mockups.
- No regression in shopping behavior (add/edit/check/qty/note/delete still work).
- TDD for any new logic per the team workflow.

## 11. References

- Prototype entry: `docs/happie/project/Happie MD3 Prototype.html`
- Tokens: `docs/happie/project/md3-tokens.jsx`
- UI primitives: `docs/happie/project/md3-ui.jsx`
- Nav/shell: `docs/happie/project/md3-nav.jsx`
- Screens: `docs/happie/project/md3-screens.jsx`, `md3-catalogue.jsx` (deferred)
- App orchestration/sheets: `docs/happie/project/md3-app.jsx`
- Mockups: `docs/happie/project/mocks/0{1-9}-*.png`
- Current code: `islands/{shopping-lists,items,AppBar}.tsx`, `components/{TabBar,BottomSheet,
  quantity-stepper}.tsx`, `hooks/useShoppingList.ts`, `assets/styles.css`, `routes/_app.tsx`

## 12. Future phases (not now)

Foundation completion (Avatar/Switch + dynamic color), then: Shopping Catalogue/Categories
reskin + **members/assignees**, Home dashboard + activity feed, To-dos module, More/Household.
