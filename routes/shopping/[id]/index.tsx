import { page } from "fresh";
import {
  CategoryRepo,
  DishRepo,
  ItemRepo,
  LoyaltyCardRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { define } from "@/utils/index.ts";

export async function loadShoppingListPageData(
  householdId: string,
  listId: string,
) {
  const [
    items,
    shoppingList,
    categories,
    lists,
    loyaltyCards,
    initialMenu,
    initialDishes,
  ] = await Promise
    .all([
      ItemRepo.readAll(householdId),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(householdId),
      ShoppingListRepo.getAll(householdId),
      LoyaltyCardRepo.getAll(householdId),
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(householdId),
    ]);

  return {
    items,
    shoppingList,
    categories,
    loyaltyCards,
    initialMenu,
    initialDishes,
    otherLists: lists.filter((l) => l.id !== listId),
  };
}

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const listId = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, listId);
    if (!list) {
      return new Response("Not found", { status: 404 });
    }
    ctx.state.appBar = {
      mode: "detail",
      title: list.name,
      backUrl: "/shopping",
    };
    const data = await loadShoppingListPageData(householdId, listId);
    return page({
      list,
      ...data,
      canDelete: ctx.state.actingMember?.isManager === true,
    });
  },
});

export default define.page<typeof handler>(function ListDetail({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <ItemsIsland
        listId={data.list.id}
        listName={data.list.name}
        targetList={data.list}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
        loyaltyCards={data.loyaltyCards}
        initialMenu={data.initialMenu}
        initialDishes={data.initialDishes}
        canDelete={data.canDelete}
        otherLists={data.otherLists}
      />
    </main>
  );
});
