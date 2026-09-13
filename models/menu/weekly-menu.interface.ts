export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const WEEKDAY_ORDER: Weekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export interface MenuEntryInterface {
  id: string; // stable entry id (crypto.randomUUID)
  dishId: string; // → ["dishes", dishId]
  day: Weekday | null; // optional weekday pin; null = "Any day"
}

export interface WeeklyMenuInterface {
  householdId: string;
  entries: MenuEntryInterface[];
  // Last shopping list this week's ingredients were added to
  // (→ ["shopping_lists", householdId, id]). A preference, not a "was this
  // shopped" flag — the list itself is the source of truth.
  shoppingListId?: string;
  updatedAt?: string; // ISO string, stamped on each mutation
}
