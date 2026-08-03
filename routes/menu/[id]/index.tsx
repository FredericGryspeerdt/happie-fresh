import { page } from "fresh";
import { DishRepo, DishTagGroupRepo, ItemRepo } from "@/database/index.ts";
import DishEditor from "@/islands/dishes/DishEditor.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const dish = await DishRepo.getById(householdId, ctx.params.id);
    if (!dish) return new Response("Not found", { status: 404 });
    await DishTagGroupRepo.ensureDefaults(householdId);
    ctx.state.appBar = { mode: "detail", title: dish.name, backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
    ]);
    return page({ dish, tagGroups, items });
  },
});

export default define.page<typeof handler>(function DishDetailPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishEditor
        dish={data.dish}
        tagGroups={data.tagGroups}
        items={data.items}
      />
    </main>
  );
});
