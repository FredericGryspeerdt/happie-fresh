import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { useCatalogue } from "./useCatalogue.ts";
import { useDishes } from "./useDishes.ts";
import { useLoyaltyCards } from "./useLoyaltyCards.ts";
import { useShoppingList } from "./useShoppingList.ts";
import { busyCount } from "@/utils/loading.ts";

const stores = [
  function useCatalogueStore() {
    const h = useCatalogue([{ id: "a", name: "Milk" }, {
      id: "b",
      name: "Bread",
    }], []);
    return { rows: h.items, remove: h.removeItem, pending: h.pendingCount };
  },
  function useCategoryStore() {
    const h = useCatalogue([], [{ id: "a", label: "Dairy" }, {
      id: "b",
      label: "Bakery",
    }]);
    return {
      rows: h.categories,
      remove: h.deleteCategory,
      pending: h.pendingCount,
    };
  },
  function useDishStore() {
    const h = useDishes([{
      id: "a",
      name: "Pasta",
      ingredientIds: [],
      tagValueIds: [],
    }, { id: "b", name: "Soup", ingredientIds: [], tagValueIds: [] }], []);
    return { rows: h.dishes, remove: h.removeDish, pending: h.pendingCount };
  },
  function useCardStore() {
    const h = useLoyaltyCards([{
      id: "a",
      householdId: "h",
      label: "Shop",
      value: "123",
      format: "code128",
    }, {
      id: "b",
      householdId: "h",
      label: "Store",
      value: "456",
      format: "code128",
    }]);
    return { rows: h.cards, remove: h.removeCard, pending: h.pendingCount };
  },
];
for (const [index, create] of stores.entries()) {
  for (const offline of [false, true]) {
    Deno.test(`optimistic delete store ${index} — restores only failed row (${offline ? "offline" : "403"})`, async () => {
      const result = Promise.withResolvers<Response>();
      using _fetch = stub(globalThis, "fetch", () => result.promise);
      const h = create();
      const initial = [...h.rows.value];
      const removing = h.remove("a");
      assertEquals(h.rows.value.map((r) => r.id), ["b"]);
      // Another successful deletion must not be undone by this rollback.
      h.rows.value = [];
      if (offline) result.reject(new TypeError("offline"));
      else result.resolve(new Response(null, { status: 403 }));
      assertEquals<unknown>(await removing, false);
      assertEquals(h.rows.value, [initial[0]]);
      assertEquals(h.pending.value, 0);
      assertEquals(busyCount.value, 0);
    });
  }
}

for (const checked of [false, true]) {
  Deno.test(`removeListItem — restores ${checked ? "checked" : "open"} entry after rejection`, async () => {
    using _fetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response(null, { status: 403 })),
    );
    const row = {
      id: "a",
      itemId: "milk",
      listId: "l1",
      quantity: 2,
      note: "large",
      checked,
    };
    const h = useShoppingList("l1", [], [row]);
    assertEquals<unknown>(await h.removeListItem("a"), false);
    assertEquals(checked ? h.checkedItems.value : h.list.value, [row]);
    assertEquals(h.exitingItems.value, []);
    assertEquals(h.pendingCount.value, 0);
  });
}

Deno.test("removeListItem — saves queued quantity before deleting and keeps it on failure", async () => {
  const methods: string[] = [];
  const row = {
    id: "a",
    itemId: "milk",
    listId: "l1",
    quantity: 1,
    checked: false,
  };
  using _fetch = stub(globalThis, "fetch", (_url, init) => {
    methods.push(init?.method ?? "GET");
    return Promise.resolve(
      init?.method === "PATCH"
        ? Response.json({ ...row, quantity: 6 })
        : new Response(null, { status: 403 }),
    );
  });
  const h = useShoppingList("l1", [], [row]);
  h.updateListItem("a", { quantity: 6 });
  assertEquals(await h.removeListItem("a"), false);
  assertEquals(methods, ["PATCH", "DELETE"]);
  assertEquals(h.list.value[0].quantity, 6);
  assertEquals(h.savingIds.value.size, 0);
});

Deno.test("removeListItem — blocks late edits while draining a save", async () => {
  using time = new FakeTime();
  const firstPatch = Promise.withResolvers<Response>();
  const methods: string[] = [];
  const row = {
    id: "a",
    itemId: "milk",
    listId: "l1",
    quantity: 1,
    checked: false,
  };
  using _fetch = stub(globalThis, "fetch", (_url, init) => {
    methods.push(init?.method ?? "GET");
    return methods.length === 1
      ? firstPatch.promise
      : Promise.resolve(new Response(null, { status: 204 }));
  });
  const h = useShoppingList("l1", [], [row]);
  h.updateListItem("a", { quantity: 2 });
  const removing = h.removeListItem("a");
  await time.tickAsync(300);
  const busyDuringDrain = h.pendingCount.value;
  h.updateListItem("a", { quantity: 3 });
  firstPatch.resolve(Response.json({ ...row, quantity: 2 }));
  const ok = await removing;
  await time.tickAsync(600);
  assertEquals(ok, true);
  assertEquals(methods, ["PATCH", "DELETE"]);
  assertEquals(busyDuringDrain, 1);
  assertEquals(h.pendingCount.value, 0);
  assertEquals(h.list.value, []);
});
