# Design: Visual Loading Feedback

- **Date:** 2026-07-23
- **Status:** Approved (design); pending implementation plan
- **Issue:** [#32 — Add visual loading feedback for user interactions](https://github.com/FredericGryspeerdt/happie-fresh/issues/32)
- **Author:** brainstormed with Claude

## 1. Context & goal

The app currently gives **no visual loading feedback**. There are no spinners,
skeletons, or indeterminate indicators anywhere. The lone `Progress.tsx`
primitive is a _determinate_ bar that visualizes shopping-list completion
(`x / y` done), not loading.

Two facts about the current architecture shape this entire design:

1. **Navigation is 100% full-page SSR.** Every navigation is a real browser
   document load (via `<a href>` or `globalThis.location.href`). There is no
   client-side router and no Fresh Partials. The genuine, user-perceived wait in
   this app is the navigation round-trip (route handlers do `Promise.all` DB
   reads before the new page paints).
2. **CRUD is fully optimistic.** Mutations in `useShoppingList` /
   `useCatalogue` update the UI signals _instantly_ and fire the API call in the
   background. Blocking the UI with a spinner until the server responds would
   make the app feel **slower** than it is today.

**Goal:** give users honest, MD3-styled confirmation that (a) the app is loading
when navigating between pages, and (b) work is being processed for the few
genuinely-awaited actions — **without** degrading the snappy optimistic feel.
Deliver this as **reusable primitives** so future household modules (to-dos,
meal planner, etc.) inherit loading feedback for free.

## 2. Scope

**In scope**

- A global navigation loading indicator in the app shell.
- A reusable MD3 `Spinner` primitive (circular, indeterminate).
- A `loading` busy-state on the existing `Button`.
- A shared cross-island state module (`utils/loading.ts`).
- Wiring the above into the existing shopping surfaces + the shell.
- Surfacing the already-maintained-but-unused `pendingCount` as an honest
  "a write is in flight" signal.
- Making the existing "Saved" flash consistent (add a "Saving…" phase).

**Out of scope (deferred / YAGNI)**

- **Skeleton loaders.** Because content is server-rendered and arrives fully
  populated, there is no client-side "empty → fill" moment for a skeleton to
  cover — the global nav bar covers the transition instead. No current wiring
  target exists, so we do **not** build a `Skeleton` primitive now. Revisit when
  a real client-fetched surface appears.
- The full **MD3 Expressive morphing loading indicator** (7 morphing shapes,
  spring transitions). We adopt the _wavy/amplitude_ expressive flavor instead
  (see §5), for far less build/maintenance cost.
- Any client-side router / Fresh Partials.
- Any change to the optimistic data-flow, repositories, or API routes.

## 3. Decisions of record

| #  | Decision | Choice |
|----|----------|--------|
| D1 | Overall approach | **Full toolkit**: global nav indicator + reusable localized primitives. |
| D2 | Visual style | **Wavy/amplitude MD3**: wavy indeterminate linear bar (nav) + simple circular `Spinner` (buttons/inline). Not the full morphing indicator. |
| D3 | CRUD feedback | **Non-blocking.** Never block optimistic rows. Button-busy only for genuinely-awaited actions; global bar reflects background writes; keep the "Saved/Saving" pill for debounced edits. |
| D4 | Nav trigger | **Centralized interception**: one delegated click listener for `<a>` links + a shared `navigateTo()` helper for the few imperative `location.href` sites. New links need zero per-site wiring. |
| D5 | Skeletons | **Dropped** for now (YAGNI — no SSR wiring target). |
| D6 | State plumbing | **Module-scope signals** in `utils/loading.ts`, mirroring the existing `utils/app-bar.ts` cross-island pattern. |

## 4. Architecture & file layout

```
utils/loading.ts            NEW. Module-scope signals + helpers (cross-island glue).
                              - navPending: Signal<boolean>   (navigation in flight)
                              - busyCount:  Signal<number>    (background CRUD in flight)
                              - navigateTo(url), reloadPage()  (set navPending, then navigate)
                              - beginBusy() / endBusy()        (++/-- busyCount)
                            (The bar's own show/hide with the ~200ms delay + ~400ms min
                             visible duration is stateful/timer-based and lives in the
                             GlobalLoadingBar island, not a pure computed — see §6.2.)

components/md3/Spinner.tsx   NEW. MD3 circular indeterminate spinner. Props: size, color,
                              aria-label. Pure CSS rotation keyframe. SSR-safe.

islands/shell/GlobalLoadingBar.tsx
                            NEW island. Renders the wavy indeterminate linear bar,
                              fixed to the top of the viewport. Reads utils/loading.ts.
                              Installs the centralized nav interception (click listener,
                              pageshow/pagehide handlers) on mount.

components/md3/Button.tsx    MODIFIED. Add `loading?: boolean`. When true → render a
                              leading Spinner, force disabled, keep label width stable.

assets/styles.css           MODIFIED. New @keyframes: md-wave (wavy bar traverse) +
                              md-spin (circular rotation). prefers-reduced-motion fallbacks.

islands/shell/AppChrome.tsx MODIFIED. Render <GlobalLoadingBar/> above TopAppBar
                              (also in appBar.mode === "none" full-screen routes, so the
                              add-items overlay still shows nav feedback).

hooks/useShoppingList.ts    MODIFIED. Feed the shared busyCount (via beginBusy/endBusy)
hooks/useCatalogue.ts         at the existing pendingCount ++/-- sites. (pendingCount stays
                              for any local use; the shared signal is what the shell reads.)

islands/shopping-lists.tsx  MODIFIED. Create-list button → Button loading prop (signal
                              already exists). Replace raw location.href with navigateTo().
islands/items.tsx           MODIFIED. Rename/delete reloads → navigateTo()/reloadPage().
islands/catalogue.tsx       MODIFIED. Add-item action → Button loading; segmented nav →
                              navigateTo(). Extend "Saved/Saving" consistency.
islands/add-items.tsx       MODIFIED. Add action → Button loading (awaited add).
islands/shell/NavigationBar.tsx, MoreSheet.tsx
                            MODIFIED. Replace raw location.href with navigateTo().
```

**Fresh islands rule:** only islands hydrate. `Spinner` is a plain presentational
component (CSS animation works in pure SSR). `GlobalLoadingBar` must be an island
(it installs listeners + reads reactive signals). `utils/loading.ts` uses
module-scope `signal()` (NOT `useSignal`), exactly like `utils/app-bar.ts` — this
is the sanctioned cross-island channel; a full page load naturally resets it.

## 5. Visual design (D2 — wavy/amplitude MD3)

### 5.1 Global loading bar

- A thin (**4px**) bar fixed to the very top of the viewport, `z` above
  `TopAppBar`, spanning full width, honoring `env(safe-area-inset-top)`.
- **Wavy indeterminate active track:** an amber (`--md-primary`) segment that
  traverses left→right over a `--md-primary-container` track, with a subtle
  vertical wave (the expressive "amplitude" flavor). Implemented as a CSS
  `@keyframes md-wave` translating a gradient/segment; the wave is a repeating
  SVG/CSS sine background on the active segment. Easing `--md-emphasized`.
- Corners use `--md-shape-full`. Appears/disappears with a short opacity fade.

### 5.2 Circular spinner

- MD3 circular indeterminate: a `currentColor` arc on a faint track ring,
  rotating via `@keyframes md-spin`. Props: `size` (default 20, button use ~18),
  `color` (defaults to `currentColor` so it inherits button text color),
  `aria-label` (default "Loading").

### 5.3 Accessibility & motion

- Bar: `role="progressbar"` + `aria-busy` on the region; a visually-hidden
  "Loading" text node.
- Spinner: `role="status"` with visually-hidden label.
- `@media (prefers-reduced-motion: reduce)`: the wavy traverse and the spin are
  replaced by a gentle opacity pulse (no translation/rotation).

## 6. Behavior

### 6.1 Navigation feedback (D4 — centralized interception)

`GlobalLoadingBar` (mounted once in `AppChrome`) installs on hydrate:

1. **Delegated `click` listener** on `document`. If the click target resolves to
   an `<a>` whose href is same-origin, not `target="_blank"`, not `download`,
   not a modifier/middle click, and not a pure `#hash` on the current page →
   `navPending.value = true`. Default navigation proceeds; the old page stays
   visible (with the bar animating) until the new document paints, at which point
   the fresh module state resets `navPending` to `false` automatically.
2. **`navigateTo(url)` / `reloadPage()` helpers** for the imperative sites that
   don't emit an interceptable click (`NavigationBar` tab taps, `MoreSheet`
   links, `shopping-lists` open-list + segmented, `catalogue` segmented,
   `items` rename/delete reloads). Each sets `navPending` then assigns
   `location.href` / calls `location.reload()`. This is the "interception" for
   programmatic navigation — call sites swap `location.href = x` → `navigateTo(x)`.
