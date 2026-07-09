import { page } from "fresh";
import { CategoryRepo, ItemRepo } from "@/database/index.ts";
import Catalogue from "@/islands/catalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(_ctx) {
    const [items, categories] = await Promise.all([
      ItemRepo.readAll(),
      CategoryRepo.getAll(),
    ]);
    return page({ items, categories });
  },
});

export default define.page<typeof handler>(function CataloguePage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <Catalogue
        initialItems={data.items}
        initialCategories={data.categories}
      />
    </main>
  );
});
