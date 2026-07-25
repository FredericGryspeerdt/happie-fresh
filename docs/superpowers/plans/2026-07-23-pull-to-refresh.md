# Pull-to-Refresh Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, MD3-consistent pull-to-refresh primitive and wire it into the three shopping data pages, each with its own refresh behaviour.

**Architecture:** A DOM-free gesture state machine (`hooks/usePullToRefresh.ts`, `signal()`-based factory like `useShoppingList`) drives a presentational wrapper (`components/md3/PullToRefresh.tsx`) that owns touch listeners, a Material-style overlay indicator puck, and an internal error Snackbar. The indicator overlays static content (it does **not** transform the page), so the wrapper can safely enclose fixed overlays/FABs/sheets. Pages pass an `onRefresh` callback and a `disabled` flag.

**Tech Stack:** Deno + Fresh 2 (Islands) + Preact + `@preact/signals` + Tailwind CSS v4. Tests via `deno test` (`@std/assert`, `@std/testing` `stub`/`FakeTime`, `preact-render-to-string`).

## Global Constraints

- **Imports:** use the `@/` alias (e.g. `import { Icon } from "@/components/md3/Icon.tsx"`).
- **JSX:** Preact with `jsx: "precompile"` — use `class`, never `className`.
- **Signals in islands:** local island state uses `useSignal()`; the logic hook `usePullToRefresh` deliberately uses module `signal()` and is created once via `useMemo(() => usePullToRefresh(...), [])` (same pattern as `useShoppingList`).
- **Gesture:** touch only (no mouse/desktop). Default `threshold = 72` px damped travel, `resistance = 0.5`.
- **Error copy (verbatim):** `Couldn't refresh — try again`.
- **CSS:** add `overscroll-behavior-y: contain` to `body` as defense-in-depth against native browser pull-to-refresh.
- **Out of scope:** category-reorder page, Home/Menu/Todos placeholders, keyboard/programmatic trigger, any API/route/data-model change.
- **Commits:** Conventional Commits (`feat:`, `test:`, `docs:` …).
- **Every task ends green:** `deno task check` and `deno test -A` must pass before committing.

---

### Task 1: `usePullToRefresh` gesture state machine

**Files:**
- Create: `hooks/usePullToRefresh.ts`
- Test: `hooks/usePullToRefresh.test.ts`
- Modify: `hooks/index.ts` (add export)

**Interfaces:**
- Consumes: `signal`, `Signal` from `@preact/signals`.
- Produces:
  - `type PullStatus = "idle" | "pulling" | "armed" | "refreshing" | "success" | "error"`
  - `interface UsePullToRefreshOptions { onRefresh: () => Promise<unknown> | unknown; threshold?: number; resistance?: number; onError?: (error: unknown) => void; onSuccess?: () => void; }`
  - `interface PullToRefreshController { status: Signal<PullStatus>; pull: Signal<number>; begin(startY: number): void; move(currentY: number, atTop: boolean): boolean; end(): void; cancel(): void; }`
  - `function usePullToRefresh(opts: UsePullToRefreshOptions): PullToRefreshController`
  - `move` returns `true` when the gesture is engaged (caller should `preventDefault`).

- [ ] **Step 1: Write the failing tests**

Create `hooks/usePullToRefresh.test.ts`:

