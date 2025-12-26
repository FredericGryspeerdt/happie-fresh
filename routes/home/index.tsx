import { page } from "fresh";
import { ItemRepo, ShoppingListRepo } from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { homePage } from "@/utils/index.ts";

export const handler = homePage.handlers({
  async GET(ctx) {
    console.log("🚀 ~ GET home page:");
    const items = await ItemRepo.readAll();
    const userId = ctx.state.userId!;
    const shoppingList = await ShoppingListRepo.getAll(userId);
    return page({ items, shoppingList });
  },
});

export default homePage.page<typeof handler>(function Home({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">Home</h1>
      <ItemsIsland items={data.items} shoppingList={data.shoppingList} />
    </main>
  );
});
