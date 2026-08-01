import { page } from "fresh";
import {
  DishRepo,
  DishTagGroupRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import MenuSubNav from "@/islands/menu/MenuSubNav.tsx";
import DishCatalogue from "@/islands/dishes/DishCatalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    const householdId = ctx.state.householdId ?? "";
    const [menu, dishes, tagGroups] = await Promise.all([
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(),
      DishTagGroupRepo.getAll(),
    ]);
    return page({ menu, dishes, tagGroups });
  },
});

export default define.page<typeof handler>(function DishesPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <MenuSubNav active="dishes" />
      <DishCatalogue
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
        initialMenu={data.menu}
      />
    </main>
  );
});
