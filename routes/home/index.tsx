import { page } from "fresh";
import { CategoryRepo, ItemRepo, ShoppingListRepo } from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { homePage } from "@/utils/index.ts";

export const handler = homePage.handlers({
  async GET(ctx) {
    const items = await ItemRepo.readAll();
    const userId = ctx.state.userId!;
    const shoppingList = await ShoppingListRepo.getAll(userId);
    const categories = await CategoryRepo.getAll();
    return page({ items, shoppingList, categories });
  },
});

export default homePage.page<typeof handler>(function Home({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <ItemsIsland items={data.items} shoppingList={data.shoppingList} categories={data.categories} />
    </main>
  );
});
