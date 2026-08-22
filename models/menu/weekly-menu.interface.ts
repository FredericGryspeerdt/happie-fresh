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
  updatedAt?: string; // ISO string, stamped on each mutation
}
