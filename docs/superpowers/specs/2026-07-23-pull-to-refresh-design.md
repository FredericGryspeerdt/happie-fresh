# Pull-to-Refresh Pattern — Design

**Date:** 2026-07-23
**Status:** Draft (awaiting review)
**Issue:** [#34](https://github.com/FredericGryspeerdt/happie-fresh/issues/34) — Add pull-to-refresh pattern
**Module:** Platform primitive (MD3) → first consumed by the Shopping module

---

## 1. Problem & context

Happie is a mobile-first PWA where data is shared across a household. A user
looking at a shopping list on their phone has no obvious way to pull in changes a
partner just made from another device short of navigating away and back. The
platform-standard gesture for "give me the latest" on mobile is **pull-to-
refresh** — drag down from the top of the content, release, watch it reload.

We want this as a **reusable platform primitive**, not a shopping-specific hack.
Per the product vision, the shopping list is only the first module; anything
built here should be a cohesive building block future modules (meal planning,
todos, dashboards) can drop in without re-inventing the gesture, the motion, or
the feedback states.

## 2. Goals / non-goals

**Goals**
- A reusable, MD3-consistent pull-to-refresh primitive integrable on any page.
- Each page defines **its own** refresh behaviour via an `onRefresh` callback.
- Clear visual feedback across the full lifecycle: pulling → armed → refreshing →
  success / error.
- Works with the existing scroll model (the `<body>` scrolls) and page layouts.
- Unit-testable gesture logic, following the repo's hook-test conventions.

**Non-goals (v1)**
- Keyboard or programmatic refresh trigger (the gesture is touch-only; it
  *augments* the existing navigate-to-reload behaviour, it does not replace it).
- Mouse-drag / desktop support (desktop users reload via the browser; PTR is a
  mobile idiom).
- Integration on the **category-reorder** page (drag-to-reorder would fight the
  pull gesture) or the **Home / Menu / Todos** placeholders (`ComingSoon`, no
  data to refresh).
- Any data-model, API, or route change. No new endpoints.
- Infinite scroll / pull-up-to-load-more (a different pattern).

## 3. Product alignment

Refreshing shared data mid-task is a core "on the go" moment: check off items
while shopping, then pull to see what someone added at home. Building it as a
platform primitive (`components/md3/`) rather than inside the shopping islands
keeps the codebase aligned with "new features should feel like cohesive modules
within a broader household platform." The warm, approachable tone is preserved by
friendly copy ("Couldn't refresh — try again") and playful-but-calm MD3 motion.

## 4. UX design

### 4.1 The gesture

Touch only. Starting from the **top** of the page (`window.scrollY <= 0`), a
**downward** drag reveals a circular indicator that follows the finger with
**resistance** (damped travel, so the content feels elastic, not 1:1). Once the
pull passes a **threshold** (~72px of damped travel) the indicator becomes
**armed** (a subtle "let go now" cue). Releasing:

- **armed** (`pull ≥ threshold`) → enters **refreshing**: the content settles at
  a small resting offset (~64px), the indicator spins, and `onRefresh()` runs.
- **not armed** (`pull < threshold`) → springs back to rest, no refresh.

A drag that is predominantly **horizontal**, or that did **not** start at the top,
is ignored — the browser scrolls / swipes normally.

### 4.2 The indicator (MD3-consistent)

A circular "puck": `bg-surface-c`, fully rounded (`--md-shape-full`),
`md-elevation-3`, centred horizontally, that **descends** with the pull. Inside:

- **pulling** — a progress ring/arrow rotates in proportion to pull distance
  (visual "loading up" of intent). Opacity/scale ramps in from the top edge.
- **armed** — the ring completes / arrow flips as a "release" affordance.
- **refreshing** — an indeterminate spin (`text-primary`).
- **success** — morphs to a `check` icon (`text-primary`) held briefly (~500ms),
  then the whole indicator retracts up and out.
- **error** — retracts immediately; the error is surfaced via Snackbar (§4.3).

Motion uses the existing curves (`--md-emphasized`, `--md-spring` for the settle).
The content translates via `transform: translateY(pull)` so nothing reflows.

### 4.3 Feedback (loading / success / error)

- **Loading:** the spinning indicator is the loading state.
- **Success:** the brief check in the indicator, then content updates in place.
  Quiet by design — no Snackbar on success.
- **Error:** `onRefresh()` rejecting (or throwing) retracts the indicator and
  shows the **MD3 Snackbar** with "Couldn't refresh — try again." The Snackbar is
  rendered **internally** by the `PullToRefresh` wrapper, so consuming pages need
  no extra wiring.

### 4.4 Accessibility

The gesture is inherently touch/pointer-based and not keyboard-operable — this is
acceptable because it augments (never replaces) refresh-on-navigation. For screen
readers, the indicator exposes an `aria-live="polite"` visually-hidden status that
announces "Refreshing…" and "Refreshed" / "Couldn't refresh". The decorative puck
graphics are `aria-hidden`.

## 5. Architecture

Chosen approach: **hook (logic) + presentational wrapper (DOM + visuals)**. This
matches the repo's strong hook culture (`useShoppingList`, `useCatalogue`,
`createDebouncedMergeScheduler`), keeps each page in control of *its* refresh and
*when* the gesture is active, and makes the state machine unit-testable without a
DOM — the test suite renders islands via `preact-render-to-string` and has **no**
DOM event simulation, so gesture logic must be drivable by plain function calls.

