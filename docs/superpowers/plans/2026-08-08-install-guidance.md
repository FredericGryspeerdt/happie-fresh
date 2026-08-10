# Install Guidance Implementation Plan (issue #72)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Help household members install Happie — a one-tap native prompt on
Chromium, clear steps on iOS — from a durable More-sheet row and from the push
notifications `needs-install` dead-end.

**Architecture:** A three-line inline head script stashes Chromium's
`beforeinstallprompt` (it can fire before islands hydrate and is never
re-fired). `islands/shell/useInstallPrompt.ts` owns a four-state machine
(`installed | promptable | ios-browser | manual`) with a pure, unit-testable
detect function. `islands/shell/InstallSetting.tsx` renders the More-sheet row
+ sibling sheet (mirroring `NotificationSetting` exactly), and the shared
presentational `components/shell/InstallGuidance.tsx` provides the
instructional steps for both sheets.

**Tech Stack:** Deno + Fresh 2 + Preact signals; tests with
`jsr:@std/assert@^1.0.19` and `npm:preact-render-to-string@^6.6.3`.

**Spec:** `docs/superpowers/specs/2026-08-08-install-guidance-design.md`

## Global Constraints

- **No service-worker changes, no registrations** — the roadmap's
  single-worker rule stands; this feature registers nothing.
- **No banners or nudges** — entry points are exactly: the More-sheet row and
  the notifications sheet's `needs-install` branch.
- **Stash contract (exact strings):** window property
  `__happieInstallPrompt`, CustomEvent name `happie:install-ready`.
- **SSR determinism (§11 of `docs/ui-ux-patterns.md`):** server renders state
  `manual` and the row visible; client-only probing guarded on
  `typeof document` — never on `navigator` (Deno defines a server-side
  `navigator`).
- **Copy is warm and jargon-free** (no "PWA", no "Chromium") — use the exact
  strings given in the task steps.
- **Escaping hazard:** preact-render-to-string HTML-escapes text children of
  `<script>` — the stash script MUST use `dangerouslySetInnerHTML` (Task 5
  shows how) and its test asserts the quotes render unescaped.
- Commits follow Conventional Commits; `deno task check` and the full
  `deno task test` must pass before every commit.
- Branch: `feature/install-guidance-72` (already checked out in the
  worktree). The PR closes #72.

---

### Task 1: Platform probes + install-state hook

**Files:**

- Create: `islands/shell/platform.ts`
- Create: `islands/shell/useInstallPrompt.ts`
- Test: `islands/shell/useInstallPrompt.test.ts` (create)
- Modify: `islands/shell/usePushNotifications.ts:23-32` (refactor
  `iosNeedsInstall` onto the shared probes)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces:
  - `platform.ts`: `isIosDevice(): boolean`,
    `isStandaloneDisplay(): boolean` (client-only; callers guard SSR).
  - `useInstallPrompt.ts`: `type InstallState = "installed" | "promptable" |
    "ios-browser" | "manual"`; `type PromptOutcome = "accepted" | "dismissed"
    | "failed"`; `detectInstallState(probes: { isIos: boolean; isStandalone:
    boolean; hasStashedPrompt: boolean }): InstallState`;
    `INSTALL_READY_EVENT = "happie:install-ready"`;
    `useInstallPrompt(): { state: Signal<InstallState>, busy:
    Signal<boolean>, promptInstall(): Promise<PromptOutcome> }`.

- [ ] **Step 1: Write the failing unit test**

Create `islands/shell/useInstallPrompt.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  detectInstallState,
  INSTALL_READY_EVENT,
} from "./useInstallPrompt.ts";

Deno.test("detectInstallState — standalone always wins", () => {
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: true,
      hasStashedPrompt: true,
    }),
    "installed",
  );
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: true,
      hasStashedPrompt: false,
    }),
    "installed",
  );
});

Deno.test("detectInstallState — a stashed prompt beats the iOS flag", () => {
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: false,
      hasStashedPrompt: true,
    }),
    "promptable",
  );
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: false,
      hasStashedPrompt: true,
    }),
    "promptable",
  );
});

Deno.test("detectInstallState — iOS browser without a prompt gets guidance", () => {
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: false,
      hasStashedPrompt: false,
    }),
    "ios-browser",
  );
});

Deno.test("detectInstallState — everything else is manual", () => {
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: false,
      hasStashedPrompt: false,
    }),
    "manual",
  );
});

Deno.test("install-ready event name matches the head stash script contract", () => {
  assertEquals(INSTALL_READY_EVENT, "happie:install-ready");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A islands/shell/useInstallPrompt.test.ts`

