import { badRequest, define, json, requireManager } from "@/utils/index.ts";
import { MemberRepo } from "@/database/index.ts";
import { isAvatarColor } from "@/models/index.ts";

/** Shared field validation for create (all fields) — returns a message or the
 *  cleaned values. PATCH re-validates per-field in [id].ts. */
export function parseMemberFields(
  body: Record<string, unknown>,
): { name: string; color: string; emoji: string } | string {
  const name = String(body.name ?? "").trim();
  if (!name) return "name required";
  if (!isAvatarColor(body.color)) return "unknown color";
  const emoji = String(body.emoji ?? "").trim();
  if (!emoji || emoji.length > 16) return "emoji must be a short glyph";
  return { name, color: body.color, emoji };
}

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await MemberRepo.getAll(householdId));
  },

  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;

    const body = await ctx.req.json();
    const fields = parseMemberFields(body);
    if (typeof fields === "string") return badRequest(fields);

    const member = await MemberRepo.create({
      householdId,
      ...fields,
      isManager: body.isManager === true,
    });
    return json(member, 201);
  },
});
