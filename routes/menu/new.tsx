import { page } from "fresh";
import { DishTagGroupRepo, ItemRepo } from "@/database/index.ts";
import DishEditor from "@/islands/dishes/DishEditor.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    await DishTagGroupRepo.ensureDefaults(householdId);
    ctx.state.appBar = { mode: "detail", title: "New dish", backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(householdId),
      ItemRepo.readAll(householdId),
    ]);
    return page({
      tagGroups,
      items,
      canDelete: ctx.state.actingMember?.isManager === true,
    });
  },
});

export default define.page<typeof handler>(function NewDishPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishEditor
        tagGroups={data.tagGroups}
        items={data.items}
        canDelete={data.canDelete}
      />
    </main>
  );
});
