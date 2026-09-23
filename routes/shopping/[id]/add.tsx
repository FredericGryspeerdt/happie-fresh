import { page } from "fresh";
import {
  CategoryRepo,
  DishRepo,
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import AddItemsIsland from "@/islands/add-items.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const listId = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) {
      return new Response("Not found", { status: 404 });
    }
    // Full-screen search surface: the island owns the top bar and there is no
    // bottom nav. The shell renders no chrome for mode:"none".
    ctx.state.appBar = { mode: "none" };
    const [items, shoppingList, categories, initialMenu, initialDishes] =
      await Promise.all([
        ItemRepo.readAll(householdId),
        ShoppingListItemRepo.getAll(listId),
        CategoryRepo.getAll(householdId),
        WeeklyMenuRepo.get(householdId),
        DishRepo.getAll(householdId),
      ]);
    const initialQuery = ctx.url.searchParams.get("q") ?? "";
    return page({
      list,
      items,
      shoppingList,
      categories,
      initialMenu,
      initialDishes,
      initialQuery,
    });
  },
});

export default define.page<typeof handler>(function AddItemsPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <AddItemsIsland
        listId={data.list.id}
        listName={data.list.name}
        targetList={data.list}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
        initialMenu={data.initialMenu}
        initialDishes={data.initialDishes}
        initialQuery={data.initialQuery}
      />
    </main>
  );
});
