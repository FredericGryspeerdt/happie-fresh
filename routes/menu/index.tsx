import { page } from "fresh";
import {
  CategoryRepo,
  DishRepo,
  DishTagGroupRepo,
  ItemRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import MenuSubNav from "@/islands/menu/MenuSubNav.tsx";
import WeeklyMenu from "@/islands/menu/WeeklyMenu.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    await DishTagGroupRepo.ensureDefaults(householdId);
    const [menu, dishes, tagGroups, items, categories] = await Promise.all([
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(householdId),
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
      CategoryRepo.getAll(householdId),
    ]);
    return page({ menu, dishes, tagGroups, items, categories });
  },
});

export default define.page<typeof handler>(function MenuPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <MenuSubNav active="plan" />
      <WeeklyMenu
        initialMenu={data.menu}
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
        initialItems={data.items}
        initialCategories={data.categories}
      />
    </main>
  );
});
