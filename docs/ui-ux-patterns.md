# UI/UX Patterns

The established front-end patterns in this codebase. **New UI features should
follow these** so the app stays consistent, predictable, and easy for anyone
(including children) to use.

This is a living reference for humans and AI coding agents. It is intentionally
kept out of the always-loaded instruction files (`CLAUDE.md`,
`.github/copilot-instructions.md`, `AGENTS.md`) so it doesn't bloat every
session's context — those files link here instead. Read it before building or
changing anything the user sees.

Each entry is: **Rule** (what to do) → **Why** → **How** (the shape in code) →
**See** (where it lives). Paths are repo-root-relative with line numbers.

For general architecture, stack, and conventions, see `CLAUDE.md`. For the
product ethos (warm, collaborative, all-ages, mobile-first PWA), see the top of
`CLAUDE.md` too — the patterns below exist to serve it.

---

## 1. Optimistic updates/deletes, pessimistic creates

**Rule:** For **updates, deletes, toggles**, change local state immediately and
sync to the server in the background (optimistic). For **creates**, wait for the
server response before adding to local state (pessimistic).

**Why:** Optimistic actions make the app feel instant for the common,
low-risk edits. Creates are pessimistic because the **server mints the ID**
(`crypto.randomUUID()`); the client can't fabricate a correct entry, so it waits
for the real one. When an optimistic action can realistically fail in a way the
user would care about, snapshot first and **roll back** on failure — and pair
that rollback with visible feedback so the reversal isn't a silent surprise
(see §3).

**How:**

```ts
// Pessimistic create — await the server, then adopt the returned entry.
const _addToList = async (itemId: string) => {
  const entry = await api.shoppingList.addItem(listId, itemId);
  if (entry) list.value = [...list.value, entry]; // only after success
  return entry?.id ?? null;
};

// Optimistic update — mutate the signal now, sync (debounced) after.
const updateListItem = (id, patch) => {
  list.value = list.value.map((li) => li.id === id ? { ...li, ...patch } : li);
  patchScheduler.schedule(id, patch);
};

// Optimistic + rollback — restore the snapshot if the server rejects.
const clearCheckedItems = async () => {
  const snapshot = checkedItems.value;
  checkedItems.value = [];
  const cleared = await api.shoppingList.clearChecked(listId);
  if (cleared === null) checkedItems.value = snapshot; // rollback
};
```

**See:** `hooks/useShoppingList.ts` — `_addToList`/`addToList` (pessimistic
create, ~line 91), `updateListItem` (optimistic, ~line 80), `removeListItem`
(~line 129), `checkItem` (~line 147), `clearCheckedItems` with rollback (~line
185). `hooks/useCatalogue.ts` follows the same split.

---

## 2. The `api` service is the error boundary

**Rule:** All network access goes through `services/api.ts`. It **never
throws**: methods that return data resolve to `null` (single entity) or `[]`
(collections) on a non-OK response; fire-and-forget mutations return `void`.
Callers branch on the `null`/`[]` result — they do not wrap calls in
`try/catch` for transport errors.

**Why:** A single, predictable boundary keeps every island free of scattered
error plumbing. "Failure" becomes an ordinary value (`null`) that drives UI
decisions instead of an exception each caller must remember to catch.

**But `null` is not the end of error handling.** Returning `null` only makes the
failure *representable* — the caller is still responsible for reacting to it
visibly: roll back optimistic state and tell the user (see §3). A `null` that
nobody checks is a silent failure, which is exactly what we're moving away from.

**How:**

```ts
// services/api.ts
create: async (item) => {
  const res = await fetch("/api/shopping/catalogue", { method: "POST", /* … */ });
  if (!res.ok) return null;        // ← never throws
  return res.json();
},
getAll: async () => {
  const res = await fetch("/api/shopping/catalogue");
  if (!res.ok) return [];          // ← empty collection on failure
  return res.json();
},
```

**See:** `services/api.ts` (the whole file is this pattern; e.g. lines 11–24).
Consumers: `hooks/useShoppingList.ts`, `hooks/useCatalogue.ts`.

---

## 3. Surface failures to the user (Snackbar)

**Rule:** A user action that fails should **tell the user** — don't fail
silently. When a mutation doesn't succeed (the `api` call resolves to `null`),
**roll back** the optimistic state **and** show a **Snackbar** with a short,
warm, plain-language message — never a raw error or a blocking modal. Offer a
retry (or "Undo") action on the snackbar where it helps the user recover.

