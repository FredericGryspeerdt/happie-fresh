import type { ShoppingListItemInterface } from "./shopping-list-item.interface.ts";
import type { ShoppingListInterface } from "./shopping-list.interface.ts";

// Two checks per entry, plus both lists and the receipt, stay under KV's 100.
export const MAX_MOVE_ITEMS = 40;
export interface MoveItemsInput {
  requestId: string;
  itemIds: string[];
  destinationListId?: string;
  newListName?: string;
}
export type MoveItemsResult =
  | {
    ok: true;
    requestId: string;
    count: number;
    destination: ShoppingListInterface;
  }
  | { ok: false; error: string };
export type UndoMoveResult = {
  ok: true;
  count: number;
  items: ShoppingListItemInterface[];
} | { ok: false; error: string };
