# Search Box Auto-Close After Add

## Summary

After a search result is added to the shopping list, the search results panel
closes automatically by resetting the query.

## Current Behavior

`handleAddToList` in `islands/items.tsx` adds the item but leaves `query.value`
non-empty, so the results panel remains open.

## Desired Behavior

The results panel closes immediately after a successful add (i.e., when the API
returns an id), matching the behavior of `handleCreateItem` which already calls
`reset()`.

## Change

In `islands/items.tsx`, update `handleAddToList` to call `reset()` on success:

```ts
const handleAddToList = async (itemId: string) => {
  const id = await addToList(itemId);
  if (id) {
    lastAddedId.value = id;
    reset();
  }
};
```

`reset()` is provided by `useSearchBox` and clears `query.value`, which
collapses the panel via the `hasSearchQuery` computed in `SearchBox`.

## Scope

Single file, single function. No changes to `SearchBox` API or props.
