import { page } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";
import ShoppingListsIsland from "@/islands/shopping-lists.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const lists = await ShoppingListRepo.getAll(householdId);
    return page({ lists });
  },
});

export default define.page<typeof handler>(function Lists({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Shopping Lists</h1>
      <ShoppingListsIsland initialLists={data.lists} />
    </main>
  );
});
