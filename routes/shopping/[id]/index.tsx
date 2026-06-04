import { page } from "fresh";
import {
  CategoryRepo,
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
} from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { define } from "@/utils/index.ts";

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
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
    return page({ list, items, shoppingList, categories });
  },
});

export default define.page<typeof handler>(function ListDetail({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <ItemsIsland
        listId={data.list.id}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
      />
    </main>
  );
});
