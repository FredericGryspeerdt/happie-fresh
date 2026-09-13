import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/acting.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(req: Request, state: StateInterface): Context<StateInterface> {
  return { req, state, params: {} } as unknown as Context<StateInterface>;
}

const put = (body: unknown) =>
  new Request("http://x/api/members/acting", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "PUT — claims a member of the household and sets the cookie",
  sanitizeResources: false,
  async fn() {
    const bo = await MemberRepo.create({
      householdId: "h-act",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });
    const res = await handler.PUT(
      ctx(put({ memberId: bo.id }), { householdId: "h-act" }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).id, bo.id);
    const cookie = res.headers.get("set-cookie")!;
    assertEquals(cookie.includes(`actingMemberId=${bo.id}`), true);
  },
});

Deno.test({
  name: "PUT — a member of another household is 404; missing id is 400",
  sanitizeResources: false,
  async fn() {
    const stranger = await MemberRepo.create({
      householdId: "h-other",
      name: "Sam",
      color: "slate",
      emoji: "🐼",
      isManager: true,
    });
    const notMine = await handler.PUT(
      ctx(put({ memberId: stranger.id }), { householdId: "h-act" }),
    );
    assertEquals(notMine.status, 404);
    const missing = await handler.PUT(ctx(put({}), { householdId: "h-act" }));
    assertEquals(missing.status, 400);
  },
});
