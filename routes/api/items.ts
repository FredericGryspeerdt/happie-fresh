import { FreshContext } from "fresh";
import { ItemRepo } from "../../database/item.repo.ts";

export const handler = {
  async POST(_ctx: FreshContext) {
    const req = ctx.req;
    const item = await req.json();
    if (item.id) {
      // If an ID is provided, update the existing item
      const existingItem = await ItemRepo.getById(item.id);
      if (!existingItem) {
        return new Response("Item not found", { status: 404 });
      }
      await ItemRepo.update(item.id, item);
      return new Response(JSON.stringify({ ...existingItem, ...item }), {
        status: 200,
      });
    }
    const saved = await ItemRepo.create(item);
    return new Response(JSON.stringify(saved), { status: 201 });
  },
  async GET(_ctx: FreshContext) {
    const items = await ItemRepo.readAll();
    return new Response(
      JSON.stringify(items),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
  async DELETE(_ctx: FreshContext) {
    const req = ctx.req;
    const { id } = await req.json();
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    await ItemRepo.delete(id);
    return new Response(null, { status: 204 });
  },
};
