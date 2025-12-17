import { page } from "fresh";
import { ItemRepo } from "@/database/index.ts";
import ItemsIsland from "@/islands/items.tsx";
import { homePage } from "@/utils/index.ts";

export const handler = homePage.handlers({
  async GET(ctx) {
    const items = await ItemRepo.readAll();
    return page({ items });
  },
});

export default homePage.page<typeof handler>(function Home({ data }) {
  return (
    <main class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">Home</h1>
      <ItemsIsland data={data.items} />
    </main>
  );
});
