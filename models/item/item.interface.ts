// The "full" interface as it exists in the DB
export interface ItemInterface {
  id: string;
  name: string;
  categoryId?: string;
}

// Derived type for creation (No ID)
export type CreateItemDto = Omit<ItemInterface, "id">;

// Derived type for updating (ID + partial fields)
export type UpdateItemDto =
  & Pick<ItemInterface, "id">
  & Partial<Omit<ItemInterface, "id">>;
