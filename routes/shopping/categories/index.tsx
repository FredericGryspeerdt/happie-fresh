import { page } from "fresh";
import { CategoryRepo } from "@/database/index.ts";
import CategoryReorder from "@/islands/category-reorder.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    ctx.state.appBar = {
      mode: "detail",
      title: "Aisle order",
      backUrl: "/shopping/catalogue",
    };
    const categories = await CategoryRepo.getAll();
    return page({ categories });
  },
});

export default define.page<typeof handler>(function CategoriesPage({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <CategoryReorder initialCategories={data.categories} />
    </main>
  );
});
