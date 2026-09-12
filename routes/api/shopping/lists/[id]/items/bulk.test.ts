import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/shopping/lists/[id]/items/bulk.ts";
import {
  ItemRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
} from "@/database/index.ts";
import { getKv } from "@/database/db.ts";
import type { StateInterface } from "@/utils/index.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  id: string,
  householdId: string | undefined = "h1",
): Context<StateInterface> {
  return {
    req,
    params: { id },
    state: { householdId },
  } as unknown as Context<StateInterface>;
}

async function clearAll() {
  const kv = await getKv();
  for (
    const prefix of [["shopping_lists"], ["shopping_list_items"], ["items"]]
  ) {
    for await (const e of kv.list({ prefix })) await kv.delete(e.key);
  }
}

async function seedList(householdId = "h1") {
  return await ShoppingListRepo.create({
    householdId,
    name: "Groceries",
    createdBy: "m1",
    createdAt: new Date().toISOString(),
  });
}

const post = (listId: string, body: unknown) =>
  new Request(`http://x/api/shopping/lists/${listId}/items/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test({
  name: "POST — 403 when the list belongs to another household",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList("h2");
    const res = await handler.POST(
      ctx(post(list.id, { items: [{ itemId: "x" }] }), list.id),
    );
    assertEquals(res.status, 403);

    const noHousehold = await handler.POST(
      ctx(post(list.id, { items: [{ itemId: "x" }] }), list.id, undefined),
    );
    assertEquals(noHousehold.status, 403);
  },
});

Deno.test({
  name: "POST — 400 on malformed JSON, missing items, empty items, bad entries",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    for (
      const body of [
        "not json",
        {},
        { items: [] },
        { items: [{}] },
        { items: [{ itemId: 3 }] },
        { items: [{ itemId: "a", note: 5 }] },
      ]
    ) {
      const res = await handler.POST(ctx(post(list.id, body), list.id));
      assertEquals(res.status, 400, JSON.stringify(body));
    }
  },
});

Deno.test({
  name: "POST — 400 when more than 500 items are sent",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const items = Array.from({ length: 501 }, (_, i) => ({ itemId: `i${i}` }));
    const res = await handler.POST(ctx(post(list.id, { items }), list.id));
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name:
    "POST — 201 with added/restored/skipped; unknown catalogue items are ignored",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const pasta = await ItemRepo.create("h1", { name: "Pasta" });
    const milk = await ItemRepo.create("h1", { name: "Milk" });
    const bought = await ShoppingListItemRepo.add(list.id, milk.id);
    await ShoppingListItemRepo.update(list.id, bought.id, { checked: true });

    const res = await handler.POST(
      ctx(
        post(list.id, {
          items: [
            { itemId: pasta.id, note: "Lasagne" },
            { itemId: milk.id, note: "Pancakes" },
            { itemId: "deleted-item" },
          ],
        }),
        list.id,
      ),
    );
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.added.map((li: { itemId: string }) => li.itemId), [
      pasta.id,
    ]);
    assertEquals(body.restored.map((li: { id: string }) => li.id), [bought.id]);
    assertEquals(body.skipped, []);
    const all = await ShoppingListItemRepo.getAll(list.id);
    assertEquals(all.length, 2);
    assertEquals(all.some((li) => li.itemId === "deleted-item"), false);
  },
});

Deno.test({
  name:
    "POST — persists fractional amounts and rejects invalid quantities or units",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const meat = await ItemRepo.create("h1", { name: "Minced meat" });
    for (
      const amount of [
        { quantity: 0 },
        { quantity: -1 },
        { quantity: 100000 },
        { quantity: 0.1234 },
        { quantity: "0.5" },
        { quantity: null },
        { unit: "litres" },
        { unit: null },
      ]
    ) {
      const res = await handler.POST(
        ctx(
          post(list.id, { items: [{ itemId: meat.id, ...amount }] }),
          list.id,
        ),
      );
      assertEquals(res.status, 400, JSON.stringify(amount));
    }
    const res = await handler.POST(
      ctx(
        post(list.id, {
          items: [{ itemId: meat.id, quantity: 0.5, unit: "kg" }],
        }),
        list.id,
      ),
    );
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.added[0].quantity, 0.5);
    assertEquals(body.added[0].unit, "kg");
  },
});

Deno.test({
  name:
    "POST — additive request requires identity, returns updated totals, and retries safely",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const carrot = await ItemRepo.create("h1", { name: "Carrot" });
    await ShoppingListItemRepo.add(list.id, carrot.id);
    for (
      const options of [
        { addToExisting: true },
        { requestId: "x" },
        { addToExisting: false, requestId: "x" },
        { addToExisting: true, requestId: " " },
        { addToExisting: true, requestId: "x".repeat(129) },
      ]
    ) {
      const response = await handler.POST(
        ctx(
          post(list.id, { items: [{ itemId: carrot.id }], ...options }),
          list.id,
        ),
      );
      assertEquals(response.status, 400);
    }
    const request = {
      items: [{ itemId: carrot.id, quantity: 3 }],
      addToExisting: true,
      requestId: "carrots",
    };
    const first = await handler.POST(ctx(post(list.id, request), list.id));
    assertEquals(first.status, 201);
    const result = await first.json();
    assertEquals(result.updated[0].quantity, 4);
    const retry = await handler.POST(ctx(post(list.id, request), list.id));
    assertEquals(await retry.json(), result);
    const conflict = await handler.POST(
      ctx(
        post(list.id, {
          ...request,
          items: [{ itemId: carrot.id, quantity: 2 }],
        }),
        list.id,
      ),
    );
    assertEquals(conflict.status, 409);
    assertEquals(typeof (await conflict.json()).error, "string");
    const units = await handler.POST(
      ctx(
        post(list.id, {
          ...request,
          requestId: "units",
          items: [{ itemId: carrot.id, quantity: 2, unit: "kg" }],
        }),
        list.id,
      ),
    );
    assertEquals(units.status, 409);
    assertEquals((await ShoppingListItemRepo.getAll(list.id))[0].quantity, 4);
  },
});

Deno.test({
  name:
    "POST — committed additive retry survives catalogue deletion; new request rejects deleted ingredient atomically",
  sanitizeResources: false,
  async fn() {
    await clearAll();
    const list = await seedList();
    const carrot = await ItemRepo.create("h1", { name: "Carrot" });
    const request = {
      items: [{ itemId: carrot.id, quantity: 3 }],
      addToExisting: true,
      requestId: "deleted-carrots",
    };
    const response = await handler.POST(ctx(post(list.id, request), list.id));
    const result = await response.json();
    await ItemRepo.delete("h1", carrot.id);
    const retry = await handler.POST(ctx(post(list.id, request), list.id));
    assertEquals(retry.status, 201);
    assertEquals(await retry.json(), result);
    const rejected = await handler.POST(
      ctx(post(list.id, { ...request, requestId: "new" }), list.id),
    );
    assertEquals(rejected.status, 409);
    assertEquals((await ShoppingListItemRepo.getAll(list.id))[0].quantity, 3);
  },
});
