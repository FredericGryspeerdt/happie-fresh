# Visual Loading Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users MD3-styled, non-blocking loading feedback for page navigation and in-flight CRUD, delivered as reusable primitives.

**Architecture:** A module-scope signal channel (`utils/loading.ts`) mirrors the existing `utils/app-bar.ts` cross-island pattern. A single `GlobalLoadingBar` island in the app shell renders a wavy indeterminate MD3 bar, driven by a `navPending` signal (set via centralized click interception + a `navigateTo()` helper) and a `busyCount` signal (fed by the existing optimistic-mutation hooks). Two small primitives — a circular `Spinner` and a `loading` state on `Button` — cover awaited actions. CRUD stays optimistic; nothing blocks.

**Tech Stack:** Deno, Fresh 2 (SSR + Islands), Preact, `@preact/signals`, Tailwind CSS v4, Deno KV. Tests: `preact-render-to-string` + `jsr:@std/assert`.

## Global Constraints

- **Imports:** use the `@/` alias for project root (e.g. `import { navPending } from "@/utils/loading.ts"`).
- **JSX:** Preact with `jsx: "precompile"` — always `class`, never `className`.
- **Signals:** module-scope `signal()` ONLY in `utils/*` (never in a component body); inside islands/components use `useSignal()` / `useSignalEffect()`.
- **Styling:** Tailwind semantic utilities backed by `--md-*` tokens (`bg-primary`, `text-on-surface-variant`, `bg-primary-container`, `rounded-[var(--md-shape-full)]`); motion easing `var(--md-emphasized)`.
- **Islands rule:** only `islands/*` hydrate. Presentational primitives live in `components/md3/`. `GlobalLoadingBar` must be an island (installs listeners + reactive reads).
- **Tests:** mirror `components/md3/*.test.tsx` — `render(h(Component, props, children))` + `assertStringIncludes`. There is NO DOM/jsdom test environment; SSR-render assertions + pure-function tests only. Interactive/timer behavior is verified in the browser preview.
- **Verification gate:** `deno task check` (`deno fmt --check && deno lint && deno check`) must be green before every commit. Run `deno fmt` first to auto-format.
- **Commits:** Conventional Commits. Scope `feat(loading)` / `feat(md3)` as appropriate.
- **Discipline:** DRY, YAGNI, TDD, frequent commits.
- **Out of scope (do NOT build):** skeleton loaders, the full MD3 morphing indicator, any client router/Partials, any API/repository/model change.

## File Structure

- `utils/loading.ts` — **new.** Module-scope `navPending` + `busyCount` signals; `navigateTo`/`reloadPage`/`beginBusy`/`endBusy` helpers; pure `shouldInterceptNav()`. Sole owner of loading state; the cross-island channel.
- `utils/loading.test.ts` — **new.** Unit tests for the helpers + `shouldInterceptNav`.
- `components/md3/Spinner.tsx` (+ `.test.tsx`) — **new.** Circular indeterminate spinner primitive.
- `components/md3/Button.tsx` (+ `.test.tsx`) — **modify.** Add `loading` prop.
- `islands/shell/GlobalLoadingBar.tsx` (+ `.test.tsx`) — **new.** The wavy bar island; installs nav interception; reads `utils/loading.ts`.
- `assets/styles.css` — **modify.** New keyframes (`md-spin`, `md-loadbar-travel`, `md-loadbar-pulse`) + `.md-loadbar-track` / `.md-loadbar-wave` classes.
- `islands/shell/AppChrome.tsx` — **modify.** Mount `GlobalLoadingBar` (including full-screen `mode:"none"` routes).
- `islands/shell/NavigationBar.tsx`, `islands/shell/MoreSheet.tsx`, `islands/shopping-lists.tsx`, `islands/catalogue.tsx`, `islands/items.tsx` — **modify.** Route imperative navigations through `navigateTo`/`reloadPage`.
- `hooks/useShoppingList.ts`, `hooks/useCatalogue.ts` — **modify.** Feed `busyCount`; `useShoppingList` also gains a `savingIds` signal for the "Saving…" phase.
- `islands/shopping-lists.tsx` — **modify.** Create-list button `loading` state.
- `islands/items.tsx` — **modify.** "Saving…" branch in the editor pill.

