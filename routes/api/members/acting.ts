import {
  badRequest,
  define,
  json,
  notFound,
  setActingMemberCookie,
} from "@/utils/index.ts";
import { MemberRepo } from "@/database/index.ts";

export const handler = define.handlers({
  /**
   * "I am this member on this device." Validates the member belongs to the
   * caller's household, then persists the claim in an HttpOnly cookie. Honor
   * system by design — see docs/adr/0006.
   */
  async PUT(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    const memberId = String(body.memberId ?? "");
    if (!memberId) return badRequest("memberId required");
    const member = await MemberRepo.getById(householdId, memberId);
    if (!member) return notFound("no such member");
    const res = json(member);
    setActingMemberCookie(res.headers, member.id);
    return res;
  },
});
