import type { ShoppingListItemInterface } from "./shopping-list-item.interface.ts";

// One ingredient to put on a list. `note` is only applied to entries the bulk
// add creates or to existing entries whose note is empty.
export interface BulkAddItemInput {
  itemId: string;
  note?: string;
}

export interface BulkAddResult {
  // Entries created by this call (quantity 1, unchecked).
  added: ShoppingListItemInterface[];
  // Entries that were checked ("bought") and are now unchecked again.
  restored: ShoppingListItemInterface[];
  // Item ids that were already on the list, unchecked — left as they were.
  skipped: string[];
}