Two alternatives were rejected: a single self-contained component (conflates
gesture + presentation, not DOM-free testable) and a global PTR in `AppChrome`
driven by a per-page `onRefresh` signal (implicit global coupling; per-page
disabling for open sheets / drag-reorder gets awkward — over-engineered for now).

### 5.1 Hook — `hooks/usePullToRefresh.ts`

The brain. Signal-based state machine, **no `window`/DOM access** (the component
feeds it `atTop`). Modelled after `createDebouncedMergeScheduler` (a factory
holding internal signals + timers).

**Signature (shape, to be finalised in the plan):**

```ts
type PullStatus =
  | "idle"
  | "pulling"
  | "armed"
  | "refreshing"
  | "success"
  | "error";

function usePullToRefresh(opts: {
  onRefresh: () => Promise<unknown>;
  threshold?: number;   // default 72 (px of damped travel to arm)
  resistance?: number;  // default 0.5 (damping factor)
  disabled?: boolean;
}): {
  status: Signal<PullStatus>;
  pull: Signal<number>;       // current damped offset in px
  begin(startY: number): void;
  move(currentY: number, atTop: boolean): void;
  end(): void;
};
```

- `begin` records the drag origin.
- `move(currentY, atTop)` computes damped `pull` from the delta; if the drag left
  the top or reverses, it disengages. Transitions `pulling ↔ armed` around the
  threshold.
- `end` decides refresh vs spring-back. On refresh: `status = "refreshing"`, await
  `onRefresh()`, then `"success"` (hold ~500ms via timer) → `"idle"`, or
  `"error"` → `"idle"`. Self-ignores re-entrancy while `refreshing`.
- `disabled` (or an in-flight refresh) makes `begin`/`move` no-ops.

Timers (success hold, retract) use `setTimeout` so tests drive them with
`FakeTime`, matching `useShoppingList.test.ts`.

### 5.2 Component — `components/md3/PullToRefresh.tsx`

The shell. A plain Preact component (used **inside** already-hydrated islands, so
it needs no island of its own).

**Props:** `{ onRefresh: () => Promise<unknown>; disabled?: boolean; children }`.

Responsibilities:
- Uses `usePullToRefresh({ onRefresh, disabled })`.
- Attaches **touch** listeners on the wrapper element: `touchstart` (record
  `startY`), `touchmove` (**non-passive**, so it can `preventDefault` the native
  scroll / browser PTR while engaged), `touchend`/`touchcancel`. Computes
  `atTop = window.scrollY <= 0` and forwards to the hook.
- Applies `transform: translateY(pull)` to the content region and positions the
  indicator puck above it.
- Renders the indicator (per §4.2), the `aria-live` status, and an internal
  `Snackbar` shown on `status === "error"`.

### 5.3 Global CSS — `assets/styles.css`

Add `overscroll-behavior-y: contain` to `body` as defense-in-depth against the
browser's own pull-to-refresh (Chrome/Android) even where a `touchmove`
`preventDefault` is missed. Harmless on desktop; improves PWA feel generally.

### 5.4 Integration

| Page | Island | `onRefresh` source | `disabled` when |
| --- | --- | --- | --- |
| `/shopping` (lists) | `islands/shopping-lists.tsx` | **new** local `refresh()` | new-list sheet open |
| `/shopping/[id]` (detail) | `islands/items.tsx` | existing `useShoppingList().refresh` | add-items overlay open |
| `/shopping/catalogue` | `islands/catalogue.tsx` | **new** `useCatalogue().refresh` | any editing sheet open |

