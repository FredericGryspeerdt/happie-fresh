import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "./api.ts";

const deletes = [
  {
    name: "catalogue item",
    run: () => api.items.delete("i1"),
    url: "/api/shopping/catalogue",
    body: { id: "i1" },
  },
  {
    name: "category",
    run: () => api.categories.delete("c1"),
    url: "/api/shopping/categories",
    body: { id: "c1" },
  },
  {
    name: "shopping list",
    run: () => api.shoppingLists.delete("l1"),
    url: "/api/shopping/lists/l1",
    body: undefined,
  },
  {
    name: "shopping entry",
    run: () => api.shoppingList.removeItem("l1", "e1"),
    url: "/api/shopping/lists/l1/items",
    body: { id: "e1" },
  },
  {
    name: "dish",
    run: () => api.dishes.delete("d1"),
    url: "/api/menu/dishes",
    body: { id: "d1" },
  },
  {
    name: "card",
    run: () => api.cards.delete("c1"),
    url: "/api/cards",
    body: { id: "c1" },
  },
  {
    name: "to-do",
    run: () => api.todos.delete("t1"),
    url: "/api/todos/t1",
    body: undefined,
  },
  {
    name: "member",
    run: () => api.members.remove("m1"),
    url: "/api/members/m1",
    body: undefined,
  },
];
for (const operation of deletes) {
  for (const status of [204, 403, 500, "offline"] as const) {
    Deno.test(`delete ${operation.name} — ${status} has a checkable outcome`, async () => {
      using _fetch = stub(globalThis, "fetch", (url, init) => {
        assertEquals(url, operation.url);
        assertEquals(init?.method, "DELETE");
        assertEquals(
          init?.body ? JSON.parse(String(init.body)) : undefined,
          operation.body,
        );
        return status === "offline"
          ? Promise.reject(new TypeError("offline"))
          : Promise.resolve(new Response(null, { status }));
      });
      assertEquals(await operation.run(), status === 204);
    });
  }
}
