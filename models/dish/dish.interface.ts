export interface DishInterface {
  id: string;
  name: string;
  ingredientIds: string[]; // → catalogue Item ids (["items", id])
  tagValueIds: string[]; // → DishTagValue ids, flat across all groups
  createdAt?: string;
  createdBy?: string;
}

// Derived type for creation (no ID)
export type CreateDishDto = Omit<DishInterface, "id">;

// Derived type for updating (ID + partial fields)
export type UpdateDishDto =
  & Pick<DishInterface, "id">
  & Partial<Omit<DishInterface, "id">>;