**Lists page refresh (count recomputation).** The `/shopping` page renders lists
**with counts** (`total` / `done`), but `api.shoppingLists.getAll()` returns bare
`ShoppingListInterface[]`. So the new local `refresh()` mirrors the server
handler: fetch lists, then for each list fetch its items
(`api.shoppingList.getItems`) to recompute `total` / `done`, and replace the
`lists` signal. Household lists are few, so the N+1 fetch is an acceptable
tradeoff for a smooth in-place update (vs a jarring full-page reload).

**Catalogue refresh.** Add `refresh()` to `useCatalogue` that re-pulls
`api.items.getAll()` + `api.categories.getAll()` in parallel and replaces the
`items` / `categories` signals (mirroring `useShoppingList.refresh`, wrapped in
`pendingCount`).

## 6. File plan (for the implementation plan to expand)

- **Create:** `hooks/usePullToRefresh.ts` (gesture state machine) + export from
  `hooks/index.ts`.
- **Create:** `components/md3/PullToRefresh.tsx` (wrapper + indicator + error
  Snackbar), with usage JSDoc.
- **Modify:** `assets/styles.css` (`overscroll-behavior-y: contain` on body;
  any indicator keyframes if not expressible inline).
- **Modify:** `hooks/useCatalogue.ts` (add `refresh`).
- **Modify:** `islands/items.tsx` (wrap content; `disabled` = add overlay open).
- **Modify:** `islands/shopping-lists.tsx` (add local `refresh` with count
  recompute; wrap content; `disabled` = new-list sheet open).
- **Modify:** `islands/catalogue.tsx` (wrap content; `disabled` = editing open).
- **Reuse (no change):** `components/md3/Snackbar.tsx`, `components/md3/Icon.tsx`,
  `services/api.ts`.
- **Tests:** `hooks/usePullToRefresh.test.ts` (new),
  `components/md3/PullToRefresh.test.tsx` (new); light additions to affected
  island tests if needed.

## 7. Testing

- **Hook unit tests** (`hooks/usePullToRefresh.test.ts`, matching
  `useShoppingList.test.ts` style — direct calls, `stub`, `FakeTime`):
  - drag below threshold → `pulling`, `end` springs back to `idle`, `onRefresh`
    **not** called;
  - drag past threshold → `armed`, `end` → `refreshing` → (resolve) `success` →
    `idle`, `onRefresh` called once;
  - `onRefresh` rejects → `error` → `idle`;
  - `move` with `atTop=false` (scrolled) or a horizontal-dominant delta → no
    engagement;
  - `disabled` / mid-refresh re-entrancy → `begin`/`move` are no-ops;
  - resistance: `pull` is a damped fraction of raw delta.
- **Component SSR test** (`components/md3/PullToRefresh.test.tsx`,
  `preact-render-to-string`): renders `children` and the idle indicator markup;
  no error Snackbar in the idle tree.
- **Gates:** `deno task check`, `deno test`, `deno task build` all green.
- **Live verification** (mobile viewport, via the browser preview): on each of the
  three pages — pull below threshold springs back; pull past threshold spins and
  updates content; a forced `onRefresh` rejection surfaces the error Snackbar;
  the gesture does **not** fire mid-scroll or when the relevant sheet/overlay is
  open.

## 8. Rollout

Feature branch `feature/issue-34-611333`. Implementation proceeds via the
writing-plans → subagent-driven-development flow after this spec is approved.
The primitive lands first (hook + component + CSS + tests), then the three page
integrations, each independently verifiable.

## 9. Risks & open points

- **Native browser PTR conflict.** Non-standalone mobile browsers have their own
  pull-to-refresh. Mitigation: `overscroll-behavior-y: contain` + `preventDefault`
  on an engaged `touchmove`. To confirm live on Android Chrome during verification.
- **`touchmove` passivity.** Preventing native scroll requires a **non-passive**
  listener; must attach via `addEventListener(..., { passive: false })` (JSX
  `onTouchMove` is passive by default in some engines). Flagged for the plan.
- **Lists-page N+1 fetch.** Acceptable for the small number of household lists; if
  lists ever grow large, add a counts-included list endpoint (future, out of
  scope).
- **iOS rubber-band.** iOS Safari overscroll can still bounce; the resistance +
  transform approach keeps the indicator sensible, but exact feel is validated
  live.
