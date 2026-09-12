import type {
  ShoppingListItemInterface,
  ShoppingUnit,
} from "./shopping-list-item.interface.ts";

// One ingredient to put on a list. `note` is only applied to entries the bulk
// add creates or to existing entries whose note is empty.
export interface BulkAddItemInput {
  itemId: string;
  quantity?: number;
  unit?: ShoppingUnit;
  note?: string;
}

export interface BulkAddOptions {
  requestId: string;
  addToExisting: true;
}

export interface BulkAddResult {
  // Existing unchecked entries incremented by an additive request.
  updated?: ShoppingListItemInterface[];
  // Entries created by this call (requested amount or quantity 1, unchecked).
  added: ShoppingListItemInterface[];
  // Entries that were checked ("bought") and are now unchecked again.
  restored: ShoppingListItemInterface[];
  // Item ids that were already on the list, unchecked — left as they were.
  skipped: string[];
}
