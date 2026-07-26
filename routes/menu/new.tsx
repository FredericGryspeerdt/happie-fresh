import { page } from "fresh";
import { DishTagGroupRepo, ItemRepo } from "@/database/index.ts";
import DishEditor from "@/islands/dishes/DishEditor.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    ctx.state.appBar = { mode: "detail", title: "New dish", backUrl: "/menu" };
    const [tagGroups, items] = await Promise.all([
      DishTagGroupRepo.getAll(),
      ItemRepo.readAll(),
    ]);
    return page({ tagGroups, items });
  },
});

export default define.page<typeof handler>(function NewDishPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <DishEditor tagGroups={data.tagGroups} items={data.items} />
    </main>
  );
});
