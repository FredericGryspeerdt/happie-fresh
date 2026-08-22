import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
} from "@/utils/index.ts";
import { PushSubscriptionRepo } from "@/database/index.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await ctx.req.json();
    for (const field of ["endpoint", "p256dh", "auth"] as const) {
      if (typeof body[field] !== "string" || !body[field]) {
        return badRequest(`${field} required`);
      }
    }

    const sub = await PushSubscriptionRepo.upsert({
      householdId,
      userId,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      createdAt: new Date().toISOString(),
    });
    return json(sub, 201);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const body = await ctx.req.json();
    if (typeof body.endpoint !== "string" || !body.endpoint) {
      return badRequest("endpoint required");
    }

    const removed = await PushSubscriptionRepo.deleteByEndpoint(
      householdId,
      body.endpoint,
    );
    if (!removed) return notFound("no such subscription");
    return noContent();
  },
});
