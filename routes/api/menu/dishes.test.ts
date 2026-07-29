import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/menu/dishes.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(req: Request): Context<unknown> {
  return { req } as unknown as Context<unknown>;
}
async function clearDishes() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dishes"] })) await kv.delete(e.key);
}
const post = (body: unknown) =>
  new Request("http://x/api/menu/dishes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST creates (201), GET lists it, POST with id updates (200)",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const createRes = await handler.POST(
      ctx(post({ name: "Curry", ingredientIds: [], tagValueIds: [] })),
    );
    assertEquals(createRes.status, 201);
    const created = await createRes.json();

    const listRes = await handler.GET(
      ctx(new Request("http://x/api/menu/dishes")),
    );
    assertEquals(listRes.status, 200);
    const list = await listRes.json();
    assertEquals(list.map((d: { name: string }) => d.name), ["Curry"]);

    const updateRes = await handler.POST(
      ctx(post({ id: created.id, name: "Veggie Curry" })),
    );
    assertEquals(updateRes.status, 200);
    assertEquals((await updateRes.json()).name, "Veggie Curry");
  },
});

Deno.test({
  name: "POST with unknown id returns 404",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const res = await handler.POST(ctx(post({ id: "nope", name: "x" })));
    assertEquals(res.status, 404);
  },
});

Deno.test({
  name: "DELETE removes a dish (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await (await handler.POST(
      ctx(post({ name: "Toast", ingredientIds: [], tagValueIds: [] })),
    )).json();
    const delReq = new Request("http://x/api/menu/dishes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    });
    assertEquals((await handler.DELETE(ctx(delReq))).status, 204);

    const badReq = new Request("http://x/api/menu/dishes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals((await handler.DELETE(ctx(badReq))).status, 400);
  },
});