```ts
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { usePullToRefresh } from "@/hooks/usePullToRefresh.ts";

Deno.test("usePullToRefresh — pull below threshold springs back, no refresh", () => {
  let calls = 0;
  const c = usePullToRefresh({
    threshold: 72,
    resistance: 0.5,
    onRefresh: () => {
      calls++;
      return Promise.resolve();
    },
  });
  c.begin(100);
  const engaged = c.move(220, true); // raw 120 * 0.5 = 60 < 72
  assert(engaged);
  assertEquals(c.status.value, "pulling");
  assertEquals(c.pull.value, 60);
  c.end();
  assertEquals(c.status.value, "idle");
  assertEquals(c.pull.value, 0);
  assertEquals(calls, 0);
});

Deno.test("usePullToRefresh — past threshold arms, then refreshes and succeeds", async () => {
  const time = new FakeTime();
  try {
    let calls = 0;
    const c = usePullToRefresh({
      threshold: 72,
      resistance: 0.5,
      onRefresh: () => {
        calls++;
        return Promise.resolve();
      },
    });
    c.begin(0);
    c.move(200, true); // raw 200 * 0.5 = 100 >= 72 → armed
    assertEquals(c.status.value, "armed");
    c.end();
    assertEquals(c.status.value, "refreshing");
    assertEquals(calls, 1);
    await time.tickAsync(0); // flush onRefresh microtasks
    assertEquals(c.status.value, "success");
    await time.tickAsync(600);
    assertEquals(c.status.value, "idle");
    assertEquals(c.pull.value, 0);
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — rejection goes to error then idle and calls onError", async () => {
  const time = new FakeTime();
  try {
    let errored: unknown = null;
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => Promise.reject(new Error("boom")),
      onError: (e) => (errored = e),
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    await time.tickAsync(0);
    assertEquals(c.status.value, "error");
    assert(errored instanceof Error);
    await time.tickAsync(400);
    assertEquals(c.status.value, "idle");
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — does not engage when not scrolled to top", () => {
  let calls = 0;
  const c = usePullToRefresh({
    onRefresh: () => {
      calls++;
      return Promise.resolve();
    },
  });
  c.begin(0);
  const engaged = c.move(200, false); // atTop = false
  assertEquals(engaged, false);
  assertEquals(c.status.value, "idle");
  c.end();
  assertEquals(calls, 0);
});

Deno.test("usePullToRefresh — ignores new gestures while refreshing", async () => {
  const time = new FakeTime();
  try {
    let calls = 0;
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => {
        calls++;
        return Promise.resolve();
      },
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    assertEquals(c.status.value, "refreshing");
    c.begin(0);
    assertEquals(c.move(300, true), false); // no-op mid-refresh
    c.end();
    await time.tickAsync(0);
    assertEquals(calls, 1);
    await time.tickAsync(600);
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — resistance damps pull distance", () => {
  const c = usePullToRefresh({
    threshold: 72,
    resistance: 0.4,
    onRefresh: () => Promise.resolve(),
  });
  c.begin(0);
  c.move(100, true); // 100 * 0.4 = 40
  assertEquals(c.pull.value, 40);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test -A hooks/usePullToRefresh.test.ts`
Expected: FAIL — module `hooks/usePullToRefresh.ts` not found / `usePullToRefresh` is not a function.

- [ ] **Step 3: Write the implementation**

Create `hooks/usePullToRefresh.ts`:

