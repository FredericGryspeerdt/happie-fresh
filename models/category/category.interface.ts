export interface CategoryInterface {
  id: string;
  label: string;
  order?: number;
  createdAt?: string;
  createdBy?: string;
}

// Derived type for creation (No ID)
export type CreateCategoryDto = Omit<CategoryInterface, "id">;

// Derived type for updating (ID + partial fields)
export type UpdateCategoryDto =
  & Pick<CategoryInterface, "id">
  & Partial<Omit<CategoryInterface, "id">>;
