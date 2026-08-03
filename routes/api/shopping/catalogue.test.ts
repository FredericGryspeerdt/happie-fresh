import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/shopping/catalogue.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  state: { householdId?: string; userId?: string } = { householdId: "hh-1" },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
}
async function clearItems() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["items"] })) await kv.delete(e.key);
}
const post = (body: unknown) =>
  new Request("http://x/api/shopping/catalogue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {}),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "POST creates (201) and GET lists only this household's items",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const createRes = await handler.POST(
      ctx(post({ name: "Milk" }), { householdId: "hh-a" }),
    );
    assertEquals(createRes.status, 201);

    const aList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {
        householdId: "hh-a",
      }),
    )).json();
    assertEquals(aList.map((i: { name: string }) => i.name), ["Milk"]);

    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/shopping/catalogue"), {
        householdId: "hh-b",
      }),
    )).json();
    assertEquals(bList, []);
  },
});

Deno.test({
  name: "DELETE removes an item (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const created = await (await handler.POST(ctx(post({ name: "Bread" }))))
      .json();
    const delReq = new Request("http://x/api/shopping/catalogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/shopping/catalogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
