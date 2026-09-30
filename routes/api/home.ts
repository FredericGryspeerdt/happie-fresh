import { loadHome } from "@/services/home.ts";
import { define, json } from "@/utils/index.ts";
export const handler = define.handlers({
  async GET(ctx) {
    if (!ctx.state.householdId) return new Response(null, { status: 401 });
    const response = json(await loadHome(ctx.state.householdId));
    response.headers.set("Cache-Control", "no-store");
    return response;
  },
});
