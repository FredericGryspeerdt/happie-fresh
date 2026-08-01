import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/menu/tag-groups.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = { householdId: "hh-1" },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearGroups() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dish_tag_groups"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups"), {}),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "GET seeds defaults and returns the groups",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups")),
    );
    assertEquals(res.status, 200);
    const groups = await res.json();
    assertEquals(groups.map((g: { label: string }) => g.label), [
      "Type",
      "Meal",
      "Side type",
    ]);
  },
});

Deno.test({
  name: "POST adds a value to a group (201); missing group is 404",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    const groups = await (await handler.GET(
      ctx(new Request("http://x/api/menu/tag-groups")),
    )).json();
    const addReq = (body: unknown) =>
      new Request("http://x/api/menu/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const okRes = await handler.POST(
      ctx(addReq({ groupId: groups[0].id, label: "Vegan" })),
    );
    assertEquals(okRes.status, 201);
    assertEquals((await okRes.json()).label, "Vegan");

    const missRes = await handler.POST(
      ctx(addReq({ groupId: "nope", label: "x" })),
    );
    assertEquals(missRes.status, 404);
  },
});
