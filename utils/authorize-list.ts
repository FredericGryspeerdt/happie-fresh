import { type Context } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";
import { type StateInterface } from "@/utils/define.ts";

/**
 * Resolve a shopping list and authorize it for the current household.
 * Returns the list when it belongs to the caller's household, otherwise null.
 */
export async function authorizeList(
  ctx: Context<StateInterface>,
  listId: string,
) {
  const householdId = ctx.state.householdId;
  if (!householdId) return null;
  const list = await ShoppingListRepo.getById(householdId, listId);
  if (!list) return null;
  return list;
}
