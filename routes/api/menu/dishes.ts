import { type Context } from "fresh";
import { DishRepo } from "@/database/dish.repo.ts";

export const handler = {
  async GET(_ctx: Context<unknown>) {
    const dishes = await DishRepo.readAll();
    return new Response(JSON.stringify(dishes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(_ctx: Context<unknown>) {
    const body = await _ctx.req.json();
    if (body.id) {
      const updated = await DishRepo.update(body.id, body);
      if (!updated) return new Response("Dish not found", { status: 404 });
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    const created = await DishRepo.create(body);
    return new Response(JSON.stringify(created), { status: 201 });
  },
  async DELETE(_ctx: Context<unknown>) {
    const { id } = await _ctx.req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await DishRepo.delete(id);
    return new Response(null, { status: 204 });
  },
};
