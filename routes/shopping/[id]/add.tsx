import { page } from "fresh";
import {
  CategoryRepo,
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
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
    ctx.state.appBar = {
      mode: "detail",
      title: "Add items",
      backUrl: `/shopping/${listId}`,
    };
    const [items, shoppingList, categories] = await Promise.all([
      ItemRepo.readAll(),
      ShoppingListItemRepo.getAll(listId),
      CategoryRepo.getAll(),
    ]);
    const initialQuery = ctx.url.searchParams.get("q") ?? "";
    return page({ list, items, shoppingList, categories, initialQuery });
  },
});

export default define.page<typeof handler>(function AddItemsPage({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <AddItemsIsland
        listId={data.list.id}
        listName={data.list.name}
        items={data.items}
        shoppingList={data.shoppingList}
        categories={data.categories}
        initialQuery={data.initialQuery}
      />
    </main>
  );
});
