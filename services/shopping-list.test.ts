import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "./api.ts";

Deno.test("updateItem — PATCHes quantity and unit and returns the saved entry", async () => {
  const saved = {
    id: "entry",
    listId: "list",
    itemId: "meat",
    quantity: 0.5,
    unit: "kg" as const,
    checked: false,
  };
  using fetchStub = stub(globalThis, "fetch", (_input, init) => {
    assertEquals(init?.method, "PATCH");
    assertEquals(JSON.parse(String(init?.body)), {
      id: "entry",
      quantity: 0.5,
      unit: "kg",
    });
    return Promise.resolve(Response.json(saved));
  });
  assertEquals(
    await api.shoppingList.updateItem("list", "entry", {
      quantity: 0.5,
      unit: "kg",
    }),
    saved,
  );
  assertEquals(fetchStub.calls[0].args[0], "/api/shopping/lists/list/items");
});

Deno.test("updateItem — represents rejected and offline saves as null", async () => {
  let offline = false;
  using _fetch = stub(globalThis, "fetch", () => {
    if (offline) return Promise.reject(new TypeError("offline"));
    return Promise.resolve(new Response(null, { status: 500 }));
  });
  assertEquals(
    await api.shoppingList.updateItem("list", "entry", {
      quantity: 1,
      unit: "pieces",
    }),
    null,
  );
  offline = true;
  assertEquals(
    await api.shoppingList.updateItem("list", "entry", {
      quantity: 1,
      unit: "pieces",
    }),
    null,
  );
});

Deno.test("updateItem — uses the same result contract for ordinary note edits", async () => {
  const saved = {
    id: "entry",
    listId: "list",
    itemId: "milk",
    quantity: 1,
    checked: false,
    note: "Full fat",
  };
  using _fetch = stub(globalThis, "fetch", (_input, init) => {
    assertEquals(JSON.parse(String(init?.body)), {
      id: "entry",
      note: "Full fat",
    });
    return Promise.resolve(Response.json(saved));
  });
  assertEquals(
    await api.shoppingList.updateItem("list", "entry", { note: "Full fat" }),
    saved,
  );
});

Deno.test("shopping list reads — legacy empty fallback and nullable review share failure handling", async () => {
  using fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new TypeError("offline")),
  );
  assertEquals(await api.shoppingList.getItemsOrNull("list"), null);
  assertEquals(await api.shoppingList.getItems("list"), []);
  assertEquals(fetchStub.calls.length, 2);
});

Deno.test("bulkAdd — sends the retry identity and distinguishes rejection from uncertainty", async () => {
  const items = [{ itemId: "carrots", quantity: 3, unit: "pieces" as const }];
  const options = { requestId: "stable-request", addToExisting: true as const };
  let status = 409;
  using _fetch = stub(globalThis, "fetch", (_input, init) => {
    assertEquals(JSON.parse(String(init?.body)), { items, ...options });
    if (status === 0) return Promise.reject(new TypeError("offline"));
    return Promise.resolve(
      Response.json({ error: "Units changed" }, { status }),
    );
  });
  assertEquals(await api.shoppingList.bulkAdd("list", items, options), {
    error: "Units changed",
  });
  status = 500;
  assertEquals(await api.shoppingList.bulkAdd("list", items, options), null);
  status = 0;
  assertEquals(await api.shoppingList.bulkAdd("list", items, options), null);
});