Expected: FAIL — module `./useInstallPrompt.ts` not found.

- [ ] **Step 3: Create `islands/shell/platform.ts`**

```ts
// Client-only device probes shared by the shell hooks. These read browser
// globals directly — callers must not run them during SSR (guard on
// `typeof document`, not `navigator`: Deno defines a server-side navigator).

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Launched from the home screen (installed) rather than in a browser tab. */
export function isStandaloneDisplay(): boolean {
  return (navigator as unknown as { standalone?: boolean }).standalone ===
      true ||
    matchMedia("(display-mode: standalone)").matches;
}
```

- [ ] **Step 4: Create `islands/shell/useInstallPrompt.ts`**

```ts
import { signal } from "@preact/signals";
import {
  isIosDevice,
  isStandaloneDisplay,
} from "@/islands/shell/platform.ts";

export type InstallState =
  | "installed"
  | "promptable"
  | "ios-browser"
  | "manual";

export type PromptOutcome = "accepted" | "dismissed" | "failed";

/** Chromium's install prompt event — not part of TS's lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Contract with the inline stash script in routes/_app.tsx: the script
// stashes the event under this window property and announces it with this
// event name. Keep all three in sync.
const STASH_KEY = "__happieInstallPrompt";
export const INSTALL_READY_EVENT = "happie:install-ready";

interface InstallProbes {
  isIos: boolean;
  isStandalone: boolean;
  hasStashedPrompt: boolean;
}

/** Pure state derivation — exported for unit tests. */
export function detectInstallState(probes: InstallProbes): InstallState {
  if (probes.isStandalone) return "installed";
  if (probes.hasStashedPrompt) return "promptable";
  if (probes.isIos) return "ios-browser";
  return "manual";
}

function stashedPrompt(): BeforeInstallPromptEvent | undefined {
  return (globalThis as Record<string, unknown>)[STASH_KEY] as
    | BeforeInstallPromptEvent
    | undefined;
}

/**
 * Client side of install guidance. Create once per island via
 * `useMemo(() => useInstallPrompt(), [])` — the same pattern as
 * usePushNotifications.
 */
export function useInstallPrompt() {
  const state = signal<InstallState>("manual");
  const busy = signal(false);

  const detect = (): InstallState =>
    detectInstallState({
      isIos: isIosDevice(),
      isStandalone: isStandaloneDisplay(),
      hasStashedPrompt: stashedPrompt() !== undefined,
    });

  // SSR renders "manual" deterministically; hydration replaces it with the
  // device's real state. Guard on `document`, NOT `navigator` — Deno
  // defines a navigator global on the server.
  state.value = typeof document === "undefined" ? "manual" : detect();

  if (typeof document !== "undefined") {
    addEventListener(INSTALL_READY_EVENT, () => (state.value = detect()));
    addEventListener("appinstalled", () => (state.value = "installed"));
  }

  const promptInstall = async (): Promise<PromptOutcome> => {
    const ev = stashedPrompt();
    if (!ev) return "failed";
    busy.value = true;
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      // The event is single-use — drop the stash whatever the outcome.
      delete (globalThis as Record<string, unknown>)[STASH_KEY];
      state.value = choice.outcome === "accepted" ? "installed" : detect();
      return choice.outcome;
    } catch (err) {
      console.error("[install] prompt failed", err);
      return "failed";
    } finally {
      busy.value = false;
    }
  };

  return { state, busy, promptInstall };
}
```

- [ ] **Step 5: Refactor `islands/shell/usePushNotifications.ts` onto the shared probes**

Add to its imports:

```ts
import {
  isIosDevice,
  isStandaloneDisplay,
} from "@/islands/shell/platform.ts";
```

Replace the whole `iosNeedsInstall` function (currently lines 23-32,
including its doc comment) with:

```ts
/** iOS only allows push in an installed PWA (16.4+). */
function iosNeedsInstall(): boolean {
  return isIosDevice() && !isStandaloneDisplay();
}
```

Nothing else in the file changes.

- [ ] **Step 6: Run the test to verify it passes**

