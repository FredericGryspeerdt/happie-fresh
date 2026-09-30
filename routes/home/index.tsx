import { page } from "fresh";
import { define } from "@/utils/index.ts";
import { loadHome } from "@/services/home.ts";
import Home from "@/islands/home/Home.tsx";
export const handler = define.handlers({
  async GET(ctx) {
    return page({ initial: await loadHome(ctx.state.householdId!) });
  },
});
export default define.page<typeof handler>(function HomePage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <Home initial={data.initial} />
    </main>
  );
});
