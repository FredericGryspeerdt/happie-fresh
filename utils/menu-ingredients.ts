import type {
  DishInterface,
  ItemInterface,
  MenuEntryInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

// How an ingredient relates to the target shopping list:
//   new     — not on the list; will be created
//   on-list — already on the list, unchecked; nothing to do
//   bought  — on the list but checked off; will be unchecked again
export type IngredientState = "new" | "on-list" | "bought";

export interface IngredientRow {
  itemId: string;
  name: string;
  // Names of the planned dishes that call for this item, in menu order.
  dishNames: string[];
  state: IngredientState;
}

export interface IngredientPreview {
  rows: IngredientRow[];
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

  // One state per item; an unchecked entry means "still to buy" and wins over
  // a checked duplicate.
  const stateByItem = new Map<string, IngredientState>();
  for (const li of listItems) {
    if (stateByItem.get(li.itemId) === "on-list") continue;
    stateByItem.set(li.itemId, li.checked ? "bought" : "on-list");
  }

  const rowByItem = new Map<string, IngredientRow>();
  const emptyDishes: DishInterface[] = [];
  for (const entry of entries) {
    const dish = dishById.get(entry.dishId);
    if (!dish) continue; // dish deleted since it was planned
    let resolved = 0;
    for (const itemId of dish.ingredientIds) {
      const item = itemById.get(itemId);
      if (!item) continue; // catalogue item deleted
      resolved++;
      const row = rowByItem.get(itemId);
      if (row) {
        if (!row.dishNames.includes(dish.name)) row.dishNames.push(dish.name);
        continue;
      }
      rowByItem.set(itemId, {
        itemId,
        name: item.name,
        dishNames: [dish.name],
        state: stateByItem.get(itemId) ?? "new",
      });
    }
    if (resolved === 0) emptyDishes.push(dish);
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
