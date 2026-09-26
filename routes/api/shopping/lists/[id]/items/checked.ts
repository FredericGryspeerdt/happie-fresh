import { ShoppingListItemRepo } from "@/database/index.ts";
import { define, json } from "@/utils/index.ts";
import { authorizeList } from "@/utils/authorize-list.ts";

export const handler = define.handlers({
  async DELETE(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Geen toegang", { status: 403 });
    const cleared = await ShoppingListItemRepo.clearChecked(list.id);
    return json({ cleared });
  },
});
