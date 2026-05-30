# Confirmation Bottom Sheet — Design Spec

**Date:** 2026-05-27 **Status:** Approved

## Context

Destructive actions (delete a shopping list, and similar actions in the future)
previously fired immediately on tap with no confirmation. This caused accidental
data loss. This spec introduces a reusable bottom sheet component that gates
irreversible actions behind an explicit confirmation step, following native
mobile UX conventions.

The immediate trigger is
[issue #11](https://github.com/FredericGryspeerdt/happie-fresh/issues/11)
(confirm before deleting a shopping list), but the component is designed to be
used across the app wherever a destructive action needs confirmation.

---

## Scope

**In scope:**

- Generic `BottomSheet` component (`components/BottomSheet.tsx`)
- Delete-list confirmation wired into `islands/shopping-lists.tsx`
- Swipe-to-dismiss gesture
- Escape key to dismiss
- Backdrop tap to dismiss

**Out of scope:**

- Other confirmation use cases (added as needed when encountered)
- Animated exit (sheet dismisses via CSS transition; no JS-driven exit
  animation)
- Error handling if the delete API call fails (silent failure is acceptable)

---

## Component: `components/BottomSheet.tsx`

A regular Preact component (not an island). Rendered inside islands that need it
— the island is the hydration boundary.

### Props

```ts
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
}
```

Content is entirely controlled by `children`. No title slot, no button API —
keeps the component generic for any action pattern.

### DOM structure

```
<div fixed inset-0 z-50 pointer-events-none>        ← wrapper, never captures events
  <div backdrop />                                    ← absolute inset-0, bg-black
  <div sheet role="dialog" aria-modal="true">        ← absolute bottom-0, full-width
    <div handle-bar />                               ← visual drag affordance
    <div class="px-4 pb-8 pt-2">
      {children}
    </div>
  </div>
</div>
```

### Open / close (CSS-driven)

Both the backdrop and sheet are always in the DOM. Visibility is controlled
entirely by CSS transitions — no mount/unmount, no `useEffect` for animation:

| Element  | Closed state                           | Open state                          |
| -------- | -------------------------------------- | ----------------------------------- |
| Backdrop | `opacity-0 pointer-events-none`        | `opacity-50 pointer-events-auto`    |
| Sheet    | `translate-y-full pointer-events-none` | `translate-y-0 pointer-events-auto` |

Both transition over 300ms (`ease-out` for sheet, `linear` for backdrop).

### Swipe-to-dismiss

Three touch handlers on the sheet element. Drag state is tracked in plain
variables (not signals — no re-render needed during drag):

- **`touchstart`**: record `dragStartY = e.touches[0].clientY`.
- **`touchmove`**: compute `delta = currentY - dragStartY`.
  - If `delta > 0` (downward drag): disable CSS transition on the sheet element,
    apply `style.transform = translateY(${delta}px)` directly.
  - If `delta ≤ 0` (upward drag): ignore.
- **`touchend`**: evaluate final delta.
  - `delta > 80px` → call `onClose()`, clear inline transform.
  - `delta ≤ 80px` → re-enable CSS transition, clear inline transform (snaps
    back).

The 80px threshold avoids accidental dismissal from small incidental drags.

### Escape key

`useEffect` that attaches a `keydown` listener to `document` while `open` is
true. Calls `onClose()` on `Escape`. Cleaned up when `open` becomes false or the
component unmounts.

---

## Changes to `islands/shopping-lists.tsx`

### New signal

```ts
const pendingDelete = useSignal<{ id: string; name: string } | null>(null);
```

### Trash button (was: `onClick={() => deleteList(list.id)`)

```ts
onClick={() => pendingDelete.value = { id: list.id, name: list.name }}
```

The `deleteList` function is removed entirely.

### Confirmation handler

```ts
const handleDeleteConfirm = async () => {
  if (!pendingDelete.value) return;
  const { id } = pendingDelete.value;
  pendingDelete.value = null; // close sheet before API call (optimistic)
  await api.shoppingLists.delete(id);
  lists.value = lists.value.filter((l) => l.id !== id);
};
```

The sheet closes before the API call completes. The list disappears from UI
immediately on confirmation tap.

### BottomSheet in JSX (appended to the island's return)

```tsx
<BottomSheet
  open={pendingDelete.value !== null}
  onClose={() => pendingDelete.value = null}
>
  <p class="text-lg font-semibold text-gray-900 mb-1">Delete list?</p>
  <p class="text-sm text-gray-500 mb-6">
    "{pendingDelete.value?.name}" and all its items will be permanently deleted.
    This cannot be undone.
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
</BottomSheet>;
```

The list name is quoted in the body copy so the user sees exactly which list is
being deleted.

---

## Verification

1. `deno task dev` — open `/lists`, create two lists.
2. Tap the trash icon on one list — bottom sheet slides up with the list name.
3. Tap **Cancel** — sheet slides down, list unchanged.
4. Tap trash again — sheet appears.
5. Swipe the sheet down past ~80px — sheet dismisses, list unchanged.
6. Tap trash again — sheet appears. Press **Escape** — sheet dismisses.
7. Tap trash again — tap **Delete** — sheet closes immediately, list removed.
8. Tap the backdrop (outside the sheet) — sheet dismisses without deleting.
9. Run `deno task check` — no type errors or lint warnings.
