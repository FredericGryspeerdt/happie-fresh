import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/[id].ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  id: string,
  state: StateInterface,
): Context<StateInterface> {
  return { req, state, params: { id } } as unknown as Context<StateInterface>;
}

async function clearMembers() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["members"] })) {
    await kv.delete(e.key);
  }
}

const patch = (body: unknown) =>
  new Request("http://x/api/members/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = () => new Request("http://x/api/members/x", { method: "DELETE" });

function seed(
  name: string,
  isManager: boolean,
  householdId = "h1",
): Promise<MemberInterface> {
  return MemberRepo.create({
    householdId,
    name,
    color: "sky",
    emoji: "🙂",
    isManager,
  });
}

Deno.test({
  name: "PATCH — anyone edits their own name and avatar",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const res = await handler.PATCH(
      ctx(patch({ name: "Bo!", emoji: "🐸" }), kid.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 200);
    const updated = await res.json();
    assertEquals(updated.name, "Bo!");
    assertEquals(updated.emoji, "🐸");
  },
});

Deno.test({
  name: "PATCH — a non-manager cannot edit someone else",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const other = await seed("Pip", false);
    const res = await handler.PATCH(
      ctx(patch({ name: "Nope" }), other.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "PATCH — a non-manager cannot touch isManager, even on themselves",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const res = await handler.PATCH(
      ctx(patch({ isManager: true }), kid.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "PATCH — demoting the last manager is rejected with 409",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const res = await handler.PATCH(
      ctx(patch({ isManager: false }), mgr.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(res.status, 409);
  },
});

Deno.test({
  name: "PATCH — a manager demotes a manager when another remains",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const second = await seed("Robin", true);
    const res = await handler.PATCH(
      ctx(patch({ isManager: false }), second.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).isManager, false);
  },
});

Deno.test({
  name: "DELETE — manager removes a member; kid gets 403",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const kid = await seed("Bo", false);
    const forbidden = await handler.DELETE(
      ctx(del(), mgr.id, { householdId: "h1", actingMember: kid }),
    );
    assertEquals(forbidden.status, 403);
    const ok = await handler.DELETE(
      ctx(del(), kid.id, { householdId: "h1", actingMember: mgr }),
    );
    assertEquals(ok.status, 204);
    assertEquals(await MemberRepo.getById("h1", kid.id), null);
  },
});

Deno.test({
  name: "DELETE — removing the last manager is rejected with 409",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const res = await handler.DELETE(
      ctx(del(), mgr.id, { householdId: "h1", actingMember: mgr }),
    );
    assertEquals(res.status, 409);
  },
});

const delWithCookie = (cookieMemberId: string) =>
  new Request("http://x/api/members/x", {
    method: "DELETE",
    headers: { Cookie: `actingMemberId=${cookieMemberId}` },
  });

Deno.test({
  name: "PATCH — a manager edits another member's name and color",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const kid = await seed("Bo", false);
    const res = await handler.PATCH(
      ctx(patch({ name: "Bobby", color: "coral" }), kid.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(res.status, 200);
    const updated = await res.json();
    assertEquals(updated.name, "Bobby");
    assertEquals(updated.color, "coral");
  },
});

Deno.test({
  name:
    "DELETE — clears the acting cookie only when it claimed the removed member",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const kid = await seed("Bo", false);
    const cleared = await handler.DELETE(
      ctx(delWithCookie(kid.id), kid.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(cleared.status, 204);
    assertEquals(
      cleared.headers.get("set-cookie")?.includes("actingMemberId="),
      true,
    );

    const other = await seed("Pip", false);
    const untouched = await handler.DELETE(
      ctx(delWithCookie(mgr.id), other.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(untouched.status, 204);
    assertEquals(untouched.headers.get("set-cookie"), null);
  },
});
