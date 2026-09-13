import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/index.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function member(
  id: string,
  householdId: string,
  isManager: boolean,
): MemberInterface {
  return { id, householdId, name: "N", color: "sky", emoji: "🙂", isManager };
}

function ctx(req: Request, state: StateInterface): Context<StateInterface> {
  return { req, state, params: {} } as unknown as Context<StateInterface>;
}

async function clearMembers() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["members"] })) {
    await kv.delete(e.key);
  }
}

const post = (body: unknown) =>
  new Request("http://x/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const MANAGER = member("m-mgr", "h1", true);
const KID = member("m-kid", "h1", false);

Deno.test({
  name: "GET — lists the household's members for any member",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    await MemberRepo.create({
      householdId: "h1",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });
    const res = await handler.GET(
      ctx(new Request("http://x/api/members"), {
        householdId: "h1",
        actingMember: KID,
      }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).length, 1);
  },
});

Deno.test({
  name: "POST — a manager creates a member",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const res = await handler.POST(
      ctx(post({ name: "Pip", color: "lavender", emoji: "🦄" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(res.status, 201);
    const created = await res.json();
    assertEquals(created.name, "Pip");
    assertEquals(created.isManager, false);
    assertEquals(created.householdId, "h1");
  },
});

Deno.test({
  name: "POST — a non-manager gets 403",
  sanitizeResources: false,
  async fn() {
    const res = await handler.POST(
      ctx(post({ name: "Pip", color: "lavender", emoji: "🦄" }), {
        householdId: "h1",
        actingMember: KID,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "POST — rejects a missing name and an unknown colour",
  sanitizeResources: false,
  async fn() {
    const noName = await handler.POST(
      ctx(post({ name: "  ", color: "sky", emoji: "🙂" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(noName.status, 400);
    const badColor = await handler.POST(
      ctx(post({ name: "Pip", color: "neon", emoji: "🙂" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(badColor.status, 400);
  },
});