Run: `deno test --unstable-kv -A islands/shell/useInstallPrompt.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 7: Full suite, check, commit**

```bash
deno task test
deno task check
git add islands/shell/platform.ts islands/shell/useInstallPrompt.ts islands/shell/useInstallPrompt.test.ts islands/shell/usePushNotifications.ts
git commit -m "feat(pwa): add install-prompt state hook and shared platform probes"
```

---

### Task 2: InstallGuidance content component

**Files:**

- Create: `components/shell/InstallGuidance.tsx` (new directory
  `components/shell/` — first file in it)
- Test: `tests/install-guidance.test.tsx` (create)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `InstallGuidance({ variant }: { variant: "ios" | "generic" })` —
  a named export, purely presentational (no hooks, no globals).

- [ ] **Step 1: Write the failing test**

Create `tests/install-guidance.test.tsx`:

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";

Deno.test("InstallGuidance — iOS variant walks through the share sheet", () => {
  const html = render(h(InstallGuidance, { variant: "ios" }));
  assertStringIncludes(html, "Share");
  assertStringIncludes(html, "Add to Home Screen");
  assertStringIncludes(html, "<ol");
});

Deno.test("InstallGuidance — generic variant points at the browser menu", () => {
  const html = render(h(InstallGuidance, { variant: "generic" }));
  assertStringIncludes(html, "Install app");
  assertStringIncludes(html, "Add to Home Screen");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A tests/install-guidance.test.tsx`

Expected: FAIL — module `@/components/shell/InstallGuidance.tsx` not found.

- [ ] **Step 3: Create `components/shell/InstallGuidance.tsx`**

```tsx
interface InstallGuidanceProps {
  variant: "ios" | "generic";
}

/**
 * Step-by-step "add Happie to your home screen" instructions. Purely
 * presentational — the Chromium one-tap install button lives in
 * islands/shell/InstallSetting.tsx, not here.
 */
export function InstallGuidance({ variant }: InstallGuidanceProps) {
  if (variant === "generic") {
    return (
      <div class="md-body-medium text-on-surface-variant">
        Open your browser's menu and look for <b>Install app</b> or{" "}
        <b>Add to Home Screen</b>.
      </div>
    );
  }
  return (
    <ol
      class="flex flex-col gap-2 md-body-medium text-on-surface-variant list-decimal"
      style={{ paddingLeft: "20px" }}
    >
      <li>
        Tap the <b>Share</b> button (the square with an arrow) in Safari's
        toolbar.
      </li>
      <li>
        Scroll down and tap <b>Add to Home Screen</b>.
      </li>
      <li>
        Tap <b>Add</b> — Happie gets its own icon and opens full screen, with
        reminders available.
      </li>
    </ol>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --unstable-kv -A tests/install-guidance.test.tsx`

Expected: PASS — 2 tests.

- [ ] **Step 5: Full suite, check, commit**

```bash
deno task test
deno task check
git add components/shell/InstallGuidance.tsx tests/install-guidance.test.tsx
git commit -m "feat(pwa): add install guidance content component"
```

---

### Task 3: InstallSetting row in the More sheet

**Files:**

- Modify: `components/md3/Icon.tsx` (add a `download` icon)
- Create: `islands/shell/InstallSetting.tsx`
- Modify: `islands/shell/MoreSheet.tsx` (import + render the row)
- Test: `tests/install-setting.test.tsx` (create)

**Interfaces:**

