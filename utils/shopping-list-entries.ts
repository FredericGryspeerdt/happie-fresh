import type { ShoppingListItemInterface } from "@/models/index.ts";

/** Resolve legacy duplicates consistently in previews and writes: the first
 * unchecked entry wins, otherwise the first bought entry is restored. */
export function shoppingEntriesByItem(
  entries: readonly ShoppingListItemInterface[],
): Map<string, ShoppingListItemInterface> {
  const byItem = new Map<string, ShoppingListItemInterface>();
  for (const entry of entries) {
    const current = byItem.get(entry.itemId);
    if (!current || (current.checked && !entry.checked)) {
      byItem.set(entry.itemId, entry);
    }
  }
  return byItem;
}
