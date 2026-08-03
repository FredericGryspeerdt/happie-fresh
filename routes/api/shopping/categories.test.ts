import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/shopping/categories.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = {
    householdId: "hh-1",
    userId: "u-1",
  },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearCategories() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["categories"] })) {
    await kv.delete(e.key);
  }
}
const post = (body: unknown) =>
  new Request("http://x/api/shopping/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.POST(ctx(post({ label: "Produce" }), {}));
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "POST creates (201); GET lists only this household's categories",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const res = await handler.POST(
      ctx(post({ label: "Produce" }), { householdId: "hh-a", userId: "u-a" }),
    );
    assertEquals(res.status, 201);

    const aList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/categories"), {
        householdId: "hh-a",
        userId: "u-a",
      }),
    )).json();
    assertEquals(aList.map((c: { label: string }) => c.label), ["Produce"]);

    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/categories"), {
        householdId: "hh-b",
        userId: "u-b",
      }),
    )).json();
    assertEquals(bList, []);
  },
});

Deno.test({
  name: "DELETE removes a category (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const created = await (await handler.POST(ctx(post({ label: "Bakery" }))))
      .json();
    const delReq = new Request("http://x/api/shopping/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/shopping/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
