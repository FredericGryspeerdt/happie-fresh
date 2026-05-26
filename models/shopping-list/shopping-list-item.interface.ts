export interface ShoppingListItemInterface {
  id: string;
  listId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

export type CreateShoppingListItemDto = Omit<ShoppingListItemInterface, "id">;
export type UpdateShoppingListItemDto =
  & Pick<ShoppingListItemInterface, "id">
  & Partial<Omit<ShoppingListItemInterface, "id">>;
