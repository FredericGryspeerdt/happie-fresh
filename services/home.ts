import {
  CategoryRepo,
  DishRepo,
  ItemRepo,
  MemberRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
  TodoRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";

/** Every read starts with the authenticated household; never accepts client list ids. */
export async function loadHome(householdId: string) {
  const [todos, members, lists, menu, dishes, items, categories] = await Promise
    .all([
      TodoRepo.getAll(householdId),
      MemberRepo.getAll(householdId),
      ShoppingListRepo.getAll(householdId),
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
      CategoryRepo.getAll(householdId),
    ]);
  return {
    todos,
    members,
    menu,
    dishes,
    items,
    categories,
    lists: await Promise.all(
      lists.map(async (list) => ({
        ...list,
        entries: await ShoppingListItemRepo.getAll(list.id),
      })),
    ),
  };
}
export type HomeData = Awaited<ReturnType<typeof loadHome>>;
