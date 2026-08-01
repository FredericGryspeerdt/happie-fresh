import { page } from "fresh";
import { DishRepo, DishTagGroupRepo } from "@/database/index.ts";
import DishCatalogue from "@/islands/dishes/DishCatalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    await DishTagGroupRepo.ensureDefaults(householdId);
    const [dishes, tagGroups] = await Promise.all([
      DishRepo.getAll(householdId),
      DishTagGroupRepo.getAll(householdId),
    ]);
    return page({ dishes, tagGroups });
  },
});

export default define.page<typeof handler>(function MenuPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishCatalogue
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
      />
    </main>
  );
});