- Consumes: `useInstallPrompt` / `InstallState` from Task 1 (signature in
  Task 1's Produces); `InstallGuidance({ variant })` from Task 2; existing
  MD3 `Sheet` (`open`, `onClose`, `title` props), `ListItem` (`leading`,
  `headline`, `trailing`, `onClick`), `Button`
  (`variant`, `full`, `loading`, `onClick`), `Icon` (`name`, `size`).
- Produces: default export `InstallSetting({ onOpen }: { onOpen?: () =>
  void })`.

- [ ] **Step 1: Write the failing test**

Create `tests/install-setting.test.tsx`:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import InstallSetting from "@/islands/shell/InstallSetting.tsx";

Deno.test("InstallSetting — SSR renders the row deterministically", () => {
  const html = render(h(InstallSetting, {}));
  assertStringIncludes(html, "Install the app");
});

Deno.test("InstallSetting — sheet content is not rendered while closed", () => {
  const html = render(h(InstallSetting, {}));
  assert(
    !html.includes("Install Happie"),
    "promptable button should not render while the sheet is closed",
  );
  assert(
    !html.includes("browser's menu"),
    "guidance should not render while the sheet is closed",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A tests/install-setting.test.tsx`

Expected: FAIL — module `@/islands/shell/InstallSetting.tsx` not found.

- [ ] **Step 3: Add the `download` icon to `components/md3/Icon.tsx`**

Add `| "download"` to the `IconName` union (alphabetical position is not
required — append before `| "expand"`), and add this entry to the `paths`
record (same style as the surrounding stroke-based icons):

```tsx
    download: (
      <>
        <path d="M12 4v10.5" {...p} />
        <path d="M7.5 10.5 12 15l4.5-4.5" {...p} />
        <path d="M5 19.5h14" {...p} />
      </>
    ),
```

- [ ] **Step 4: Create `islands/shell/InstallSetting.tsx`**

```tsx
import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";
import { useInstallPrompt } from "@/islands/shell/useInstallPrompt.ts";

interface Props {
  /** Rendered as the More sheet's row; the sheet closes itself on tap. */
  onOpen?: () => void;
}

/**
 * The durable home for "put Happie on your home screen", reachable from the
 * More sheet. One-tap native install where the browser offers it
 * (Chromium), guided steps everywhere else.
 */
export default function InstallSetting({ onOpen }: Props) {
  const { state, busy, promptInstall } = useMemo(
    () => useInstallPrompt(),
    [],
  );
  const open = useSignal(false);
  const message = useSignal<string | null>(null);

  // The row hides for installed users only after hydration: SSR and the
  // first client render must agree (§11), so the flip waits for mount.
  const mounted = useSignal(false);
  useEffect(() => {
    mounted.value = true;
  }, []);
  if (mounted.value && state.value === "installed" && !open.value) {
    return null;
  }

  // Matches MoreSheet's badge() helper — this row sits among its rows.
  const badge = (
    <span
      class="grid place-items-center bg-primary-container text-on-primary-container rounded-full"
      style={{ width: 40, height: 40 }}
    >
      <Icon name="download" size={20} />
    </span>
  );

  return (
    <>
      <ListItem
        leading={badge}
        headline="Install the app"
        trailing={<Icon name="chevron" size={18} />}
        onClick={() => {
          onOpen?.();
          open.value = true;
        }}
      />

      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Install the app"
      >
        {open.value && (
          <div class="flex flex-col gap-3 pb-1">
            {state.value === "installed" && (
              <div class="md-body-medium text-on-surface-variant">
                Happie is already on your home screen.
              </div>
            )}

            {state.value === "promptable" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Put Happie on your home screen — it opens full screen and
                  feels like a real app.
                </div>
                <Button
                  variant="filled"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const outcome = await promptInstall();
                    message.value = outcome === "accepted"
                      ? "It's on your home screen!"
                      : outcome === "dismissed"
                      ? "Maybe later — you can come back any time."
                      : "That didn't work. Try again?";
                  }}
                >
                  Install Happie
                </Button>
              </>
            )}

            {state.value === "ios-browser" && (
              <InstallGuidance variant="ios" />
            )}

            {state.value === "manual" && (
              <InstallGuidance variant="generic" />
            )}

            {message.value && (
              <div class="md-body-small text-on-surface-variant">
                {message.value}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
```

- [ ] **Step 5: Add the row to `islands/shell/MoreSheet.tsx`**

Add the import (next to the NotificationSetting import):

```tsx
import InstallSetting from "@/islands/shell/InstallSetting.tsx";
```

Directly below the existing `<NotificationSetting onOpen={onClose} />` line,
add:

```tsx
        <InstallSetting onOpen={onClose} />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `deno test --unstable-kv -A tests/install-setting.test.tsx`

Expected: PASS — 2 tests.

- [ ] **Step 7: Full suite, check, commit**

```bash
deno task test
deno task check
git add components/md3/Icon.tsx islands/shell/InstallSetting.tsx islands/shell/MoreSheet.tsx tests/install-setting.test.tsx
git commit -m "feat(pwa): add 'Install the app' entry to the More sheet"
```

---

### Task 4: Guide install from the notifications dead-end

**Files:**

- Modify: `islands/shell/NotificationSetting.tsx:66-71` (the `needs-install`
  branch)

**Interfaces:**

- Consumes: `InstallGuidance` from Task 2.
- Produces: nothing later tasks rely on.

**No unit test for this task** — the `needs-install` branch only renders on
an iOS browser after hydration (the hook's state is `"default"` during SSR,
and the sheet body renders only when opened), so render-to-string cannot
reach it without restructuring working push code, which is out of scope. The
content itself is covered by Task 2's tests; this wiring is verified in
Task 5's browser pass and on-device (`deno task dev:mobile`).

- [ ] **Step 1: Edit the `needs-install` branch**

Add the import:

```tsx
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";
```

Replace:

```tsx
            {state.value === "needs-install" && (
              <div class="md-body-medium text-on-surface-variant">
                Add Happie to your home screen first — on iPhone and iPad,
                notifications only work once the app is installed.
              </div>
            )}
```

with:

```tsx
            {state.value === "needs-install" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Add Happie to your home screen first — on iPhone and iPad,
                  notifications only work once the app is installed.
                </div>
                <InstallGuidance variant="ios" />
              </>
            )}
```

(`needs-install` only occurs on iOS, so the variant is fixed to `"ios"`.)

- [ ] **Step 2: Full suite, check, commit**

```bash
deno task test
deno task check
git add islands/shell/NotificationSetting.tsx
git commit -m "feat(pwa): guide install from the notifications dead-end"
```

---

### Task 5: Stash `beforeinstallprompt` before hydration

**Files:**

- Modify: `routes/_app.tsx` (add the inline stash script to `<Head>`)
- Test: `tests/app-head.test.ts` (extend)

**Interfaces:**

- Consumes: the stash contract from Task 1 — window property
  `__happieInstallPrompt`, event name `happie:install-ready`. The script
  cannot import the hook's constants; the strings are duplicated by design
  and pinned by tests on both sides.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Write the failing test**

Append to `tests/app-head.test.ts`:

```ts
Deno.test("app head — install prompt stash script, unescaped", () => {
  const html = renderApp();
  assertStringIncludes(html, "__happieInstallPrompt");
  assertStringIncludes(html, "happie:install-ready");
  // preact-render-to-string HTML-escapes <script> text children; the
  // script must be emitted via dangerouslySetInnerHTML to stay executable.
  assertStringIncludes(html, 'addEventListener("beforeinstallprompt"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A tests/app-head.test.ts`

Expected: FAIL — the new test (3 existing tests still pass).

- [ ] **Step 3: Add the stash script to `routes/_app.tsx`**

In the `<Head>`, directly below the
`<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` line, add:

```tsx
        {/* Chromium fires beforeinstallprompt once, possibly before islands
            hydrate — stash it. Contract (property + event name) is pinned by
            islands/shell/useInstallPrompt.ts and tests/app-head.test.ts.
            dangerouslySetInnerHTML because render-to-string HTML-escapes
            script text children. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();window.__happieInstallPrompt=e;dispatchEvent(new Event("happie:install-ready"))});',
          }}
        />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --unstable-kv -A tests/app-head.test.ts`

Expected: PASS — 4 tests.

- [ ] **Step 5: Full suite, check, commit**

```bash
deno task test
deno task check
git add routes/_app.tsx tests/app-head.test.ts
git commit -m "feat(pwa): stash beforeinstallprompt before hydration"
```

---

### Task 6: Browser verification + wrap up

**Files:** none (verification only; controller-run — needs the browser pane).

- [ ] **Step 1: Dev server**

Seed + start as in the iteration-1 plan: `.env` with
`SEED_USERNAME`/`SEED_PASSWORD`/`KV_PATH=data/kv.db`, `deno task db:seed`,
launch config `dev-wt` (port 5178), log in via the curl-cookie recipe.

- [ ] **Step 2: Desktop pass (Chromium-like pane)**

- Open the More tab → sheet shows the "Install the app" row between
  "Notifications" and "Switch household".
- Tap the row → the More sheet closes, the install sheet opens. In the pane
  (no real `beforeinstallprompt`), state is `manual` → the generic guidance
  renders ("Open your browser's menu…").
- Console: no errors. `window.__happieInstallPrompt` is `undefined` and
  nothing crashed — the stash script is inert without the event.
- Simulate the Chromium path in the console:

```js
dispatchEvent(Object.assign(new Event("beforeinstallprompt"), {
  prompt: () => Promise.resolve(),
  userChoice: Promise.resolve({ outcome: "accepted" }),
}));
```

  The stash script `preventDefault()`s it, stashes it, and fires
  `happie:install-ready`; with the install sheet open, the content flips to
  the "Install Happie" button. Click it → feedback "It's on your home
  screen!" (accepted outcome). Close the sheet → the "Install the app" row
  is gone (state `installed`).
- Screenshot the install sheet for the PR.

- [ ] **Step 3: Wrap up the branch**

Use the superpowers:finishing-a-development-branch skill. The PR closes #72:

```bash
gh pr create --base main --title "feat(pwa): install guidance — More-sheet entry, Chromium one-tap prompt, iOS steps" --body "Closes #72. Iteration 2 of the PWA roadmap (docs/superpowers/specs/2026-08-08-install-guidance-design.md)."
```

Real-device checks (Android native prompt, iOS share-sheet steps) ride on
`deno task dev:mobile` and are listed in the PR as manual follow-ups.