```ts
import { signal, type Signal } from "@preact/signals";

export type PullStatus =
  | "idle"
  | "pulling"
  | "armed"
  | "refreshing"
  | "success"
  | "error";

export interface UsePullToRefreshOptions {
  /** The page's refresh action. May return a promise; rejection → error state. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Damped pull distance (px) required to arm a refresh. Default 72. */
  threshold?: number;
  /** Fraction of raw finger travel applied to the pull. Default 0.5. */
  resistance?: number;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}

export interface PullToRefreshController {
  status: Signal<PullStatus>;
  pull: Signal<number>;
  /** Record the touch origin. */
  begin(startY: number): void;
  /** Update from a move; returns true when engaged (caller should preventDefault). */
  move(currentY: number, atTop: boolean): boolean;
  /** Release: refresh if armed, else spring back. */
  end(): void;
  /** Abort an in-progress (non-refreshing) pull. */
  cancel(): void;
}

const ENGAGE_SLOP = 6; // px of downward travel before we hijack the gesture
const SUCCESS_MS = 600; // how long the success check lingers
const ERROR_MS = 400; // how long the error state lingers before reset

/**
 * Gesture state machine for pull-to-refresh. DOM-free and signal-based so it can
 * be unit-tested by calling its methods directly (see usePullToRefresh.test.ts).
 * Created once per consumer via `useMemo(() => usePullToRefresh(...), [])`.
 */
export function usePullToRefresh(
  opts: UsePullToRefreshOptions,
): PullToRefreshController {
  const { onRefresh, threshold = 72, resistance = 0.5, onError, onSuccess } =
    opts;

  const status = signal<PullStatus>("idle");
  const pull = signal(0);
  const maxPull = threshold + 48;

  let startY = 0;
  let engaged = false;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const busy = () =>
    status.value === "refreshing" || status.value === "success";

  const scheduleIdle = (ms: number) => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      status.value = "idle";
      pull.value = 0;
    }, ms);
  };

  const begin = (y: number) => {
    if (busy()) return;
    startY = y;
    engaged = false;
  };

  const move = (currentY: number, atTop: boolean): boolean => {
    if (busy()) return false;
    if (!engaged) {
      if (atTop && currentY - startY > ENGAGE_SLOP) engaged = true;
      else return false;
    }
    const raw = currentY - startY;
    if (raw <= 0) {
      pull.value = 0;
      status.value = "idle";
      engaged = false;
      return false;
    }
    const damped = Math.min(raw * resistance, maxPull);
    pull.value = damped;
    status.value = damped >= threshold ? "armed" : "pulling";
    return true;
  };

  const end = () => {
    if (!engaged) return;
    engaged = false;
    if (status.value !== "armed") {
      pull.value = 0;
      status.value = "idle";
      return;
    }
    status.value = "refreshing";
    pull.value = threshold;
    Promise.resolve()
      .then(() => onRefresh())
      .then(
        () => {
          status.value = "success";
          onSuccess?.();
          scheduleIdle(SUCCESS_MS);
        },
        (error) => {
          status.value = "error";
          pull.value = 0;
          onError?.(error);
          scheduleIdle(ERROR_MS);
        },
      );
  };

  const cancel = () => {
    if (busy()) return;
    pull.value = 0;
    status.value = "idle";
    engaged = false;
  };

  return { status, pull, begin, move, end, cancel };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test -A hooks/usePullToRefresh.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Export from the hooks barrel**

Add to `hooks/index.ts` (after the existing exports):

```ts
export * from "./usePullToRefresh.ts";
```

- [ ] **Step 6: Verify the gate is green**

Run: `deno task check && deno test -A hooks/usePullToRefresh.test.ts`
Expected: fmt/lint/type-check clean; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add hooks/usePullToRefresh.ts hooks/usePullToRefresh.test.ts hooks/index.ts
git commit -m "feat(shopping): add usePullToRefresh gesture state machine"
```

---

### Task 2: `PullToRefresh` wrapper component + indicator CSS

**Files:**
- Create: `components/md3/PullToRefresh.tsx`
- Test: `components/md3/PullToRefresh.test.tsx`
- Modify: `assets/styles.css` (spinner keyframe + `overscroll-behavior-y`)

**Interfaces:**
- Consumes: `usePullToRefresh` + `PullToRefreshController` (Task 1); `Icon` from `@/components/md3/Icon.tsx`; `Snackbar` from `@/components/md3/Snackbar.tsx`.
- Produces:
  - `interface PullToRefreshProps { onRefresh: () => Promise<unknown> | unknown; disabled?: boolean; class?: string; children: ComponentChildren; }`
  - `function PullToRefresh(props: PullToRefreshProps): VNode` (named export).
  - Renders `children` inside a `class`-forwarded root div; a fixed decorative indicator; an `aria-live` status; an internal error Snackbar.

- [ ] **Step 1: Add the spinner keyframe and overscroll guard to CSS**

In `assets/styles.css`, append after the `.md-saved-flash` block (near line 261):

```css
/* Pull-to-refresh indicator spinner */
@keyframes pull-spin {
  to {
    transform: rotate(360deg);
  }
}
.pull-spin {
  animation: pull-spin 0.8s linear infinite;
}
```

Then change the existing `body` rule (near line 263) from:

```css
body {
  background: var(--md-background);
  color: var(--md-on-surface);
}
```

to:

```css
body {
  background: var(--md-background);
  color: var(--md-on-surface);
  overscroll-behavior-y: contain;
}
```

- [ ] **Step 2: Write the failing SSR test**

