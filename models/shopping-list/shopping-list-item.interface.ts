export const SHOPPING_UNITS = [
  "pieces",
  "g",
  "kg",
  "ml",
  "L",
  "packs",
] as const;
export type ShoppingUnit = typeof SHOPPING_UNITS[number];

export interface ShoppingAmount {
  quantity: number;
  unit: ShoppingUnit;
}

export interface ShoppingListItemInterface {
  id: string;
  listId: string;
  itemId: string;
  quantity: number;
  unit?: ShoppingUnit;
  note?: string;
  checked: boolean;
}

export type CreateShoppingListItemDto = Omit<ShoppingListItemInterface, "id">;
export type UpdateShoppingListItemDto =
  & Pick<ShoppingListItemInterface, "id">
  & Partial<Omit<ShoppingListItemInterface, "id">>;