---

### Task 1: Shared loading state — `utils/loading.ts`

**Files:**
- Create: `utils/loading.ts`
- Test: `utils/loading.test.ts`

**Interfaces:**
- Consumes: `signal` from `@preact/signals`.
- Produces:
  - `navPending: Signal<boolean>` — a navigation is in flight.
  - `busyCount: Signal<number>` — count of in-flight background mutations.
  - `navigateTo(url: string): void` — set `navPending`, then assign `location.href`.
  - `reloadPage(): void` — set `navPending`, then `location.reload()`.
  - `beginBusy(): void` / `endBusy(): void` — increment / decrement `busyCount` (floored at 0).
  - `shouldInterceptNav(opts: { href: string | null; target?: string | null; download?: boolean; modified?: boolean; currentHref: string }): boolean` — pure decision for whether a link click is an internal navigation worth showing the bar for.

- [ ] **Step 1: Write the failing tests**

Create `utils/loading.test.ts`:

```tsx
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  beginBusy,
  busyCount,
  endBusy,
  navigateTo,
  navPending,
  shouldInterceptNav,
} from "./loading.ts";

Deno.test("beginBusy/endBusy balance busyCount and floor at zero", () => {
  busyCount.value = 0;
  beginBusy();
  beginBusy();
  assertEquals(busyCount.value, 2);
  endBusy();
  endBusy();
  endBusy(); // extra end must not go negative
  assertEquals(busyCount.value, 0);
});

Deno.test("navigateTo sets navPending (nav is a no-op without a DOM location)", () => {
  navPending.value = false;
  navigateTo("/shopping");
  assert(navPending.value);
});

Deno.test("shouldInterceptNav — internal same-origin link is intercepted", () => {
  assert(shouldInterceptNav({
    href: "/shopping/123",
    currentHref: "https://app.test/shopping",
  }));
});

Deno.test("shouldInterceptNav — external, _blank, download, modified, hash are ignored", () => {
  const cur = "https://app.test/shopping";
  assert(!shouldInterceptNav({ href: "https://other.test/x", currentHref: cur }));
  assert(!shouldInterceptNav({ href: "/x", target: "_blank", currentHref: cur }));
  assert(!shouldInterceptNav({ href: "/x", download: true, currentHref: cur }));
  assert(!shouldInterceptNav({ href: "/x", modified: true, currentHref: cur }));
  assert(!shouldInterceptNav({ href: null, currentHref: cur }));
  assert(!shouldInterceptNav({
    href: "/shopping#top",
    currentHref: cur,
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test -A utils/loading.test.ts`
Expected: FAIL — `Module not found "./loading.ts"`.

- [ ] **Step 3: Write the implementation**

Create `utils/loading.ts`:

```ts
import { signal } from "@preact/signals";

/**
 * Cross-island loading state. Module-scope signals are the sanctioned shared-state
 * channel in this app (see utils/app-bar.ts). A full-page navigation resets them for free.
 */

/** True while a full-page navigation is in flight. */
export const navPending = signal(false);

/** Number of in-flight background mutations (optimistic CRUD). */
export const busyCount = signal(0);

/** Increment the in-flight mutation counter. */
export function beginBusy(): void {
  busyCount.value++;
}

/** Decrement the in-flight mutation counter (never below zero). */
export function endBusy(): void {
  busyCount.value = Math.max(0, busyCount.value - 1);
}

/** Show the nav indicator, then navigate. Nav is skipped when there is no DOM (tests). */
export function navigateTo(url: string): void {
  navPending.value = true;
  if (typeof location !== "undefined" && location) location.href = url;
}

/** Show the nav indicator, then reload. */
export function reloadPage(): void {
  navPending.value = true;
  if (typeof location !== "undefined" && location) location.reload();
}

/** Pure decision: should a link click show the navigation indicator? */
export function shouldInterceptNav(opts: {
  href: string | null;
  target?: string | null;
  download?: boolean;
  modified?: boolean;
  currentHref: string;
}): boolean {
  const { href, target, download, modified, currentHref } = opts;
  if (!href) return false;
  if (modified) return false;
  if (download) return false;
  if (target && target !== "_self") return false;
  let url: URL;
  let cur: URL;
  try {
    cur = new URL(currentHref);
    url = new URL(href, currentHref);
  } catch {
    return false;
  }
  if (url.origin !== cur.origin) return false; // external
  if (url.href === cur.href) return false; // no-op
  // same page, only a hash change → let the browser handle it, no full load
  if (url.pathname === cur.pathname && url.search === cur.search && url.hash) {
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test -A utils/loading.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
deno fmt && deno task check
git add utils/loading.ts utils/loading.test.ts
git commit -m "feat(loading): add cross-island loading state channel"
```