Create `components/md3/PullToRefresh.test.tsx`:

```tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { PullToRefresh } from "./PullToRefresh.tsx";

Deno.test("PullToRefresh — renders its children", () => {
  const html = render(
    h(
      PullToRefresh,
      { onRefresh: () => Promise.resolve() },
      h("p", null, "Hello content"),
    ),
  );
  assertStringIncludes(html, "Hello content");
});

Deno.test("PullToRefresh — forwards class to the content root", () => {
  const html = render(
    h(
      PullToRefresh,
      { onRefresh: () => Promise.resolve(), class: "flex flex-col gap-4" },
      h("p", null, "x"),
    ),
  );
  assertStringIncludes(html, "flex flex-col gap-4");
});

Deno.test("PullToRefresh — idle: sr-only status present, no error snackbar", () => {
  const html = render(
    h(PullToRefresh, { onRefresh: () => Promise.resolve() }, h("p", null, "x")),
  );
  assertStringIncludes(html, "aria-live");
  assert(!html.includes("Couldn't refresh")); // error snackbar hidden at idle
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `deno test -A components/md3/PullToRefresh.test.tsx`
Expected: FAIL — `./PullToRefresh.tsx` not found.

- [ ] **Step 4: Write the component**

Create `components/md3/PullToRefresh.tsx`:

```tsx
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { usePullToRefresh } from "@/hooks/usePullToRefresh.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface PullToRefreshProps {
  /** The page's refresh action. Rejection surfaces the error Snackbar. */
  onRefresh: () => Promise<unknown> | unknown;
  /** When true, the gesture is inert (e.g. a sheet/overlay is open). */
  disabled?: boolean;
  /** Classes forwarded to the content root (so it can host the page's layout). */
  class?: string;
  children: ComponentChildren;
}

const THRESHOLD = 72;

/**
 * Reusable pull-to-refresh wrapper. Overlay-style (content is NOT transformed),
 * so it can safely enclose fixed FABs/sheets/overlays. Touch only.
 *
 * Usage:
 *   <PullToRefresh onRefresh={refresh} disabled={sheetOpen} class="flex flex-col gap-4">
 *     ...page content...
 *   </PullToRefresh>
 */