3. **`pageshow` handler:** if the page is restored from bfcache
   (`event.persisted`), reset `navPending = false` (the restored DOM may have the
   bar showing).

Nav feedback appears **immediately** on trigger (perceived responsiveness) and is
wiped by the destination's first paint.

### 6.2 Background CRUD feedback (D3 — non-blocking)

- `useShoppingList` / `useCatalogue` call `beginBusy()` / `endBusy()` at the
  same points they currently bump `pendingCount` (add, remove, check, uncheck,
  refresh, catalogue mutations). `GlobalLoadingBar` reflects `busyCount > 0`.
- **Anti-flicker:** because optimistic writes are typically sub-second, the bar
  only appears for background writes that exceed a **~200ms** threshold, and once
  shown stays visible a **~400ms** minimum. Navigation (§6.1) is exempt — it
  shows instantly. This keeps fast saves invisible and slow ones honest.
- Optimistic rows are **never** blocked or spinner-covered.

### 6.3 Awaited actions (button-busy)

For the handful of actions where the user actually waits on a create before the
UI can proceed:

- **Create list** (`shopping-lists.tsx`) — the `loading` signal already exists
  and disables the button; now it also renders `Button loading` (inline spinner).
- **Add item / create catalogue item** (`add-items.tsx`, `catalogue.tsx`) — the
  add action awaits `addToList` / `addToCatalog`; show `Button loading` for that
  call.

