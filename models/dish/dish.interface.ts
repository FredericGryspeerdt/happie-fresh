import type { ShoppingAmount } from "@/models/shopping-list/shopping-list-item.interface.ts";

export interface DishInterface {
  id: string;
  name: string;
  ingredientIds: string[]; // → catalogue Item ids (["items", id])
  ingredientAmounts?: Record<string, ShoppingAmount>;
  tagValueIds: string[]; // → DishTagValue ids, flat across all groups
  createdAt?: string;
  createdBy?: string;
}

// Derived type for creation (no ID)
export type CreateDishDto = Omit<DishInterface, "id">;

// Derived type for patch/update operations: never the id, all other fields optional
export type UpdateDishDto = Partial<Omit<DishInterface, "id">>;
