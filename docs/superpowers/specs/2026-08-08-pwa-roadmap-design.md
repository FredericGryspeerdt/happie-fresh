# PWA Roadmap — Design

**Date:** 2026-08-08\
**Status:** Approved direction (roadmap); each iteration gets its own design +
plan cycle before implementation.

## Context

Happie is mobile-first and meant to be lived in as an installed PWA: checking
off items in the supermarket, quick adds on the go, family to-dos. Today the
PWA story is partial:

- **In place:** installable manifest + icons, web push for to-dos
  (`static/push-sw.js`, VAPID, cron sweep — ADR 0005), pull-to-refresh,
  safe-area handling, and the progressive-enhancement pattern
  (`docs/ui-ux-patterns.md` §11) for capability-gated features.
- **Discovery — no offline caching is active.** `routes/_app.tsx` loads
  PWABuilder's `pwa-update` component, which registers `/pwabuilder-sw.js` by
  default. That file does not exist, so the registration silently 404s. The
  Workbox worker in `static/pwa-sw.js` is dead code (nothing registers it);
  `static/pwa-sw-register.ts` and `static/site.webmanifest` are unreferenced
  leftovers. The comment at the top of `push-sw.js` confirms caching was
  deliberately deferred.
- **Manifest defects:** `display: "fullscreen"` hides the status bar (clock,
  battery) — wrong for an everyday utility; `theme_color`/`background_color`
  are black, clashing with the warm MD3 look; no `description`, no `id`, no
  192px icon entry, no screenshots, no shortcuts.

## Goal

Adopt the PWA capabilities that serve Happie's real use cases — and only
those. Every feature must degrade gracefully on devices that lack it (§11):
the household is a mix of iOS and Android, parents and children.

## Ground rules

1. **One service worker.** Only one registration may own scope `/`. A second
   `register()` with a different script URL replaces the push worker and
   breaks notifications. Any caching work must consolidate push + caching into
   a single worker (or explicitly partition scopes — default is consolidate).
2. **Progressive enhancement everywhere.** Core flows work with no PWA
   capability at all; capabilities are additive (§11 pattern: client-side
   probe in a mount effect, fallback always rendered).
3. **Support claims expire.** Browser support shifts (e.g. iOS web push
   gained features in 18.x). Each iteration's design re-verifies support for
   its APIs before building.
4. **Roadmap ≠ designs.** This doc fixes scope, order, and rationale. Each
   iteration goes through its own brainstorm → spec → plan cycle.

## Roadmap

| # | Iteration                  | Value                                    | iOS       | Android | Effort |
| - | -------------------------- | ---------------------------------------- | --------- | ------- | ------ |
| 1 | PWA foundation & cleanup   | Correct install experience, dead code out | ✅        | ✅      | Small  |
| 2 | Install guidance           | More installs → unlocks push/badging on iOS | ✅      | ✅      | Small  |
| 3 | Wake lock while shopping   | Screen stays on mid-shop                 | ✅ 16.4+  | ✅      | Small  |
| 4 | Offline foundation (reads) | List + loyalty barcodes work without signal | ✅     | ✅      | Large  |
| 5 | Offline mutations          | Check off / add items without signal     | ✅        | ✅      | Large  |
| 6 | Icon badging               | Due to-dos visible at a glance           | ✅ 16.4+  | ✅      | Small  |
| 7 | Sharing (out + target)     | Lists out everywhere; share-into on Android | partial | ✅     | Medium |
| 8 | Notification actions       | "Done" straight from the notification    | ⚠️ verify | ✅      | Small  |

Order rationale: 1 is a prerequisite for everything (a correct manifest and a
clean SW story). 2 and 3 are cheap, self-contained wins. 4 unlocks 5 — the
flagship pair. 6–8 are independent and can ship in any order after 1.

### 1. PWA foundation & cleanup

