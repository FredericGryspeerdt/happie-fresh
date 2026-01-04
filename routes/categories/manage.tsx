import { page } from "fresh";
import { CategoryRepo } from "@/database/index.ts";
import CategoryManagement from "@/islands/category-management.tsx";
import { homePage } from "@/utils/index.ts";

export const handler = homePage.handlers({
  async GET(ctx) {
    const categories = await CategoryRepo.getAll();
    return page({ categories });
  },
});

export default homePage.page<typeof handler>(function ManageCategories({ data }) {
  return (
    <main class="max-w-2xl mx-auto p-4">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">Manage Categories</h1>
        <p class="text-gray-600">Create, edit, and reorder item categories for your shopping list.</p>
      </div>
      <CategoryManagement categories={data.categories} />
    </main>
  );
});
