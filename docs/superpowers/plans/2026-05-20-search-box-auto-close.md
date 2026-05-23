# Search Box Auto-Close After Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the search results panel automatically after a search result is
successfully added to the shopping list.

**Architecture:** `handleAddToList` in `islands/items.tsx` already has access to
`reset()` from `useSearchBox`. Calling `reset()` on success clears
`query.value`, which collapses the results panel via the `hasSearchQuery`
computed signal in `SearchBox`. No new abstractions needed.

**Tech Stack:** Deno, Fresh 2, Preact, @preact/signals

---

### Task 1: Call reset() after successful add

**Files:**

- Modify: `islands/items.tsx:80-83`

- [ ] **Step 1: Update `handleAddToList`**

Replace the existing function:

```ts
const handleAddToList = async (itemId: string) => {
  const id = await addToList(itemId);
  if (id) lastAddedId.value = id;
};
```

With:

```ts
const handleAddToList = async (itemId: string) => {
  const id = await addToList(itemId);
  if (id) {
    lastAddedId.value = id;
    reset();
  }
};
```

- [ ] **Step 2: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 3: Verify manually**

Start the dev server (`deno task dev`), log in, type a search term, click the
`+` button on a result. The results panel should close immediately. Type another
term to confirm search still works.

- [ ] **Step 4: Commit**

```bash
git add islands/items.tsx
git commit -m "feat: close search results panel after adding item to list"
```
