import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/api/menu/dishes.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";

Deno.env.set("KV_PATH", ":memory:");

const MANAGER: MemberInterface = {
  id: "m-mgr",
  householdId: "hh-1",
  name: "Alex",
  color: "sky",
  emoji: "⭐",
  isManager: true,
};
const KID: MemberInterface = {
  id: "m-kid",
  householdId: "hh-1",
  name: "Bo",
  color: "meadow",
  emoji: "🐸",
  isManager: false,
};

function ctx(
  req: Request,
  state: {
    householdId?: string;
    userId?: string;
    actingMember?: MemberInterface;
  } = { householdId: "hh-1", actingMember: MANAGER },
) {
  return { req, state } as unknown as Parameters<typeof handler.GET>[0];
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
  name: "GET without a household returns 401",
  sanitizeResources: false,
  async fn() {
    const res = await handler.GET(
      ctx(new Request("http://x/api/menu/dishes"), {}),
    );
    assertEquals(res.status, 401);
  },
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
    assertEquals(createRes.headers.get("Content-Type"), "application/json");
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
    assertEquals(updateRes.headers.get("Content-Type"), "application/json");
    const updated = await updateRes.json();
    assertEquals(updated.name, "Veggie Curry");
    assertEquals(updated.ingredientAmounts, undefined);
  },
});

Deno.test({
  name: "POST rejects an invalid ingredient amount without saving the dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const res = await handler.POST(ctx(post({
      name: "Pasta",
      ingredientIds: ["pasta"],
      tagValueIds: [],
      ingredientAmounts: {
        pasta: { quantity: 0, unit: "g" },
      },
    })));

    assertEquals(res.status, 400);
    assertEquals(
      await handler.GET(
        ctx(new Request("http://x/api/menu/dishes")),
      ).then((response) => response.json()),
      [],
    );
  },
});

Deno.test({
  name: "dish API saves, preserves, clears, and removes ingredient amounts",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const amount = { quantity: 0.5, unit: "kg" };
    const createdResponse = await handler.POST(ctx(post({
      name: "Pasta",
      ingredientIds: ["pasta", "salt"],
      tagValueIds: [],
      ingredientAmounts: { pasta: amount },
    })));
    assertEquals(createdResponse.status, 201);
    const created = await createdResponse.json();
    assertEquals(created.ingredientAmounts, { pasta: amount });

    const renamedResponse = await handler.POST(ctx(post({
      id: created.id,
      name: "Family pasta",
    })));
    assertEquals(renamedResponse.status, 200);
    assertEquals((await renamedResponse.json()).ingredientAmounts, {
      pasta: amount,
    });

    const removedIngredientResponse = await handler.POST(ctx(post({
      id: created.id,
      ingredientIds: ["salt"],
    })));
    assertEquals(removedIngredientResponse.status, 200);
    assertEquals(
      (await removedIngredientResponse.json()).ingredientAmounts,
      {},
    );

    const clearedResponse = await handler.POST(ctx(post({
      id: created.id,
      ingredientAmounts: {},
    })));
    assertEquals(clearedResponse.status, 200);
    assertEquals((await clearedResponse.json()).ingredientAmounts, {});
  },
});

Deno.test({
  name: "dish API rejects ingredient amounts for items outside the dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const res = await handler.POST(ctx(post({
      name: "Pasta",
      ingredientIds: ["pasta"],
      tagValueIds: [],
      ingredientAmounts: { salt: { quantity: 1, unit: "g" } },
    })));
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name:
    "dish API rejects unsupported units, excessive precision, and oversized amounts",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    for (
      const amount of [
        { quantity: 1, unit: "cups" },
        { quantity: 1.2345, unit: "g" },
        { quantity: 100000, unit: "g" },
      ]
    ) {
      const res = await handler.POST(ctx(post({
        name: "Pasta",
        ingredientIds: ["pasta"],
        tagValueIds: [],
        ingredientAmounts: { pasta: amount },
      })));
      assertEquals(res.status, 400);
    }
  },
});

Deno.test({
  name: "dishes are isolated per household",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    await handler.POST(
      ctx(post({ name: "OnlyA", ingredientIds: [], tagValueIds: [] }), {
        householdId: "hh-a",
      }),
    );
    const bList = await (await handler.GET(
      ctx(new Request("http://x/api/menu/dishes"), { householdId: "hh-b" }),
    )).json();
    assertEquals(bList, []);
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

Deno.test({
  name: "DELETE — a non-manager acting member gets 403",
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
    const res = await handler.DELETE(
      ctx(delReq, { householdId: "hh-1", actingMember: KID }),
    );
    assertEquals(res.status, 403);
    // Still there — nothing was deleted.
    const list = await (await handler.GET(
      ctx(new Request("http://x/api/menu/dishes")),
    )).json();
    assertEquals(list.map((d: { id: string }) => d.id), [created.id]);
  },
});

Deno.test({
  name: "DELETE — a manager acting member deletes",
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
  },
});