Fix the manifest: `display: "standalone"`, theme/background colors from the
MD3 palette, `description`, `id`, 192px + 512px icon entries, manifest
`shortcuts` (Shopping list / Add items / To-dos — long-press app icon on
Android/desktop; ignored on iOS). Remove the dead weight: the broken
`pwa-update` script tag, `static/pwa-sw.js`, `static/pwa-sw-register.ts`,
`static/site.webmanifest`. Decide nothing about caching here — this iteration
only makes the current state honest and the install correct.

### 2. Install guidance

A small UI that helps household members install the app: custom install
button via `beforeinstallprompt` on Chromium; an "Add to Home Screen"
instruction sheet on iOS. Reuses the `needs-install` state already detected in
`islands/shell/usePushNotifications.ts` — installing is what unlocks push (and
later badging) on iOS, so this multiplies iteration 6 and the existing
notifications feature.

### 3. Wake lock while shopping

Keep the screen awake while the shopping list is open (Screen Wake Lock API,
Chrome + Safari 16.4+). Scope: acquire on the shopping screen when the list
has unchecked items, release on navigation/visibility loss; capability-gated
per §11. Design question for its own cycle: always-on vs. a user toggle.

### 4. Offline foundation (reads)

The flagship. Supermarkets have poor reception; the checkout is exactly where
the loyalty barcode must render. One consolidated service worker (absorbing
`push-sw.js`'s handlers) with an app-shell + runtime caching strategy so that:
the app opens offline, the shopping list renders from cache, and loyalty-card
barcodes display. Includes an offline indicator (snackbar/banner per §3
patterns) and cache-invalidation/update UX (replacing what `pwa-update`
pretended to do). Session-auth'd SSR pages and the KV-backed JSON APIs shape
the strategy — that's the meat of this iteration's own design.

### 5. Offline mutations

Queue writes made while offline — check-offs, adds, deletes — and replay on
reconnect. Background Sync API where available (Chromium-only), with an
`online`/visibility replay fallback everywhere else (iOS). Conflict stance
follows the existing optimistic-update model (`utils/debounce-update.ts`,
merge-patch semantics): last write wins per field. Depends on 4.

### 6. Icon badging

`navigator.setAppBadge()` with the count of to-dos due today. Set from the
app while open and from the push event in the service worker so the badge
updates when a due-notification arrives. iOS 16.4+ (installed), Chromium
desktop/Android. Small, pairs naturally with the existing to-do push sweep.

### 7. Sharing

Two halves, one iteration: **Web Share out** (share a shopping list or dish as
text — broad support incl. iOS) and **Web Share Target in** (share a recipe
URL from any app into the dish catalogue, or text into the shopping list —
Chromium/Android only, requires installed app; iOS simply never sees the
entry point).

### 8. Notification actions

Add a "Mark done" action button to the to-do push notification, handled in
the service worker (authenticated fetch to the existing to-dos API — cookies
ride along). Historically ignored on iOS — verify current support at design
time; Android/desktop get the win regardless.

## Rejected (for now)

- **Periodic Background Sync** — Chromium-only, engagement-score-gated,
  unreliable in practice; pull-to-refresh + push cover the need.
- **Contact Picker** — household members follow the Netflix honor-system
  model (ADR 0006); there is no invite flow to feed.
- **File handling / protocol handlers / window-controls-overlay** —
  desktop-PWA niceties with no matching Happie use case.
- **Payment / credential APIs** — no commerce or federated login in scope.

## Support references

Support claims above were sanity-checked 2026-08-08 against
[MagicBell's PWA iOS limitations guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
and [EngageLab on Safari notifications](https://www.engagelab.com/blog/safari-notifications);
iOS capabilities (push, badging, wake lock) landed in 16.4 and have since
evolved (declarative web push in 18.4) — re-verify per ground rule 3.

## GitHub mapping

Milestone **PWA features**, one issue per iteration numbered as above. Each
issue links back to this doc and is closed by its iteration's PR(s).
