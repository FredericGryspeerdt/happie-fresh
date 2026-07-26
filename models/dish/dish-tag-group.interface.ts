export interface DishTagValueInterface {
  id: string;
  label: string;
}

export interface DishTagGroupInterface {
  id: string;
  label: string; // "Type", "Meal", "Side type"
  order?: number;
  values: DishTagValueInterface[]; // values embedded in the group
}
