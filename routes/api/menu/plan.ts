import { WeeklyMenuRepo } from "@/database/index.ts";
import type { Weekday } from "@/models/index.ts";
import { define } from "@/utils/index.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await WeeklyMenuRepo.get(householdId));
  },

  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { dishId } = await ctx.req.json();
    if (!dishId) return new Response("dishId required", { status: 400 });
    return json(await WeeklyMenuRepo.addDish(householdId, dishId));
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { entryId, day } = await ctx.req.json();
    if (!entryId) return new Response("entryId required", { status: 400 });
    if (day !== null && !WEEKDAYS.includes(day)) {
      return new Response("invalid day", { status: 400 });
    }
    return json(await WeeklyMenuRepo.setDay(householdId, entryId, day));
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { entryId, clear } = await ctx.req.json();
    if (clear === true) return json(await WeeklyMenuRepo.clear(householdId));
    if (!entryId) {
      return new Response("entryId or clear required", { status: 400 });
    }
    return json(await WeeklyMenuRepo.removeEntry(householdId, entryId));
  },
});