**Why:** For an all-ages audience, an action that silently disappears is
confusing and erodes trust — the user can't tell whether their tap worked, so
they re-tap or assume the app is broken. A brief, honest "that didn't save"
beats a silent loss. The snackbar keeps the tone approachable: non-blocking,
self-dismissing, and limited to a single optional action. Messages read like a
helpful person ("Couldn't refresh — try again"), not a system log.

**Going forward vs. today:** This is the **target** convention. The add/create
flow (`addToList`/`addToCatalog`), `clearCheckedItems`, and pull-to-refresh
already follow it — a failure rolls back (where applicable) and shows a
snackbar. The remaining gap is the fire-and-forget optimistic writes
(`updateListItem`, `removeListItem`, `checkItem`), whose `api` methods return
`void` and so can't yet report failure; making those visible needs the `api`
layer to surface success first. Until then, **don't add new silent `void`
mutations** — give a new write a checkable result (`null`/boolean) and surface
failure at the call site.

**How:** Keep a local `snack` signal + a dismiss timer, and render one
`<Snackbar>`:

```ts
const snackData = useSignal<{ msg: string } | null>(null);
const showSnack = (msg: string) => {
  snackData.value = { msg };
  clearTimeout(snackTimer.current!);
  snackTimer.current = setTimeout(() => (snackData.value = null), 3000);
};
// …
<Snackbar data={snackData.value} />
```

The `Snackbar` component supports an optional `action`/`onAction` for a single
inline button.

**See:** `components/md3/Snackbar.tsx` (component + `action` support).
Usage: `islands/items.tsx` (`showSnack`, ~line 120), `components/md3/PullToRefresh.tsx`
(error message, ~line 41), `islands/shell/MoreSheet.tsx` ("coming soon").

---

## 4. Loading feedback

**Rule:** Use the **single global loading bar** for both navigation and
background mutations — don't add ad-hoc spinners for CRUD. For a button that
kicks off an async action, use its `loading` prop. For per-item background saves,
show inline "Saving…/Saved" state.

**Why:** One consistent indicator (top-of-screen progress bar) means the user
always looks in the same place. Timing guards (200 ms show-delay, 400 ms
min-visible) stop fast optimistic writes from flashing or flickering the bar.

**How:**

```ts
// utils/loading.ts — module-scope shared state.
export const busyCount = signal(0);         // in-flight background mutations
export const navPending = signal(false);    // full-page navigation in flight
export function beginBusy() { busyCount.value++; }
export function endBusy()   { busyCount.value = Math.max(0, busyCount.value - 1); }
export function navigateTo(url) { navPending.value = true; location.href = url; }

// Wrap every mutation so it registers on the global bar:
const startPending = () => { pendingCount.value++; beginBusy(); };
const endPending   = () => { pendingCount.value--; endBusy();  };
```

- **Navigation:** call `navigateTo()` / `reloadPage()` instead of setting
  `location` directly, so the bar shows during the load. Internal `<a>` clicks
  are auto-intercepted by `GlobalLoadingBar`.
- **Buttons:** `<Button loading>` swaps its icon for a `Spinner` and disables
  itself.
- **Per-item saves:** a `savingIds` set drives "Saving…", and a `lastSaved`
  counter (bumped on real flush) drives "Saved" — tied to the actual write, not
  keystrokes.

**See:** `utils/loading.ts` (`busyCount`/`beginBusy`/`endBusy`/`navigateTo`,
lines 9–34), `islands/shell/GlobalLoadingBar.tsx` (timing guards + link
interception; mounted once by `AppChrome`), `components/md3/Button.tsx` (`loading`
prop, ~line 59), `hooks/useShoppingList.ts` (`savingIds`/`lastSaved`, lines
46–61).

---

## 5. Searching & filtering a collection

**Rule:** Filter collections client-side with the generic **`useSearchBox<T>`**
hook. The query is trimmed; an empty query returns all items. Provide a
`filterFn(query, item)` describing what "matches" means for that collection.
`reset()` clears the query **and refocuses the input**.

**Why:** Centralizing search keeps behavior identical everywhere (trim,
empty-means-all, focus-after-clear) and keeps islands declarative — they read
`results` and `hasSearchQuery` instead of re-implementing filtering.

**How:**

```ts
const { query, results, hasSearchQuery, inputRef, reset } = useSearchBox(
  catalog,
  (q, item) => item.name.toLowerCase().includes(q.toLowerCase()),
);
// bind query <-> input; render results.value; show a clear button when hasSearchQuery
```

Use `useSearchInput()` (query + focus/reset only, no built-in filtering) when
the caller needs to own filtering/grouping itself.

