import { page } from "fresh";
import { ItemRepo, CategoryRepo } from "@/database/index.ts";
import ItemCatalog from "@/islands/item-catalog.tsx";
import { homePage } from "@/utils/index.ts";

export const handler = homePage.handlers({
  async GET(ctx) {
    const items = await ItemRepo.readAll();
    const categories = await CategoryRepo.getAll();
    return page({ items, categories });
  },
});

export default homePage.page<typeof handler>(function Items({ data }) {
  return (
    <main class="max-w-4xl mx-auto p-4">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">Item Catalog</h1>
        <p class="text-gray-600">Manage your shopping items and categories.</p>
      </div>
      <ItemCatalog items={data.items} categories={data.categories} />
    </main>
  );
});