export function PullToRefresh(
  { onRefresh, disabled, class: className, children }: PullToRefreshProps,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest props for the once-bound listeners / memoized controller to read.
  const latest = useRef({ onRefresh, disabled });
  latest.current = { onRefresh, disabled };

  const showError = () => {
    snack.value = { msg: "Couldn't refresh — try again" };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 3000);
  };

  // signal()-based factory, created once (mirrors useShoppingList usage).
  const ctrl = useMemo(
    () =>
      usePullToRefresh({
        threshold: THRESHOLD,
        onRefresh: () => latest.current.onRefresh(),
        onError: () => showError(),
      }),
    [],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;

    const onStart = (e: TouchEvent) => {
      if (latest.current.disabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      ctrl.begin(t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (latest.current.disabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      // Bail on a predominantly-horizontal drag before we've engaged.
      if (Math.abs(t.clientX - startX) > 40 && ctrl.pull.value === 0) {
        ctrl.cancel();
        return;
      }
      const atTop = (globalThis.scrollY ?? 0) <= 0;
      const engaged = ctrl.move(t.clientY, atTop);
      if (engaged && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (latest.current.disabled) return;
      ctrl.end();
    };
    const onCancel = () => ctrl.cancel();

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      if (snackTimer.current) clearTimeout(snackTimer.current);
    };
  }, []);

  const status = ctrl.status.value;
  const pull = ctrl.pull.value;
  const dragging = status === "pulling" || status === "armed";
  const active = status !== "idle" && status !== "error";
  const progress = Math.min(pull / THRESHOLD, 1);

  const offset = dragging ? pull * 0.6 : active ? 16 : -24;
  const opacity = status === "idle" || status === "error"
    ? 0
    : dragging
    ? progress
    : 1;
  const scale = 0.8 + 0.2 * (dragging ? progress : 1);
  const spinDeg = dragging ? pull * 2.5 : 0;

  return (
    <>
      <div ref={rootRef} class={className}>{children}</div>

      {/* Decorative pull indicator */}
      <div
        aria-hidden="true"
        class="fixed left-0 right-0 z-[250] flex justify-center pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      >
        <div
          class="grid place-items-center bg-surface-c text-primary md-elevation-3 rounded-[var(--md-shape-full)]"
          style={{
            width: 40,
            height: 40,
            opacity,
            transform: `translateY(${offset}px) scale(${scale})`,
            transition: dragging ? "none" : "all .3s var(--md-emphasized)",
          }}
        >
          {status === "success"
            ? <Icon name="check" size={22} stroke={2.5} />
            : (
              <span
                class={status === "refreshing" ? "pull-spin" : ""}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2.5px solid currentColor",
                  borderTopColor: "transparent",
                  transform: status === "refreshing"
                    ? undefined
                    : `rotate(${spinDeg}deg)`,
                }}
              />
            )}
        </div>
      </div>

      {/* Screen-reader status */}
      <span class="sr-only" aria-live="polite">
        {status === "refreshing"
          ? "Refreshing"
          : status === "success"
          ? "Refreshed"
          : status === "error"
          ? "Couldn't refresh"
          : ""}
      </span>

      <Snackbar data={snack.value} />
    </>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test -A components/md3/PullToRefresh.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify the gate is green**

Run: `deno task check && deno test -A`
Expected: fmt/lint/type-check clean; full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add components/md3/PullToRefresh.tsx components/md3/PullToRefresh.test.tsx assets/styles.css
git commit -m "feat(shopping): add PullToRefresh wrapper component and indicator styles"
```

---

### Task 3: Integrate on the list-detail page (`items.tsx`)

**Files:**
- Modify: `islands/items.tsx`

**Interfaces:**
- Consumes: `PullToRefresh` (Task 2); the island's existing `refresh` (from `useShoppingList`) and signals `addOpen`, `mgmtOpen`, `editingId`.
- Produces: no new exports.

- [ ] **Step 1: Import the component**

In `islands/items.tsx`, add to the imports (after the `AddItems` import near line 25):

```tsx
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
```

- [ ] **Step 2: Wrap the island content — opening tag**

Replace the render's opening wrapper (currently line 186-187):

```tsx
  return (
    <div class="flex flex-col gap-4 pb-24">
```

with:

```tsx
  return (
    <PullToRefresh
      onRefresh={refresh}
      disabled={addOpen.value || mgmtOpen.value || editingId.value !== null}
      class="flex flex-col gap-4 pb-24"
    >
```

- [ ] **Step 3: Wrap the island content — closing tag**

Replace the render's closing block (currently the tail of the component):

```tsx
      {/* ══════════════════════ Snackbar ══════════════════════ */}
      <Snackbar data={snackData.value} />
    </div>
  );
}
```

with:

```tsx
      {/* ══════════════════════ Snackbar ══════════════════════ */}
      <Snackbar data={snackData.value} />
    </PullToRefresh>
  );
}
```

- [ ] **Step 4: Verify type-check, lint, existing tests**

Run: `deno task check && deno test -A islands/items.test.tsx`
Expected: clean; `items.test.tsx` still PASS (SSR renders children unchanged).

- [ ] **Step 5: Commit**

```bash
git add islands/items.tsx
git commit -m "feat(shopping): wire pull-to-refresh into the list-detail page"
```

---

### Task 4: Add `refresh` to `useCatalogue` and integrate on the catalogue page

**Files:**
- Modify: `hooks/useCatalogue.ts`
- Test: `hooks/useCatalogue.test.ts` (add one test)
- Modify: `islands/catalogue.tsx`

**Interfaces:**
- Consumes: `api.items.getAll`, `api.categories.getAll` (existing); `PullToRefresh` (Task 2); the island's existing `anySheetOpen`.
- Produces: `useCatalogue(...).refresh: () => Promise<void>` (added to the returned object).

- [ ] **Step 1: Write the failing hook test**

Add to `hooks/useCatalogue.test.ts` (append at the end of the file):

```ts
Deno.test("refresh — re-pulls items and categories from the API", async () => {
  const hook = useCatalogue([item("i1", "Butter", "d")], [cat("d", "Dairy")]);

  const itemsStub = stub(
    api.items,
    "getAll",
    () => Promise.resolve([item("i2", "Milk", "d"), item("i3", "Bread", "b")]),
  );
  const catsStub = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([cat("d", "Dairy"), cat("b", "Bakery")]),
  );
  try {
    await hook.refresh();
  } finally {
    itemsStub.restore();
    catsStub.restore();
  }

  assertEquals(hook.items.value.map((i) => i.name), ["Milk", "Bread"]);
  assertEquals(hook.categories.value.map((c) => c.label), ["Dairy", "Bakery"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test -A hooks/useCatalogue.test.ts`
Expected: FAIL — `hook.refresh is not a function`.

- [ ] **Step 3: Implement `refresh`**

In `hooks/useCatalogue.ts`, add this function just before the `return {` block (after `deleteCategory`, near line 138):

```ts
  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const [newItems, newCategories] = await Promise.all([
        api.items.getAll(),
        api.categories.getAll(),
      ]);
      items.value = newItems;
      categories.value = newCategories;
    } finally {
      pendingCount.value--;
    }
  };
```

Then add `refresh,` to the returned object (inside `return { ... }`, e.g. right after `pendingCount,`):

```ts
    pendingCount,
    refresh,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test -A hooks/useCatalogue.test.ts`
Expected: PASS (including the new test).

- [ ] **Step 5: Import + destructure `refresh` in the catalogue island**

In `islands/catalogue.tsx`, add to the imports (after the `useCatalogue` import near line 4):

```tsx
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
```

Then add `refresh` to the destructured hook result (the `const { ... } = useMemo(...)` block near line 35-51) — add it alongside the others, e.g. after `items,`:

```tsx
    items,
    refresh,
```

- [ ] **Step 6: Wrap the island content — opening tag**

Replace the render's opening fragment (currently line 116-119):

```tsx
  return (
    <>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
```

with:

```tsx
  return (
    <PullToRefresh onRefresh={refresh} disabled={anySheetOpen}>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
```

- [ ] **Step 7: Wrap the island content — closing tag**

Replace the render's closing block (the tail of the component, currently lines 353-357):

```tsx
          ]}
        />
      )}
    </>
  );
}
```

with:

```tsx
          ]}
        />
      )}
    </PullToRefresh>
  );
}
```

- [ ] **Step 8: Verify the gate is green**

Run: `deno task check && deno test -A hooks/useCatalogue.test.ts islands/catalogue.test.tsx`
Expected: clean; both test files PASS.

- [ ] **Step 9: Commit**

```bash
git add hooks/useCatalogue.ts hooks/useCatalogue.test.ts islands/catalogue.tsx
git commit -m "feat(shopping): add catalogue refresh and wire pull-to-refresh"
```

---

### Task 5: Add a local `refresh` and integrate on the lists overview page (`shopping-lists.tsx`)

**Files:**
- Modify: `islands/shopping-lists.tsx`

**Interfaces:**
- Consumes: `api.shoppingLists.getAll`, `api.shoppingList.getItems` (existing); `PullToRefresh` (Task 2); the island's `lists` signal and `ShoppingListWithCounts` type.
- Produces: a local `refresh` (not exported).

**Note on counts:** the page renders lists with `total`/`done`, but `api.shoppingLists.getAll()` returns bare lists — so `refresh` re-fetches lists and recomputes counts per list via `api.shoppingList.getItems`, mirroring the server handler in `routes/shopping/index.tsx`.

- [ ] **Step 1: Import the component**

In `islands/shopping-lists.tsx`, add to the imports (after the `Fab` import near line 10):

```tsx
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
```

- [ ] **Step 2: Add the `refresh` function**

In `islands/shopping-lists.tsx`, inside the `ShoppingLists` component, add this after the `createList` function (near line 63, before `return (`):

```tsx
  const refresh = async () => {
    const fresh = await api.shoppingLists.getAll();
    const withCounts = await Promise.all(
      fresh.map(async (l) => {
        const items = await api.shoppingList.getItems(l.id);
        return {
          ...l,
          total: items.length,
          done: items.filter((i) => i.checked).length,
        };
      }),
    );
    lists.value = withCounts;
  };
```

- [ ] **Step 3: Wrap the island content — opening tag**

Replace the render's opening fragment (currently line 65-68):

```tsx
  return (
    <>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
```

with:

```tsx
  return (
    <PullToRefresh onRefresh={refresh} disabled={newOpen.value}>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
```

- [ ] **Step 4: Wrap the island content — closing tag**

Replace the render's closing block (the tail of the component, currently lines 190-193):

```tsx
        </div>
      </Sheet>
    </>
  );
}
```

with:

```tsx
        </div>
      </Sheet>
    </PullToRefresh>
  );
}
```

- [ ] **Step 5: Verify the gate is green**

Run: `deno task check && deno test -A islands/shopping-lists.test.tsx`
Expected: clean; `shopping-lists.test.tsx` still PASS.

- [ ] **Step 6: Commit**

```bash
git add islands/shopping-lists.tsx
git commit -m "feat(shopping): add lists refresh and wire pull-to-refresh"
```

---

### Task 6: Full-suite gate + live verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole gate**

Run: `deno task check && deno test -A && deno task build`
Expected: all green.

- [ ] **Step 2: Live-verify in the browser preview (mobile viewport)**

Start the dev server (`deno task dev`) and open the preview at a mobile size (e.g. 375×812). On **each** of `/shopping`, `/shopping/<id>`, and `/shopping/catalogue`:

- Scroll to the top, drag down a little (below threshold) and release → puck peeks in, then springs back; content unchanged; no refresh.
- Drag down past ~72px damped and release → puck settles and spins, content re-pulls, puck shows a check, then retracts.
- With a sheet/overlay open (new-list sheet, add-items overlay, catalogue edit/add sheet) → pulling does nothing.
- Mid-scroll (not at the top) → pulling does not trigger; the page scrolls normally.
- Force an error (temporarily make the page's refresh reject, or go offline) → puck retracts and the Snackbar shows "Couldn't refresh — try again". Revert any temporary change.
- Confirm on Android Chrome that the browser's own pull-to-refresh does not also fire.

- [ ] **Step 3: Capture proof**

Take a screenshot of the spinning indicator (or the success check) on the list-detail page to attach to the PR.

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR against `main`, referencing issue #34.

---

## Self-Review

**1. Spec coverage:**
- Reusable component → Tasks 1 (hook) + 2 (component). ✓
- Flexible per-page refresh via `onRefresh` → Tasks 3/4/5. ✓
- Loading/success/error feedback → Task 2 indicator states + internal Snackbar; Task 1 state machine. ✓
- Works with existing scroll model / layouts → overlay (no content transform) so fixed FABs/sheets are safe; verified live in Task 6. ✓
- Unit-testable gesture → Task 1 tests. ✓
- Integrate on all shopping data pages, skip category-reorder → Tasks 3/4/5; category-reorder untouched. ✓
- `overscroll-behavior-y: contain`, spinner CSS → Task 2 Step 1. ✓
- Lists-page count recomputation → Task 5 note + code. ✓
- Non-passive `touchmove` for `preventDefault` → Task 2 component (`{ passive: false }`). ✓
- Accessibility `aria-live` status → Task 2 component + test. ✓
- Docs (usage) → JSDoc on the component (Task 2). ✓

**2. Placeholder scan:** No TBD/TODO; every code step contains complete code; commands have expected output. ✓

**3. Type consistency:** `PullStatus`, `PullToRefreshController`, and method names (`begin`/`move`/`end`/`cancel`, `status`/`pull`) are identical across Task 1 (definition), its tests, and Task 2 (consumption). `PullToRefreshProps` (`onRefresh`/`disabled`/`class`/`children`) matches usage in Tasks 3/4/5. `useCatalogue().refresh` signature matches its test and island usage. ✓
