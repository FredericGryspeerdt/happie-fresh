export interface ShoppingListItemInterface {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}