> **Implementation note (2026-07-23):** the inline button-busy state shipped for
> **create-list only**. The add-item and catalogue-create actions route through
> `useShoppingList` / `useCatalogue`, which now feed the global `busyCount` bar —
> so those actions already show loading feedback via the top bar. The extra
> *local* inline spinner on those two buttons was deliberately deferred (accepted
> narrowing, confirmed during final review). The global bar covers the gap.

### 6.4 Debounced-edit "Saving / Saved"

Keep the existing `.md-saved-flash` "Saved" pill (driven by `lastSaved`). Add a
transient **"Saving…"** state while a debounced write is pending (scheduler has an
in-flight/queued write), flipping to "Saved" on flush. This makes the one
existing good affordance complete and consistent; it is **not** driven by
`busyCount` (debounced writes are intentionally excluded from that counter).

## 7. Data flow

No API/repository/model changes. The additions are purely presentational state:

- `utils/loading.ts` owns `navPending` + `busyCount` (module-scope signals).
- Hooks feed `busyCount`; the shell island reads it. This mirrors the existing
  `appBarAction` bridge in `utils/app-bar.ts`.
- A full-page navigation resets all module signals for free (new document).

## 8. Error handling & edge cases

- **Failed background write:** `endBusy()` runs in a `finally`, so the bar always
  clears even on error. (Surfacing errors themselves is out of scope — existing
  behavior unchanged.)
- **Navigation that never completes / is canceled:** the bar clears on the next
  `pageshow` or on a subsequent successful navigation; a full load resets state.
- **bfcache back/forward:** handled by the `pageshow` reset (§6.1.3).
- **External / new-tab / download / modified-click links:** excluded by the
  click-listener guard — no false nav indicator.
- **Full-screen routes** (`appBar.mode === "none"`, e.g. add-items overlay):
  `GlobalLoadingBar` still renders so those surfaces get nav + busy feedback.
- **Reduced motion:** opacity-only fallbacks (§5.3).
- **SSR:** `Spinner` renders its static ring server-side; `GlobalLoadingBar`
  renders hidden until hydrated (no listeners server-side).

## 9. Testing & verification

- `deno task check` (fmt + lint + type) green throughout.
- Unit tests (follow `components/md3/*.test.tsx` + `islands/**/*.test.tsx`):
  - `Spinner` renders with role/label and respects `size`/`color`.
  - `Button` `loading` renders a spinner, is disabled, preserves label.
  - `utils/loading.ts`: `navigateTo` sets `navPending`; `beginBusy/endBusy`
    balance `busyCount`; the ~200ms/~400ms show logic (with fake timers).
  - `GlobalLoadingBar`: click-listener sets `navPending` for internal links and
    ignores external/`_blank`/download/modified clicks; `pageshow(persisted)`
    resets.
- Manual/preview verification: throttle the network, navigate between Lists ↔
  detail ↔ Catalogue and confirm the wavy bar; perform a slow add and confirm the
  background bar; confirm fast optimistic checks show no flicker; confirm
  reduced-motion fallback.

## 10. References

- Issue: https://github.com/FredericGryspeerdt/happie-fresh/issues/32
- Cross-island signal pattern: `utils/app-bar.ts`, `islands/shell/AppChrome.tsx`
- In-flight counters (currently unused): `hooks/useShoppingList.ts` `pendingCount`,
  `hooks/useCatalogue.ts` `pendingCount`; "Saved" pill: `lastSaved` +
  `assets/styles.css` `.md-saved-flash` / `@keyframes md-saved-flash`
- MD3 tokens/motion: `assets/styles.css` (`--md-primary`, `--md-emphasized`,
  `--md-shape-full`)
- Navigation sites to route through `navigateTo()`: `islands/shell/NavigationBar.tsx`,
  `islands/shell/MoreSheet.tsx`, `islands/shopping-lists.tsx`,
  `islands/catalogue.tsx`, `islands/items.tsx`
- MD3 Expressive Loading Indicator background:
  https://github.com/material-components/material-components-android/blob/master/docs/components/LoadingIndicator.md
