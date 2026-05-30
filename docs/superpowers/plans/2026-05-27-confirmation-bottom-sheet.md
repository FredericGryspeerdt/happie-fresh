# Confirmation Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `BottomSheet` component and wire it into
`islands/shopping-lists.tsx` so deleting a shopping list requires explicit
confirmation.

**Architecture:** A generic `BottomSheet` Preact component in `components/`
handles open/close CSS transitions, backdrop, swipe-to-dismiss (touch events +
direct DOM mutation during drag), and Escape key. It is rendered as a sibling to
the existing JSX inside the `ShoppingLists` island — no new islands, no new API
routes, no changes outside these two files.

**Tech Stack:** Deno, Fresh 2, Preact + `@preact/signals`, Tailwind CSS v4,
`deno test`.

---

## File Map

**Create:**

- `components/BottomSheet.tsx` — generic bottom sheet: open/close CSS
  transitions, swipe-to-dismiss, Escape key, backdrop click-to-dismiss.

**Modify:**

- `islands/shopping-lists.tsx` — add `pendingDelete` signal, replace immediate
  `deleteList` with two-step flow, render `<BottomSheet>`.

---

### Task 1: BottomSheet component

**Files:**

- Create: `components/BottomSheet.tsx`

- [ ] **Step 1: Create `components/BottomSheet.tsx`**

```tsx
import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
}

export default function BottomSheet(
  { open, onClose, children }: BottomSheetProps,
) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentDelta = useRef(0);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    currentDelta.current = 0;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    currentDelta.current = e.touches[0].clientY - dragStartY.current;
    if (currentDelta.current > 0) {
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${currentDelta.current}px)`;
    }
  };

  const handleTouchEnd = () => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (currentDelta.current > 80) {
      sheet.style.transform = "";
      onClose();
    } else {
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    currentDelta.current = 0;
  };

  return (
    <div class="fixed inset-0 z-50 pointer-events-none">
      <div
        class={`absolute inset-0 bg-black transition-opacity duration-300 ${
          open
            ? "opacity-50 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        class={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          open
            ? "translate-y-0 pointer-events-auto"
            : "translate-y-full pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div class="px-4 pb-8 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check the new file**

```bash
deno check components/BottomSheet.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/BottomSheet.tsx
git commit -m "feat: add reusable BottomSheet component with swipe-to-dismiss"
```

---

### Task 2: Wire up delete confirmation in shopping-lists island

**Files:**

- Modify: `islands/shopping-lists.tsx`

- [ ] **Step 1: Add the BottomSheet import**

At the top of `islands/shopping-lists.tsx`, add to the existing imports:

```ts
import BottomSheet from "@/components/BottomSheet.tsx";
```

- [ ] **Step 2: Add the `pendingDelete` signal inside the component function**

After the existing signal declarations (`lists`, `newName`, `editingId`,
`editName`, `loading`), add:

```ts
const pendingDelete = useSignal<{ id: string; name: string } | null>(null);
```

- [ ] **Step 3: Replace `deleteList` with `handleDeleteConfirm`**

Remove the existing `deleteList` function:

```ts
// REMOVE this:
const deleteList = async (id: string) => {
  await api.shoppingLists.delete(id);
  lists.value = lists.value.filter((l) => l.id !== id);
};
```

Add in its place:

```ts
const handleDeleteConfirm = async () => {
  if (!pendingDelete.value) return;
  const { id } = pendingDelete.value;
  pendingDelete.value = null;
  await api.shoppingLists.delete(id);
  lists.value = lists.value.filter((l) => l.id !== id);
};
```

The sheet closes (signal cleared) before the API call completes, giving
immediate visual feedback.

- [ ] **Step 4: Update the trash button's `onClick`**

Find the button with `aria-label={\`Delete ${list.name}\`}`. Change its`onClick`
from:

```ts
onClick={() => deleteList(list.id)}
```

to:

```ts
onClick={() => pendingDelete.value = { id: list.id, name: list.name }}
```

- [ ] **Step 5: Wrap the return in a fragment and append BottomSheet**

The current `return` is a single `<div class="space-y-4">`. Wrap it in a
fragment and append `<BottomSheet>` as a sibling:

```tsx
return (
  <>
    <div class="space-y-4">
      {/* all existing JSX here — no changes inside this div */}
    </div>

    <BottomSheet
      open={pendingDelete.value !== null}
      onClose={() => pendingDelete.value = null}
    >
      <p class="text-lg font-semibold text-gray-900 mb-1">Delete list?</p>
      <p class="text-sm text-gray-500 mb-6">
        "{pendingDelete.value?.name}" and all its items will be permanently
        deleted. This cannot be undone.
      </p>
      <button
        type="button"
        class="w-full py-3 bg-red-500 text-white font-semibold rounded-xl mb-3 active:bg-red-600 transition-colors"
        onClick={handleDeleteConfirm}
      >
        Delete
      </button>
      <button
        type="button"
        class="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl active:bg-gray-200 transition-colors"
        onClick={() => pendingDelete.value = null}
      >
        Cancel
      </button>
    </BottomSheet>
  </>
);
```

- [ ] **Step 6: Type-check the updated island**

```bash
deno check islands/shopping-lists.tsx
```

Expected: no errors.

- [ ] **Step 7: Run existing test suite**

```bash
deno test --allow-env
```

Expected: all existing tests pass — no regressions.

- [ ] **Step 8: Run full project check**

```bash
deno task check
```

Expected: format, lint, and type checks all pass.

- [ ] **Step 9: Commit**

```bash
git add islands/shopping-lists.tsx
git commit -m "feat(lists): confirm before deleting a shopping list (issue #11)"
```

---

### Task 3: Smoke test via dev server

- [ ] **Step 1: Start the dev server**

```bash
deno task dev
```

Open `http://localhost:8000` in a browser. Log in and navigate to `/lists`.
Create at least two lists so deletion can be tested without losing all data.

- [ ] **Step 2: Verify each scenario from the spec**

Work through these in order:

1. Tap the trash icon on a list → bottom sheet slides up from the bottom, shows
   the list's name in the body copy.
2. Tap **Cancel** → sheet slides down over 300ms, list is unchanged.
3. Tap trash again → sheet appears. Tap the dark backdrop (outside the sheet) →
   sheet dismisses, list unchanged.
4. Tap trash again → sheet appears. Press **Escape** → sheet dismisses, list
   unchanged.
5. _(Touch device or DevTools touch simulation)_ Tap trash → sheet appears. Drag
   the sheet downward more than ~80px and release → sheet dismisses without
   deleting.
6. _(Touch device)_ Tap trash → drag the sheet slightly (< 80px) → release →
   sheet snaps back to fully open.
7. Tap trash → tap **Delete** → sheet closes immediately, list disappears from
   the page. Refresh to confirm the deletion persisted in the database.