**See:** `hooks/useSearchBox.ts`, `hooks/useSearchInput.ts`. Usage:
`islands/add-items.tsx` (`filterFn`, ~line 60), `islands/search-box.tsx`,
`islands/catalogue.tsx`.

---

## 6. Optimistic exit animations

**Rule:** When an item leaves the list (deleted or checked off), mark it as
"exiting", wait for the CSS transition (~300 ms), then remove it from state and
sync to the server. Keep the animation duration and the timeout in sync.

**Why:** Items should glide out rather than vanish — it reads as calm and
intentional, and confirms the user's tap landed. Doing the wait before the state
removal keeps the leaving row on screen for the animation.

**How:**

```ts
const removeListItem = async (id) => {
  exitingItems.value = [...exitingItems.value, id];       // 1. mark exiting (CSS animates)
  await new Promise((r) => setTimeout(r, 300));           // 2. wait for the transition
  patchScheduler.cancel(id);                              // 3. cancel any pending write
  list.value = list.value.filter((li) => li.id !== id);   // 4. remove from state
  exitingItems.value = exitingItems.value.filter((x) => x !== id);
  startPending();
  try { await api.shoppingList.removeItem(listId, id); }  // 5. sync
  finally { endPending(); }
};
```

**See:** `hooks/useShoppingList.ts` — `exitingItems` (~line 31), `removeListItem`
(~line 129), `checkItem` (~line 147).

---

## 7. Debounced, merged background writes

**Rule:** For rapid successive edits to the same entity (quantity steppers, note
typing), don't fire a request per change. Use **`createDebouncedMergeScheduler`**:
it coalesces patches per id, flushes after a quiet delay (500 ms), flushes
immediately when the editor closes, and can be **cancelled** so a late write
can't resurrect a deleted item.

**Why:** Fewer requests, and the last write wins with merged fields. Explicit
`flush` on close makes edits feel saved the moment the user is done; `cancel` on
delete prevents a race where a queued PATCH revives a removed row.

**How:**

```ts
const patchScheduler = createDebouncedMergeScheduler({
  delayMs: 500,
  flush: async (id, patch) => { await api.shoppingList.updateItem(listId, id, patch); },
});
patchScheduler.schedule(id, patch); // on each edit (merges with pending)
patchScheduler.flush(id);           // on editor close (save now)
patchScheduler.cancel(id);          // on delete (drop the pending write)
```

**See:** `utils/debounce-update.ts` (the scheduler),
`hooks/useShoppingList.ts` (`patchScheduler`, `updateListItem`, `flushListItem`,
and the `cancel` calls in `removeListItem`/`checkItem`).

---

## 8. Cross-island shared state via module-scope signals

