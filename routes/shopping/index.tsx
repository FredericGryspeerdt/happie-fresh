import { page } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
import ShoppingListsIsland from "@/islands/shopping-lists.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const lists = await ShoppingListRepo.getAll(householdId);
    const withCounts = await Promise.all(lists.map(async (l) => {
      const items = await ShoppingListItemRepo.getAll(l.id);
      return {
        ...l,
        total: items.length,
        done: items.filter((i) => i.checked).length,
      };
    }));
    return page({ lists: withCounts });
  },
});

export default define.page<typeof handler>(function Lists({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <ShoppingListsIsland initialLists={data.lists} />
    </main>
  );
});
