# Install Guidance — Design

**Date:** 2026-08-08\
**Issue:** #72 (iteration 2 of the PWA roadmap,
`docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md`)\
**Status:** Approved

## Context

Installing Happie to the home screen is what unlocks push notifications (and,
later, badging) on iOS — `islands/shell/usePushNotifications.ts` already
detects this as its `needs-install` state, but today that state is a dead-end
paragraph in the notifications sheet. Iteration 1 (#71) made the manifest
install-correct; nothing in the product yet *helps* a household member
install.

## Goal

A household member on any device can find "Install the app" and succeed —
one tap on Android/Chromium, clear steps on iOS — and a member who hits the
push notifications dead-end gets guided instead of stranded.

## Decisions

1. **Entry points (user-decided):** a durable "Install the app" row in the
   More sheet, plus the notifications sheet's `needs-install` state embeds the
   guidance. **No unprompted banners or nudges** — out of scope.
2. **`beforeinstallprompt` capture (user-approved approach):** an early
   inline stash script in the `<Head>` of `routes/_app.tsx`, because the
   event can fire before island hydration and is not re-fired. The script:
   `preventDefault()` (suppresses Chrome's mini-infobar), parks the event on
   `window.__happieInstallPrompt`, and dispatches a
   `happie:install-ready` CustomEvent for already-hydrated islands. Three
   lines, first-party, no CDN.
3. **Shared guidance content:** the instructional UI is a presentational
   component used by both sheets — the guidance comes to the member; no
   cross-sheet navigation.

## Architecture

| Unit | Responsibility |
| --- | --- |
| inline stash script (`routes/_app.tsx`) | Capture `beforeinstallprompt` before hydration; expose stash + ready event. Knows nothing about UI. |
| `islands/shell/useInstallPrompt.ts` | State machine + actions. Owns all platform probing and the stash contract. |
| `islands/shell/InstallSetting.tsx` | The More-sheet row + its sibling sheet. Renders state → content. |
| `components/shell/InstallGuidance.tsx` | Pure presentational instructions (iOS steps / generic steps / install button slot). No hooks, no globals — props only. |
| `islands/shell/NotificationSetting.tsx` | `needs-install` branch embeds `InstallGuidance` under its existing message. |

### `useInstallPrompt` state machine

States: `installed` | `promptable` | `ios-browser` | `manual`.

- Detection is a **pure function** `detectInstallState(probes)` taking
  `{ isIos, isStandalone, hasStashedPrompt }` — unit-testable without DOM.
- Probes (client only): `isStandalone` = `display-mode: standalone`
  matchMedia OR `navigator.standalone === true` (reuse the same checks as
  `iosNeedsInstall()`); `hasStashedPrompt` = `window.__happieInstallPrompt`
  present.
- SSR renders `manual` deterministically; the mount effect replaces it with
  the real state (§11 pattern — guard on `typeof document`, **not**
  `navigator`, which Deno defines server-side).
- Live transitions: `happie:install-ready` → `promptable`; `appinstalled` →
  `installed`.
- Action `promptInstall()`: calls the stashed event's `prompt()`, awaits
  `userChoice`, clears the stash (a `BeforeInstallPromptEvent` is single-use),
  returns `"accepted" | "dismissed" | "failed"` (try/catch — dismissal is a
  normal outcome, not an error).
- TypeScript: `BeforeInstallPromptEvent` is not in `lib.dom` — declare a
  minimal interface (`prompt(): Promise<void>`,
  `userChoice: Promise<{ outcome: "accepted" | "dismissed" }>`) in the hook.

### `InstallSetting` row + sheet

- Follows `NotificationSetting`'s shape exactly: `badge()` icon (an install /
  download icon from `components/md3/Icon.tsx`, adding it if missing), MD3
  `ListItem` with chevron, sibling `Sheet` opened via `onOpen={onClose}` so
  sheets never stack.
- The row renders on SSR and hides after hydration when state is `installed`
  (signal flip in mount effect — no hydration mismatch, installed users see
  it vanish before the sheet is ever opened).
- Sheet content by state:
  - `promptable`: one filled full-width button "Install Happie" →
    `promptInstall()`; outcome feedback inline ("It's on your home screen!" /
    "Maybe later — you can come back any time." / "That didn't work. Try
    again?").
  - `ios-browser`: `InstallGuidance` iOS steps.
  - `manual`: `InstallGuidance` generic steps.
  - `installed` (reachable if it flips while the sheet is open): "Happie is
    already on your home screen."

### `InstallGuidance` content

Warm, all-ages copy (product ethos — no "PWA", no "browser chrome" jargon):

- **iOS steps:** 1. Tap the Share button (square with an arrow) in Safari's
  toolbar. 2. Scroll and tap **Add to Home Screen**. 3. Tap **Add** — Happie
  gets its own icon, full screen, with notifications available.
- **Generic steps:** Open your browser's menu and look for **Install app**
  or **Add to Home Screen**.
- Variant chosen by a `variant: "ios" | "generic"` prop; the `promptable`
  button case lives in `InstallSetting`, not here (this component is
  instructions only).

### NotificationSetting wiring

In the `needs-install` branch, render `InstallGuidance` (iOS variant — that
state only occurs on iOS) directly below the existing explanatory paragraph.
No other changes to the notifications flow.

## Error handling

- `promptInstall()` never throws to the UI — `failed` outcome covers a
  rejected/void prompt.
- All platform probing is inside `try`-less simple property checks that are
  safe cross-browser (matchMedia/optional chaining); no capability assumed
  (§11: the core app never depends on any of this).

## Out of scope (YAGNI)

Nudge banners or cards anywhere; install analytics; desktop-specific install
UX beyond the generic steps; badging (#76); any service-worker change (the
single-worker rule from the roadmap stands — this iteration registers
nothing).

## Testing

- **Unit:** `detectInstallState` — all probe combinations (pure function).
- **Render:** `tests/install-setting.test.ts` render-to-string of
  `InstallGuidance` (both variants) and `InstallSetting` SSR output (row
  present, deterministic `manual` state) — same technique as
  `tests/app-head.test.ts`. A head test asserts the stash script is present
  in `routes/_app.tsx` output (extends `tests/app-head.test.ts`).
- **Browser:** dev-server pass — stash script present and non-crashing in a
  non-Chromium context, More sheet row opens the install sheet, generic
  steps render. Real `beforeinstallprompt`/`appinstalled` behavior needs
  Chrome on Android (via `deno task dev:mobile`) — verify manually; the
  outcome states are covered by unit tests either way.
