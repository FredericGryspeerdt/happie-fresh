import { shoppingEntriesByItem } from "@/utils/shopping-list-entries.ts";
import type {
  DishInterface,
  ItemInterface,
  MenuEntryInterface,
  ShoppingAmount,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import {
  addShoppingAmounts,
  compatibleShoppingUnits,
} from "@/utils/shopping-amount.ts";

// How an ingredient relates to the target shopping list:
//   new     — not on the list; will be created
//   on-list — already on the list, unchecked; the selected amount is additional
//   bought  — on the list but checked off; will be unchecked again
export type IngredientState = "new" | "on-list" | "bought";

export interface DishIngredientRequirement {
  dishName: string;
  amount?: ShoppingAmount;
}

export interface IngredientRow {
  itemId: string;
  name: string;
  // Names of the planned dishes that call for this item, in menu order.
  dishNames: string[];
  requirements?: DishIngredientRequirement[];
  missingDishNames?: string[];
  suggestedAmount?: ShoppingAmount;
  amountIssue?: "incompatible" | "unrepresentable";
  state: IngredientState;
  existingAmount?: ShoppingAmount;
}

export interface CollectedIngredientRow extends IngredientRow {
  requirements: DishIngredientRequirement[];
  missingDishNames: string[];
}

export interface IngredientPreview {
  rows: CollectedIngredientRow[];
  // Planned dishes that contribute no resolvable ingredient at all.
  emptyDishes: DishInterface[];
}

// The single place the client-side preview rules live: dedup across dishes,
// resolve list state, drop dangling references, sort for reading.
export function collectIngredients(
  entries: MenuEntryInterface[],
  dishes: DishInterface[],
  items: ItemInterface[],
  listItems: ShoppingListItemInterface[],
): IngredientPreview {
  const dishById = new Map(dishes.map((d) => [d.id, d]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const listEntryByItem = shoppingEntriesByItem(listItems);

  const rowByItem = new Map<string, CollectedIngredientRow>();
  const emptyDishes: DishInterface[] = [];
  const seenDishes = new Set<string>();
  for (const entry of entries) {
    const dish = dishById.get(entry.dishId);
    if (!dish) continue; // dish deleted since it was planned
    if (seenDishes.has(dish.id)) continue;
    seenDishes.add(dish.id);
    let resolved = 0;
    const seenIngredients = new Set<string>();
    for (const itemId of dish.ingredientIds) {
      const item = itemById.get(itemId);
      if (!item || seenIngredients.has(itemId)) continue; // deleted or duplicate
      seenIngredients.add(itemId);
      resolved++;
      const row = rowByItem.get(itemId);
      if (row) {
        if (!row.dishNames.includes(dish.name)) row.dishNames.push(dish.name);
        row.requirements.push({
          dishName: dish.name,
          ...(dish.ingredientAmounts?.[itemId]
            ? { amount: dish.ingredientAmounts[itemId] }
            : {}),
        });
        continue;
      }
      const existing = listEntryByItem.get(itemId);
      rowByItem.set(itemId, {
        itemId,
        name: item.name,
        dishNames: [dish.name],
        requirements: [{
          dishName: dish.name,
          ...(dish.ingredientAmounts?.[itemId]
            ? { amount: dish.ingredientAmounts[itemId] }
            : {}),
        }],
        missingDishNames: [],
        state: existing ? (existing.checked ? "bought" : "on-list") : "new",
        ...(existing && !existing.checked
          ? {
            existingAmount: {
              quantity: existing.quantity,
              unit: existing.unit ?? "pieces",
            },
          }
          : {}),
      });
    }
    if (resolved === 0) emptyDishes.push(dish);
  }

  for (const row of rowByItem.values()) {
    const requirements = row.requirements;
    const known = requirements.filter((r) => r.amount);
    row.missingDishNames = requirements.filter((r) => !r.amount).map((r) =>
      r.dishName
    );
    if (known.length === 0) continue;
    let total = known[0].amount!;
    for (const requirement of known.slice(1)) {
      const amount = requirement.amount!;
      const next = addShoppingAmounts(total, amount);
      if (!next) {
        row.amountIssue = compatibleShoppingUnits(total.unit).includes(
            amount.unit,
          )
          ? "unrepresentable"
          : "incompatible";
        break;
      }
      total = next;
    }
    if (!row.amountIssue) row.suggestedAmount = total;
  }

  const rows = [...rowByItem.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return { rows, emptyDishes };
}

// The note written on a list entry this action creates: which dishes want it.
export function noteFor(row: IngredientRow): string {
  return row.dishNames.join(", ");
}
