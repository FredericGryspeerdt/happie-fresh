import { getCookies } from "$std/http/cookie.ts";
import {
  ACTING_MEMBER_COOKIE_NAME,
  badRequest,
  define,
  deleteActingMemberCookie,
  json,
  notFound,
  requireManager,
} from "@/utils/index.ts";
import { MemberRepo, TodoRepo } from "@/database/index.ts";
import { isAvatarColor, type UpdateMemberDto } from "@/models/index.ts";

const LAST_MANAGER_MSG =
  "The household needs at least one manager — promote someone else first";

export const handler = define.handlers({
  async PATCH(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }
    const target = await MemberRepo.getById(householdId, ctx.params.id);
    if (!target) return notFound("no such member");

    // Self-edit of name/avatar is open to everyone; everything else is
    // manager-only (grilled Q8).
    const isSelf = actingMember.id === target.id;
    if (!actingMember.isManager && !isSelf) {
      return new Response("Only a household manager can edit someone else", {
        status: 403,
      });
    }

    const body = await ctx.req.json();
    const patch: UpdateMemberDto = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return badRequest("name required");
      patch.name = name;
    }
    if (body.color !== undefined) {
      if (!isAvatarColor(body.color)) return badRequest("unknown color");
      patch.color = body.color;
    }
    if (body.emoji !== undefined) {
      const emoji = String(body.emoji).trim();
      if (!emoji || emoji.length > 16) {
        return badRequest("emoji must be a short glyph");
      }
      patch.emoji = emoji;
    }
    if (body.isManager !== undefined) {
      if (!actingMember.isManager) {
        return new Response(
          "Only a household manager can change who manages",
          { status: 403 },
        );
      }
      if (typeof body.isManager !== "boolean") {
        return badRequest("isManager must be a boolean");
      }
      if (
        body.isManager === false && target.isManager &&
        await MemberRepo.countManagers(householdId) <= 1
      ) {
        return new Response(LAST_MANAGER_MSG, { status: 409 });
      }
      patch.isManager = body.isManager;
    }

    const updated = await MemberRepo.update(householdId, target.id, patch);
    if (!updated) return notFound("no such member");
    return json(updated);
  },

  async DELETE(ctx) {
    const { householdId } = ctx.state;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;

    const target = await MemberRepo.getById(householdId, ctx.params.id);
    if (!target) return notFound("no such member");
    if (
      target.isManager && await MemberRepo.countManagers(householdId) <= 1
    ) {
      return new Response(LAST_MANAGER_MSG, { status: 409 });
    }

    // Hard delete, graceful dangle: attribution (createdBy) may now point at
    // a member that no longer resolves; renderers fall back (grilled Q9).
    await MemberRepo.delete(householdId, target.id);

    // Their open to-dos return to "up for grabs" — the work still needs doing
    // and must not be parked on a ghost. Done rows dangle (docs/adr/0007).
    await TodoRepo.unassignMember(householdId, target.id);

    // If this device's cookie claimed the removed member, clear it so the
    // picker reappears on the next visit rather than a stale claim lingering.
    const headers = new Headers();
    if (getCookies(ctx.req.headers)[ACTING_MEMBER_COOKIE_NAME] === target.id) {
      deleteActingMemberCookie(headers);
    }
    return new Response(null, { status: 204, headers });
  },
});