---

### Task 2: `Spinner` primitive

**Files:**
- Create: `components/md3/Spinner.tsx`
- Test: `components/md3/Spinner.test.tsx`
- Modify: `assets/styles.css` (add `@keyframes md-spin`)

**Interfaces:**
- Consumes: `cn` from `@/components/md3/tokens.ts`.
- Produces: `Spinner({ size?: number; color?: string; class?: string; "aria-label"?: string })` — a circular indeterminate MD3 spinner inheriting `currentColor` by default.

- [ ] **Step 1: Write the failing tests**

Create `components/md3/Spinner.test.tsx`:

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Spinner } from "./Spinner.tsx";

Deno.test("Spinner — renders status role and a default Loading label", () => {
  const html = render(h(Spinner, {}));
  assertStringIncludes(html, 'role="status"');
  assertStringIncludes(html, "Loading");
});

Deno.test("Spinner — applies a custom size", () => {
  const html = render(h(Spinner, { size: 40 }));
  assertStringIncludes(html, "40px");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test -A components/md3/Spinner.test.tsx`
Expected: FAIL — `Module not found "./Spinner.tsx"`.

- [ ] **Step 3: Add the spin keyframe**

In `assets/styles.css`, after the existing `@keyframes md-saved-flash` block (near the end of the file), add:

```css
/* Circular indeterminate spinner (issue #32) */
@keyframes md-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: Write the component**

Create `components/md3/Spinner.tsx`:

```tsx
// components/md3/Spinner.tsx
import { cn } from "./tokens.ts";

interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  /** Any CSS color; defaults to currentColor so it inherits text color. */
  color?: string;
  class?: string;
  "aria-label"?: string;
}

export function Spinner(
  { size = 20, color = "currentColor", class: cls, ...rest }: SpinnerProps,
) {
  const label = rest["aria-label"] ?? "Loading";
  const borderWidth = Math.max(2, Math.round(size / 10));
  return (
    <span role="status" class={cn("inline-block align-middle", cls)}>
      <span
        class="block rounded-[var(--md-shape-full)]"
        style={{
          width: size,
          height: size,
          borderWidth,
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
          borderTopColor: color,
          animation: "md-spin 0.7s linear infinite",
        }}
      />
      <span class="sr-only">{label}</span>
    </span>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test -A components/md3/Spinner.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
deno fmt && deno task check
git add components/md3/Spinner.tsx components/md3/Spinner.test.tsx assets/styles.css
git commit -m "feat(md3): add circular indeterminate Spinner primitive"
```

---

### Task 3: `Button` `loading` state

**Files:**
- Modify: `components/md3/Button.tsx`
- Test: `components/md3/Button.test.tsx`

**Interfaces:**
- Consumes: `Spinner` from `@/components/md3/Spinner.tsx`.
- Produces: `Button` gains `loading?: boolean`. When `loading`, the button renders a leading `Spinner` (in place of any `icon`), is force-disabled, and keeps its label.

- [ ] **Step 1: Add a failing test**

Append to `components/md3/Button.test.tsx`:

```tsx
import { Spinner } from "./Spinner.tsx"; // ensure module resolves

Deno.test("Button — loading renders a spinner and disabled styling", () => {
  const html = render(h(Button, { loading: true }, "Save"));
  assertStringIncludes(html, 'role="status"'); // the spinner
  assertStringIncludes(html, "38%"); // disabled text mix (color-mix ... 38%)
  assertStringIncludes(html, "Save");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test -A components/md3/Button.test.tsx`
Expected: FAIL — no `role="status"` in output (loading not yet implemented).

- [ ] **Step 3: Implement the loading state**

In `components/md3/Button.tsx`:

1. Add the import after the existing imports:

```tsx
import { Spinner } from "./Spinner.tsx";
```

2. Add `loading` to `ButtonProps` (after `disabled?: boolean;`):

```tsx
  disabled?: boolean;
  loading?: boolean;
```

3. Destructure it in the signature (after `disabled,`):

```tsx
    disabled,
    loading,
```

4. Replace the `Pressable` body. Change the `onClick`/`disabled` and the disabled-class check to use a combined `isDisabled`, and swap the leading glyph. The full updated component body:

```tsx
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onClick={onClick}
      disabled={isDisabled}
      class={cn(
        "md-label-large inline-flex items-center justify-center gap-2 h-10 rounded-[var(--md-shape-full)] whitespace-nowrap",
        icon || loading ? "pl-4 pr-[22px]" : "px-6",
        full ? "w-full" : "w-auto",
        isDisabled
          ? "bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]"
          : VARIANT[variant],
        cls,
      )}
      style={style}
    >
      {loading
        ? <Spinner size={18} />
        : icon && <Icon name={icon} size={18} />}
      {children}
    </Pressable>
  );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test -A components/md3/Button.test.tsx`
Expected: PASS (all Button tests, including the original filled-variant test).

- [ ] **Step 5: Commit**

```bash
deno fmt && deno task check
git add components/md3/Button.tsx components/md3/Button.test.tsx
git commit -m "feat(md3): add loading state to Button"
```

---

### Task 4: `GlobalLoadingBar` island + wavy bar styles

**Files:**
- Create: `islands/shell/GlobalLoadingBar.tsx`
- Test: `islands/shell/GlobalLoadingBar.test.tsx`
- Modify: `assets/styles.css` (wavy bar keyframes + classes)

**Interfaces:**
- Consumes: `navPending`, `busyCount`, `shouldInterceptNav` from `@/utils/loading.ts`; `useSignal`/`useSignalEffect` from `@preact/signals`; `useEffect`/`useRef` from `preact/hooks`.
- Produces: default-exported `GlobalLoadingBar()` island. Renders a fixed top wavy bar; visible when `navPending` OR a >200ms background write is in flight (with a 400ms minimum visible duration). Installs a document `click` listener (internal-link interception) and a `pageshow` handler (bfcache reset).

- [ ] **Step 1: Add the wavy bar styles**

In `assets/styles.css`, after the `@keyframes md-spin` block from Task 2, add:

```css
/* Global navigation/CRUD loading bar — wavy indeterminate (issue #32) */
@keyframes md-loadbar-travel {
  from {
    -webkit-mask-position: 0 center;
    mask-position: 0 center;
  }
  to {
    -webkit-mask-position: 24px center;
    mask-position: 24px center;
  }
}
@keyframes md-loadbar-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.md-loadbar-track {
  height: 6px;
  background: var(--md-primary-container);
  overflow: hidden;
}
.md-loadbar-wave {
  height: 100%;
  background: var(--md-primary);
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='6'><path d='M0 3 Q 6 0 12 3 T 24 3' fill='none' stroke='black' stroke-width='3'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='6'><path d='M0 3 Q 6 0 12 3 T 24 3' fill='none' stroke='black' stroke-width='3'/></svg>");
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
  -webkit-mask-size: 24px 6px;
  mask-size: 24px 6px;
  animation: md-loadbar-travel 0.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .md-loadbar-wave {
    animation: md-loadbar-pulse 1.4s ease-in-out infinite;
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `islands/shell/GlobalLoadingBar.test.tsx` (SSR renders with effects NOT run, so the bar starts hidden but present):

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import GlobalLoadingBar from "./GlobalLoadingBar.tsx";

Deno.test("GlobalLoadingBar — renders a progressbar region, hidden by default", () => {
  const html = render(h(GlobalLoadingBar, {}));
  assertStringIncludes(html, 'role="progressbar"');
  assertStringIncludes(html, "md-loadbar-track");
  assertStringIncludes(html, 'aria-hidden="true"'); // not visible until a load starts
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `deno test -A islands/shell/GlobalLoadingBar.test.tsx`
Expected: FAIL — `Module not found "./GlobalLoadingBar.tsx"`.

- [ ] **Step 4: Write the island**

Create `islands/shell/GlobalLoadingBar.tsx`:

```tsx
import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { busyCount, navPending, shouldInterceptNav } from "@/utils/loading.ts";

const SHOW_DELAY_MS = 200; // don't flash the bar for fast optimistic writes
const MIN_VISIBLE_MS = 400; // once shown, stay up long enough to be seen

/**
 * The app's single global loading indicator. Shows immediately for navigation
 * (navPending) and, after a short delay, for background CRUD (busyCount) — with a
 * minimum visible duration so quick writes don't flicker. Mounted once by AppChrome.
 */
export default function GlobalLoadingBar() {
  const busyVisible = useSignal(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const shownAt = useRef(0);

  // Map busyCount → busyVisible with the show-delay / min-visible timing.
  useSignalEffect(() => {
    const active = busyCount.value > 0;
    if (active) {
      if (hideTimer.current !== undefined) {
        clearTimeout(hideTimer.current);
        hideTimer.current = undefined;
      }
      if (!busyVisible.peek() && showTimer.current === undefined) {
        showTimer.current = setTimeout(() => {
          busyVisible.value = true;
          shownAt.current = Date.now();
          showTimer.current = undefined;
        }, SHOW_DELAY_MS);
      }
    } else {
      if (showTimer.current !== undefined) {
        clearTimeout(showTimer.current);
        showTimer.current = undefined;
      }
      if (busyVisible.peek() && hideTimer.current === undefined) {
        const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
        hideTimer.current = setTimeout(() => {
          busyVisible.value = false;
          hideTimer.current = undefined;
        }, wait);
      }
    }
  });

  // Centralized navigation interception (internal links) + bfcache reset.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
        e.button !== 0;
      if (
        shouldInterceptNav({
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          modified,
          currentHref: location.href,
        })
      ) {
        navPending.value = true;
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) navPending.value = false; // restored from bfcache
    };
    document.addEventListener("click", onClick);
    globalThis.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      globalThis.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const visible = navPending.value || busyVisible.value;

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-hidden={visible ? undefined : "true"}
      class="fixed left-0 right-0 z-50 pointer-events-none"
      style={{
        top: 0,
        paddingTop: "env(safe-area-inset-top)",
        opacity: visible ? 1 : 0,
        transition: "opacity .2s var(--md-emphasized)",
      }}
    >
      <div class="md-loadbar-track">
        <div class="md-loadbar-wave" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `deno test -A islands/shell/GlobalLoadingBar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
deno fmt && deno task check
git add islands/shell/GlobalLoadingBar.tsx islands/shell/GlobalLoadingBar.test.tsx assets/styles.css
git commit -m "feat(loading): add GlobalLoadingBar island with wavy indeterminate bar"
```

---

### Task 5: Mount the bar + route imperative navigations

Wires the bar into the shell and makes every JS-driven navigation raise `navPending`. Declarative `<a href>` links are handled automatically by the click listener from Task 4, so they need no edits.

**Files:**
- Modify: `islands/shell/AppChrome.tsx`
- Modify: `islands/shell/NavigationBar.tsx`
- Modify: `islands/shell/MoreSheet.tsx`
- Modify: `islands/shopping-lists.tsx`
- Modify: `islands/catalogue.tsx`
- Modify: `islands/items.tsx`

**Interfaces:**
- Consumes: `navigateTo`, `reloadPage` from `@/utils/loading.ts`; `GlobalLoadingBar` from `@/islands/shell/GlobalLoadingBar.tsx`.

- [ ] **Step 1: Mount `GlobalLoadingBar` in `AppChrome`**

In `islands/shell/AppChrome.tsx`:

1. Add the import:

```tsx
import GlobalLoadingBar from "./GlobalLoadingBar.tsx";
```

2. Render the bar even on full-screen routes — change the early return:

```tsx
  if (appBar?.mode === "none") return <GlobalLoadingBar />;
```

3. Add the bar as the first child of the main fragment (immediately after the opening `<>`):

```tsx
  return (
    <>
      <GlobalLoadingBar />
      {detail
        ? (
```

- [ ] **Step 2: Route the bottom nav through `navigateTo`**

In `islands/shell/NavigationBar.tsx`, add the import and replace the imperative nav:

```tsx
import { navigateTo } from "@/utils/loading.ts";
```

Change (line ~19):

```tsx
    if (it.id === "more") onMore();
    else navigateTo(it.defaultRoute);
```

- [ ] **Step 3: Route MoreSheet's "Shopping" link**

In `islands/shell/MoreSheet.tsx`, add `import { navigateTo } from "@/utils/loading.ts";` and replace `globalThis.location.href = "/shopping";` (line ~42) with `navigateTo("/shopping");`. (The `<a href>` logout/module links are covered by the click listener — leave them.)

- [ ] **Step 4: Route the Lists index navigations**

In `islands/shopping-lists.tsx`, add `import { navigateTo } from "@/utils/loading.ts";` and replace:

- Segmented → Catalogue (line ~73):

```tsx
          onChange={(k) => {
            if (k === "catalogue") navigateTo("/shopping/catalogue");
          }}
```

- Open a list (line ~113):

```tsx
                onClick={() => {
                  navigateTo(`/shopping/${list.id}`);
                }}
```

- [ ] **Step 5: Route the Catalogue segmented nav**

In `islands/catalogue.tsx`, add `import { navigateTo } from "@/utils/loading.ts";` and replace `if (k === "lists") globalThis.location.href = "/shopping";` (line ~124) with `if (k === "lists") navigateTo("/shopping");`.

- [ ] **Step 6: Route the List-detail navigations**

In `islands/items.tsx`, add `import { navigateTo, reloadPage } from "@/utils/loading.ts";` and replace:

- Both rename reloads (lines ~452 and ~465): `globalThis.location.reload();` → `reloadPage();`
- Delete redirect (line ~524): `globalThis.location.href = "/shopping";` → `navigateTo("/shopping");`

- [ ] **Step 7: Verify with the browser preview**

Run: `deno task check` (expected: green).

Then start the dev server (via the preview tool, `deno task dev`), throttle the network to a slow profile, and confirm:
- Tapping a bottom-nav tab, opening a list, and switching Lists↔Catalogue each show the wavy bar during the SSR round-trip; the bar is gone once the new page paints.
- Browser back (bfcache) does not leave the bar stuck on.
- A normal external/`target=_blank` link (if any) does not trigger the bar.

- [ ] **Step 8: Commit**

```bash
deno fmt && deno task check
git add islands/shell/AppChrome.tsx islands/shell/NavigationBar.tsx islands/shell/MoreSheet.tsx islands/shopping-lists.tsx islands/catalogue.tsx islands/items.tsx
git commit -m "feat(loading): show navigation indicator on page transitions"
```

---

### Task 6: Feed `busyCount` from the CRUD hooks

Surfaces the already-maintained-but-unused in-flight counters into the global bar, so background writes show the bar (after the anti-flicker delay).

**Files:**
- Modify: `hooks/useShoppingList.ts`
- Modify: `hooks/useCatalogue.ts`

**Interfaces:**
- Consumes: `beginBusy`, `endBusy` from `@/utils/loading.ts`.

- [ ] **Step 1: Bridge `useShoppingList`'s counter**

In `hooks/useShoppingList.ts`:

1. Add the import near the top (with the other `@/` imports):

```ts
import { beginBusy, endBusy } from "@/utils/loading.ts";
```

2. Immediately after `const pendingCount = signal<number>(0);`, add two helpers:

```ts
  // Mirror each in-flight mutation into the global loading bar.
  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };
```

3. Replace every `pendingCount.value++;` with `startPending();` and every `pendingCount.value--;` with `endPending();` in this file (they appear in `addToList`, `addToCatalog`, `removeListItem`, `checkItem`, `uncheckItem`, and `refresh` — all inside `try`/`finally` pairs, so the balance is preserved).

- [ ] **Step 2: Bridge `useCatalogue`'s counter**

In `hooks/useCatalogue.ts`, apply the identical change: add the `beginBusy`/`endBusy` import, define `startPending`/`endPending` right after its `const pendingCount = signal<number>(0);`, and replace every `pendingCount.value++;`/`pendingCount.value--;` accordingly.

- [ ] **Step 3: Verify with the browser preview**

Run: `deno task check` (expected: green).

In the preview with a slow network profile:
- Add an item / delete an item on the list detail: the wavy bar appears (after ~200ms) and clears when the write resolves.
- A fast local check/uncheck does NOT flash the bar (sub-200ms writes stay invisible).

- [ ] **Step 4: Commit**

```bash
deno fmt && deno task check
git add hooks/useShoppingList.ts hooks/useCatalogue.ts
git commit -m "feat(loading): reflect in-flight CRUD in the global bar"
```

---

### Task 7: Create-list button busy state

The create-list flow calls the API directly (not through the hooks), so it is NOT covered by `busyCount`. It already has a `loading` signal that only disables the button; now render it with the new `Button` `loading` prop.

**Files:**
- Modify: `islands/shopping-lists.tsx`

**Interfaces:**
- Consumes: `Button` `loading` prop (Task 3). The `loading` signal already exists in this island.

- [ ] **Step 1: Render the busy state**

In `islands/shopping-lists.tsx`, update the create-list `Button` (lines ~181–188) to pass `loading`:

```tsx
          <Button
            variant="filled"
            full
            onClick={createList}
            loading={loading.value}
          >
            Add
          </Button>
```

(The `loading` prop force-disables the button, so the separate `disabled` prop is no longer needed.)

- [ ] **Step 2: Verify with the browser preview**

Run: `deno task check` (expected: green).

In the preview: open the "New list" sheet, type a name, tap **Add** — the button shows the inline spinner and is disabled until the list is created and the sheet closes.

- [ ] **Step 3: Commit**

```bash
deno fmt && deno task check
git add islands/shopping-lists.tsx
git commit -m "feat(loading): show a busy spinner while creating a list"
```

---

### Task 8: "Saving…" phase for debounced edits

Completes the existing "Saved" affordance: while a debounced qty/note write is pending, the editor pill shows "Saving…", flipping to "Saved" on flush. Debounced writes are intentionally excluded from `busyCount` (per the spec), so this is driven by a dedicated signal.

**Files:**
- Modify: `hooks/useShoppingList.ts`
- Modify: `islands/items.tsx`

**Interfaces:**
- Produces (from `useShoppingList`): `savingIds: Signal<Set<string>>` — ids of list items with a debounced write pending.
- Consumes (in `items.tsx`): `savingIds` + the `Spinner` primitive.

- [ ] **Step 1: Track pending debounced writes in the hook**

In `hooks/useShoppingList.ts`:

1. After `const lastSaved = signal<number>(0);`, add:

```ts
  // Ids of list items whose debounced write hasn't flushed yet (drives "Saving…").
  const savingIds = signal<Set<string>>(new Set());
  const markSaving = (id: string) => {
    if (savingIds.value.has(id)) return;
    const next = new Set(savingIds.value);
    next.add(id);
    savingIds.value = next;
  };
  const clearSaving = (id: string) => {
    if (!savingIds.value.has(id)) return;
    const next = new Set(savingIds.value);
    next.delete(id);
    savingIds.value = next;
  };
```

2. In the `patchScheduler` `flush` callback, clear the id when the write lands:

```ts
    flush: async (id, patch) => {
      await api.shoppingList.updateItem(listId, id, patch);
      clearSaving(id);
      lastSaved.value = lastSaved.value + 1;
    },
```

3. In `updateListItem`, mark the id as saving when a debounced write is scheduled:

```ts
  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ) => {
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    markSaving(id);
    patchScheduler.schedule(id, patch);
  };
```

4. In `removeListItem` and `checkItem`, alongside each `patchScheduler.cancel(id);`, also clear the saving flag:

```ts
    patchScheduler.cancel(id);
    clearSaving(id);
```

5. Add `savingIds` to the returned object (next to `lastSaved`):

```ts
    lastSaved,
    savingIds,
    flushListItem,
```

- [ ] **Step 2: Show "Saving…" in the editor pill**

In `islands/items.tsx`:

1. Add `savingIds` to the hook destructure (next to `lastSaved`):

```ts
    lastSaved,
    savingIds,
    flushListItem,
```

2. Add the Spinner import (with the other `@/components/md3` imports):

```tsx
import { Spinner } from "@/components/md3/Spinner.tsx";
```

3. Replace the pill block (lines ~574–583) so "Saving…" takes precedence over "Saved":

```tsx
              <div class="h-6 flex justify-end items-center px-1">
                {savingIds.value.has(li.id!)
                  ? (
                    <span class="inline-flex items-center gap-1.5 md-label-medium text-on-surface-variant">
                      <Spinner size={12} /> Saving…
                    </span>
                  )
                  : showSaved && (
                    <span
                      key={savedTick}
                      class="md-saved-flash inline-flex items-center gap-1 md-label-medium text-on-tertiary-container bg-tertiary-container rounded-full px-2.5 py-0.5 pointer-events-none"
                    >
                      <Icon name="check" size={14} /> Saved
                    </span>
                  )}
              </div>
```

- [ ] **Step 3: Verify with the browser preview**

Run: `deno task check` (expected: green).

In the preview: open an item editor, change the quantity or note — the pill shows a small spinner + "Saving…" during the ~500ms debounce, then flips to the "Saved" flash once the write lands.

- [ ] **Step 4: Commit**

```bash
deno fmt && deno task check
git add hooks/useShoppingList.ts islands/items.tsx
git commit -m "feat(loading): show a Saving… phase before the Saved pill"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-23-loading-feedback-design.md`):

- §2 global nav indicator → Tasks 4, 5. ✅
- §2 reusable `Spinner` → Task 2. ✅
- §2 `Button` busy state → Task 3 (+ wired in Task 7). ✅
- §2 shared state module `utils/loading.ts` → Task 1. ✅
- §2 surface unused `pendingCount` → Task 6. ✅
- §2 / §6.4 "Saving…/Saved" consistency → Task 8. ✅
- §5 wavy bar + circular spinner + reduced-motion + a11y roles → Tasks 2, 4. ✅
- §6.1 centralized interception (click listener + `navigateTo` + `pageshow`) → Tasks 1, 4, 5. ✅
- §6.2 non-blocking background CRUD w/ 200ms delay + 400ms min → Tasks 4, 6. ✅
- §6.3 awaited-action button-busy (create list) → Task 7. ✅
- §4 mount in `AppChrome`, including `mode:"none"` full-screen routes → Task 5 Step 1. ✅
- D5 skeletons dropped → no task, by design. ✅
- §8 error handling: `endBusy` in hook `finally`; `busyCount` floored at 0 (Task 1); bfcache reset (Task 4). ✅

No spec requirement is left without a task.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step contains complete code. ✅

**Type consistency:** `navPending`, `busyCount`, `navigateTo`, `reloadPage`, `beginBusy`, `endBusy`, `shouldInterceptNav` are defined in Task 1 and consumed with matching signatures in Tasks 4, 5, 6. `Spinner` (Task 2) props match its uses in Tasks 3 and 8. `Button.loading` (Task 3) matches its use in Task 7. `savingIds: Signal<Set<string>>` defined in Task 8 Step 1 and read as `savingIds.value.has(...)` in Step 2. ✅

**Note on testing:** interception timing and DOM listeners are verified in the browser preview (Tasks 5–8), consistent with the repo's SSR-only test harness; pure logic (`shouldInterceptNav`, the signal helpers) and SSR output (Spinner, Button, GlobalLoadingBar) are unit-tested.
