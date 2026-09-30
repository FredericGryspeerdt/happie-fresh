export interface ShoppingListInterface {
  id: string;
  householdId: string;
  name: string;
  /** Shared Start selection; absent on older lists means hidden. */
  showOnHome?: boolean;
  createdBy: string;
  createdAt: string;
}

export type CreateShoppingListDto = Omit<ShoppingListInterface, "id">;