**Rule:** Islands are independent hydration roots and can't share React-style
context. When two islands must share state (e.g. a page island feeding an action
into the shell's app bar, or CRUD feeding the global loading bar), use a
**module-scope `signal()`** exported from a `utils/` module. Set it on mount,
clear it on unmount.

**Why:** A module-scope signal is a single shared instance across the client
runtime — the sanctioned channel for island-to-island communication. Full-page
navigation resets these for free.

**Signals rule (important):** `signal()` is safe **only** at module scope.
Inside a component/island body always use `useSignal()` — a bare `signal()` in a
function body creates a new instance every render and resets state. Hooks that
call `signal()` internally (like `useShoppingList`) must be instantiated once,
e.g. `useMemo(() => useShoppingList(...), [])`.

**See:** `utils/loading.ts` (`busyCount`/`navPending`), `utils/app-bar.ts`
(`appBarAction`, with the rationale in its doc comment),
`islands/add-items.tsx` (`useMemo(() => useShoppingList(...), [])`, ~line 42).
Also documented in `CLAUDE.md` ("Signals in islands").

---

## 9. Build on the MD3 component library

**Rule:** Compose UI from the Material 3 components in `components/md3/` and the
design tokens in `components/md3/tokens.ts` (and the `--md-*` CSS variables).
Don't hand-roll buttons, sheets, chips, spinners, list items, etc., and don't
hardcode colors/spacing/shape — use the tokens and semantic Tailwind classes
(`bg-primary`, `text-on-surface`, `rounded-[var(--md-shape-sm)]`, `md-body-medium`).

**Why:** One visual system keeps the app coherent and theme-aware (light/dark,
safe areas) with far less bespoke CSS. New modules of the platform should feel
like the same product.

**How:** Reach for the existing pieces first: `Button`, `IconButton`,
`Pressable`, `Card`, `Sheet` (bottom sheets), `Snackbar`, `Spinner`, `Progress`,
`Chip`, `Segmented`, `ListItem`, `Icon`, `SearchBar`, `Stepper`, `RoundCheck`,
`PullToRefresh`, `FabMenu`, `CategoryPickerList`. Confirmations use a bottom
`Sheet`, not a browser `confirm()` or a center modal.

**See:** `components/md3/` (component set), `components/md3/tokens.ts` (tokens +
`cn` helper).

---

## 10. Mobile-first & PWA details

**Rule:** Design for a phone held one-handed first, desktop second. Respect safe
areas, keep primary actions reachable at the bottom, make touch targets
generous, and support the on-the-go gestures.

**Why:** The core use is checking off items while out shopping. The app is a PWA
and must feel native on a phone.

**How / conventions in use:**

- **Safe areas:** pad against `env(safe-area-inset-*)` for anything pinned to a
  screen edge (see `Snackbar`, `GlobalLoadingBar`).
- **Bottom-anchored actions:** primary navigation is a bottom `NavigationBar`;
  the create action is a `Fab`; overlays slide up as bottom `Sheet`s.
- **Pull-to-refresh:** wrap a scroll view in `PullToRefresh` (driven by
  `usePullToRefresh`); a failed refresh surfaces the error snackbar.
- **Full-screen flows on mobile:** heavy tasks (adding items) can render as a
  full-screen overlay rather than a cramped dialog (`islands/add-items.tsx`).

**See:** `islands/shell/` (`NavigationBar`, `Fab`, `TopAppBar`, `AppChrome`),
`components/md3/PullToRefresh.tsx`, `hooks/usePullToRefresh.ts`,
`islands/add-items.tsx`.

---

## 11. Progressive enhancement for capability-gated features

**Rule:** When a feature relies on a browser capability that isn't universally
available (camera `BarcodeDetector`, Web Share, notifications…), **feature-detect
on the client and degrade gracefully.** The core flow must always work without
it; the capability is purely additive.

**Why:** The app is a mobile-first PWA spanning Android/Chrome and iOS Safari,
whose capabilities differ. Loyalty cards must be addable by **typing** a number
on every device; camera scanning is a shortcut offered only where it exists.
Assuming a capability breaks the whole screen on browsers that lack it.

**How:**

- Initialise a `useSignal(false)` and flip it to `true` inside a mount
  `useEffect` **only** when the capability is present — so SSR and the first
  client render agree (no hydration mismatch), then the enhanced control appears
  after hydration.
- Conditionally render the enhanced affordance on that signal; the fallback path
  (manual entry) is always present.
- Wrap the capability's async calls in `try/catch` and surface failures via a
  **Snackbar** (see §3) rather than letting them throw.

```ts
const available = useSignal(false);
useEffect(() => {
  if (scannerSupported()) available.value = true; // client-only probe
}, []);
// …
{available.value && <button onClick={openScanner}>Scan</button>}
```

**See:** `components/cards/ScannerOverlay.tsx` (`scannerSupported()` +
`getUserMedia`/`BarcodeDetector` in a guarded effect), `islands/cards/LoyaltyWallet.tsx`
(`scannerAvailable`). Barcodes themselves render from a pure library call
(`bwip-js` `toSVG`) served as an `<img>` data URI — see
`components/md3/Barcode.tsx`.

---

## 12. Keyboard primer / focus hand-off for dynamically mounted inputs

**Rule:** When a tap should open a surface whose real input field doesn't exist
yet — it mounts later, on a signal flip — don't call `.focus()` on that field
after the fact, and don't reach for `autofocus`. Instead, focus a hidden 1×1
**primer** `<input>` (`aria-hidden`, `tabIndex={-1}`, opacity 0)
**synchronously inside the tap handler**. The primer holds focus (and the
mobile keyboard) while the real field mounts, hands focus to it once it
exists, then unmounts.

**Why:** Mobile browsers only raise the soft keyboard from a `.focus()` call
made within the user-activation window of a real tap. The real field mounts on
a later, signal-driven re-render, so focusing it after the fact is usually too
late — and at tap-time there's nothing to focus anyway. `autofocus` doesn't
solve this either: browsers only honor it during initial document parse, so
it's inert on an element that mounts dynamically afterwards. This repo has
been bitten twice by skipping the hand-off: PR #45 fixed a regression where
the primer unmounted before the real field confirmed focus, dropping focus to
`<body>` and dismissing the keyboard; and the to-dos create sheet originally
shipped with a bare `autofocus` on its title input that never fired, until it
was replaced with this pattern.

**How:**

```ts
const primerRef = useRef<HTMLInputElement>(null);
const realRef = useRef<HTMLInputElement>(null);
const handoff = useSignal(false);

const openSurface = () => {
  handoff.value = false;
  primerRef.current?.focus(); // inside the tap — this is what raises the keyboard
  open.value = true;
};

useEffect(() => {
  if (open.value) {
    realRef.current?.focus(); // hand off once the real field exists
    handoff.value = true;
  }
}, [open.value]);

// Stays mounted (and focusable) until the hand-off completes, then unmounts —
// leaving the real field as the keyboard's only accessory-bar entry.
{(!open.value || !handoff.value) && (
  <input
    ref={primerRef}
    type="text"
    aria-hidden="true"
    tabIndex={-1}
    class="fixed top-0 left-0 opacity-0 pointer-events-none"
    style={{ width: 1, height: 1, fontSize: 16 }}
  />
)}
```

`fontSize: 16` on the primer (and on the real field it hands off to) is
deliberate — below 16px, iOS Safari zooms the whole page in on focus.

**Don't** reach for this on a surface that's already mounted before the tap, or
where the user is expected to tap the field themselves — the primer only earns
its keep when the real field doesn't exist yet at tap-time.

**See:** `islands/items.tsx` — `primerRef`/`handoff`/`openAdd`/`closeAdd`
(~lines 81–100) and the primer element (~lines 704–726), which hands off via
`AddItems`'s `onSearchFocus` callback. `islands/todos/TodoBacklog.tsx` — the
same shape for the create sheet: `primerRef`/`handoff`/`openCreate`/
`closeCreate` (~lines 54–78) and the primer element (~lines 217–232).

---

## 13. Create sheets that stay open for rapid capture

**Rule:** Most create sheets close on save (New list, Add card, Add dish).
Where a user plausibly adds several things in one sitting — the to-do backlog
— the sheet **stays open** after a successful save: it clears its fields and
keeps focus on the title field, and closes only via its own "Close" button or
the scrim.

**Why:** It removes two taps per item (no re-opening the sheet for each
entry), and it keeps the mobile keyboard up between entries instead of
dismissing and re-raising it — the same class of problem the keyboard primer
(§12) exists to solve.

**Don't** use this for creates that need a decision per item (choosing a
category, a barcode format) — there the sheet closing *is* the confirmation
that the item was captured correctly.

