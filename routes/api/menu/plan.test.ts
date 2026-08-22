import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/menu/plan.ts";
import { DishRepo } from "@/database/index.ts";
import { getKv } from "@/database/db.ts";
import type { StateInterface } from "@/utils/index.ts";

Deno.env.set("KV_PATH", ":memory:");

// Use overloads to properly handle undefined vs default "h1"
function ctx(req: Request): Context<StateInterface>;
function ctx(
  req: Request,
  householdId: string | undefined,
): Context<StateInterface>;
function ctx(
  req: Request,
  householdId?: string | undefined,
): Context<StateInterface> {
  return {
    req,
    state: { householdId: arguments.length > 1 ? householdId : "h1" },
  } as unknown as Context<StateInterface>;
}
async function clearMenus() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["weekly_menu"] })) {
    await kv.delete(e.key);
  }
}
async function clearDishes() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dishes", "h1"] })) {
    await kv.delete(e.key);
  }
}
async function seedDish(name = "Pancakes") {
  const dish = await DishRepo.create("h1", {
    name,
    ingredientIds: [],
    tagValueIds: [],
  });
  return dish.id;
}
const req = (method: string, body?: unknown) =>
  new Request("http://x/api/menu/plan", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

Deno.test({
  name: "GET — 401 without a household",
  sanitizeResources: false,
  async fn() {
    assertEquals((await handler.GET(ctx(req("GET"), undefined))).status, 401);
  },
});

Deno.test({
  name: "POST adds; GET lists; PATCH pins a day; DELETE removes",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearDishes();
    const dishId = await seedDish();
    const addRes = await handler.POST(ctx(req("POST", { dishId })));
    assertEquals(addRes.status, 200);
    const added = await addRes.json();
    assertEquals(added.entries.map((e: { dishId: string }) => e.dishId), [
      dishId,
    ]);
    const entryId = added.entries[0].id;

    const getRes = await handler.GET(ctx(req("GET")));
    assertEquals((await getRes.json()).entries.length, 1);

    const patchRes = await handler.PATCH(
      ctx(req("PATCH", { entryId, day: "Wed" })),
    );
    assertEquals((await patchRes.json()).entries[0].day, "Wed");

    const delRes = await handler.DELETE(ctx(req("DELETE", { entryId })));
    assertEquals((await delRes.json()).entries, []);
  },
});

Deno.test({
  name: "DELETE { clear: true } empties the menu",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearDishes();
    await handler.POST(ctx(req("POST", { dishId: await seedDish("Soup") })));
    await handler.POST(ctx(req("POST", { dishId: await seedDish("Salad") })));
    assertEquals(
      (await handler.DELETE(ctx(req("DELETE", { clear: true })))).status,
      200,
    );
    assertEquals(
      (await (await handler.GET(ctx(req("GET")))).json()).entries,
      [],
    );
  },
});

Deno.test({
  name: "POST without dishId is 400; PATCH with a bad day is 400",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    assertEquals((await handler.POST(ctx(req("POST", {})))).status, 400);
    assertEquals(
      (await handler.PATCH(ctx(req("PATCH", { entryId: "x", day: "Funday" }))))
        .status,
      400,
    );
  },
});

Deno.test({
  name: "POST with a malformed JSON body is 400, not 500",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const badReq = new Request("http://x/api/menu/plan", {
      method: "POST",
      body: "not json",
    });
    assertEquals((await handler.POST(ctx(badReq))).status, 400);
  },
});

Deno.test({
  name: "POST an unknown dishId is 400 and adds nothing",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearDishes();
    const res = await handler.POST(ctx(req("POST", { dishId: "nope" })));
    assertEquals(res.status, 400);
    assertEquals(
      (await (await handler.GET(ctx(req("GET")))).json()).entries,
      [],
    );
  },
});

Deno.test({
  name: "PATCH without a day key is 400; explicit null still unpins",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearDishes();
    const addRes = await handler.POST(
      ctx(req("POST", { dishId: await seedDish() })),
    );
    const entryId = ((await addRes.json()).entries as Array<{
      id: string;
    }>)[0].id;

    assertEquals(
      (await handler.PATCH(ctx(req("PATCH", { entryId })))).status,
      400,
    );
    const pinRes = await handler.PATCH(
      ctx(req("PATCH", { entryId, day: "Wed" })),
    );
    assertEquals((await pinRes.json()).entries[0].day, "Wed");
    const unpinRes = await handler.PATCH(
      ctx(req("PATCH", { entryId, day: null })),
    );
    assertEquals((await unpinRes.json()).entries[0].day, null);
  },
});

Deno.test({
  name: "DELETE without entryId or clear is 400",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    assertEquals((await handler.DELETE(ctx(req("DELETE", {})))).status, 400);
  },
});

Deno.test({
  name: "GET only sees the acting household's menu",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await clearDishes();
    await handler.POST(ctx(req("POST", { dishId: await seedDish() })));
    const other = await handler.GET(ctx(req("GET"), "h2"));
    assertEquals((await other.json()).entries, []);
  },
});
