# Wake Lock While Shopping — Design

**Date:** 2026-08-11\
**Issue:** #73 (iteration 3 of the PWA roadmap,
`docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md`)\
**Status:** Approved

## Context

Mid-shop, the screen keeps timing out — wet hands, gloves, a cart to push.
The Screen Wake Lock API (Chrome, Safari 16.4+) can keep the display on while
it matters. This is the roadmap's iteration 3; the deferred design question
(always-on vs. toggle) is now decided.

## Goal

While a shopping list with unchecked items is open, the screen stays awake.
When the last item is checked off, the member navigates away, or the tab is
hidden, the lock is released. No UI, no settings — invisible when it works,
invisible when the browser doesn't support it.

## Decisions

1. **Automatic, shopping-scoped (user-decided):** the lock is held exactly
   while the open list has unchecked items. No toggle, no persistence, no
   other screens.
2. **Reusable hook (user-approved approach):** a generic `useWakeLock` in
   `hooks/`, consumed by the shopping list island with a one-line condition.
   Future modules (e.g. a cooking mode) reuse it unchanged.
3. **Silent degradation:** unsupported browsers and rejected requests change
   nothing visible. An invisible enhancement must not produce visible
   complaints (§11 of `docs/ui-ux-patterns.md`; no snackbar).

## Architecture

| Unit | Responsibility |
| --- | --- |
| `hooks/useWakeLock.ts` | Everything wake-lock: capability probe, sentinel lifecycle, visibility handling, cleanup. Exposes `useWakeLock(shouldHold)` + a pure, exported decision function. |
| `islands/items.tsx` | Contributes the condition: the open list has unchecked items (`useShoppingList` already maintains an `uncheckedItems` signal). One computed + one hook call. |

### `useWakeLock(shouldHold: ReadonlySignal<boolean>)`

- **Pure decision function** (exported for unit tests, mirroring
  `detectInstallState`):
  `shouldRequestLock(probes: { supported: boolean; visible: boolean; wanted: boolean }): boolean`
  — true only when all three are true.
- **Probes:** `supported` = `"wakeLock" in navigator`, evaluated client-side
  only (§11 guard on `typeof document`, never `navigator` — Deno defines a
  server-side navigator); `visible` = `document.visibilityState === "visible"`;
  `wanted` = the consumer's signal.
- **Lifecycle:** when the decision flips true, `navigator.wakeLock
  .request("screen")` inside try/catch; hold the `WakeLockSentinel`. When it
  flips false, `sentinel.release()`. The browser force-releases on tab hide —
  listen for `visibilitychange` and re-acquire when visible again while
  `wanted` still holds. Listen for the sentinel's own `release` event so a
  browser-initiated release (battery saver) doesn't leave a stale reference.
  Release + remove listeners on unmount.
- **Failure:** a rejected `request()` is logged at debug level and otherwise
  ignored; the decision re-evaluates on the next signal/visibility change, so
  a temporary refusal (e.g. battery saver ends) self-heals without a retry
  loop.
- **SSR:** renders nothing, touches nothing server-side; deterministic no-op.

### Shopping list integration

In `islands/items.tsx`: a computed signal over `useShoppingList`'s
`uncheckedItems` (`uncheckedItems.value.length > 0`), passed to
`useWakeLock`. Nothing else changes — no UI, no copy.

## Out of scope (YAGNI)

A user toggle or any visible control; wake lock on other screens (catalogue,
add-items, to-dos); Battery Status API integration; persisting a preference;
any service-worker involvement.

## Testing

- **Unit:** `hooks/useWakeLock.test.ts` — `shouldRequestLock` across all
  probe combinations (colocated, like the other hook tests).
- **Render:** the shopping list island still SSRs deterministically with the
  hook in place (extend the existing island test only if the change is
  observable in SSR output — it should not be).
- **Browser (controller):** on the dev server in desktop Chrome (which
  supports wake lock): open a list with unchecked items and observe a held
  sentinel; check off the last item and observe the release; hide/show the
  tab and observe re-acquisition. Real-phone check rides on
  `deno task dev:mobile` as a PR follow-up.