**How:**

```ts
const submitNew = async () => {
  const title = newTitle.value.trim();
  if (!title) return;
  const notes = newNotes.value.trim();
  const created = await addTodo({ title, notes: notes || undefined });
  if (!created) {
    say("Couldn't add that to-do. Try again?");
    return;
  }
  // Keep the sheet open and the field focused for the next entry.
  newTitle.value = "";
  newNotes.value = "";
};
```

**See:** `islands/todos/TodoBacklog.tsx` — the create `Sheet` (~line 242) and
`submitNew` (~line 93).

---

## Review checklist for user-facing changes

Before merging anything the user sees, tick these (section refs in parens):

- [ ] **Does every new mutation surface failure to the user — rollback (where
      applicable) **and** a Snackbar — rather than failing silently? (§3)** No
      new fire-and-forget `void` mutations.
- [ ] Mutations follow optimistic (update/delete/toggle) vs. pessimistic
      (create) correctly? (§1)
- [ ] All network access goes through the `api` service, and the caller reacts
      to the `null`/`[]` result? (§2)
- [ ] Loading shown via the global bar / `Button loading` — no ad-hoc CRUD
      spinners? (§4)
- [ ] Collections filtered with `useSearchBox` (trim, empty-means-all,
      focus-after-clear)? (§5)
- [ ] Items animate out on remove (§6); rapid successive edits are debounced and
      cancel-on-delete? (§7)
- [ ] Cross-island state uses a module-scope signal, and components use
      `useSignal` (never a bare `signal()` in a body)? (§8)
- [ ] UI is composed from MD3 components + tokens, not hand-rolled or
      hardcoded colors/spacing? (§9)
- [ ] Works mobile-first: safe areas respected, primary actions reachable, touch
      targets generous, gestures supported? (§10)

## Extending this document

When you introduce or discover a UI/UX pattern worth reusing, add a section here
in the same shape (**Rule → Why → How → See**). Keep entries tight and link to
the real code rather than duplicating it — the code is the source of truth, this
doc is the map. If a pattern changes, update the entry and its `See` references
in the same change.

Candidate topics still to document as they solidify: form validation & inline
errors, confirmation/destructive-action flow, empty & loading states for whole
screens, drag-to-reorder, and offline behavior.
