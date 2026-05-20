export interface ShoppingListInterface {
  id: string;
  householdId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export type CreateShoppingListDto = Omit<ShoppingListInterface, "id">;
