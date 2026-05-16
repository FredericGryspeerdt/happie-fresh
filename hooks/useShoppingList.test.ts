import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { FakeTime } from "jsr:@std/testing/time";
import { api } from "@/services/api.ts";
import { useShoppingList } from "@/hooks/useShoppingList.ts";
import type {
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, name: string): ItemInterface {
  return { id, name };
}

function makeListItem(
  id: string,
  itemId: string,
  checked = false,
): ShoppingListItemInterface {
  return { id, itemId, userId: "user-1", quantity: 1, checked };
}

// ── init splitting ────────────────────────────────────────────────────────────

Deno.test("useShoppingList — initialises list with only unchecked items", () => {
  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
});

Deno.test("useShoppingList — initialises checkedItems with only checked items", () => {
  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-2");
});

// ── checkItem ─────────────────────────────────────────────────────────────────

Deno.test("checkItem — moves item from list to checkedItems", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.list.value, []);
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-1");
  assertEquals(hook.checkedItems.value[0].checked, true);
});

Deno.test("checkItem — item is in exitingItems during the 300ms animation", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");

  assertEquals(hook.exitingItems.value.includes("sl-1"), true);

  await time.tickAsync(300);
  await promise;

  assertEquals(hook.exitingItems.value.includes("sl-1"), false);
});

Deno.test("checkItem — calls api.shoppingList.patch with checked: true", async () => {
  const calls: Array<[string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (id, patch) => {
      calls.push([id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "sl-1");
  assertEquals(calls[0][1], { checked: true });
});

// ── uncheckItem ───────────────────────────────────────────────────────────────

Deno.test("uncheckItem — moves item from checkedItems back to list", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.list.value.length, 0);

  await hook.uncheckItem("sl-1");

  assertEquals(hook.checkedItems.value, []);
  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
  assertEquals(hook.list.value[0].checked, false);
});

Deno.test("uncheckItem — calls api.shoppingList.patch with checked: false", async () => {
  const calls: Array<[string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (id, patch) => {
      calls.push([id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "sl-1");
  assertEquals(calls[0][1], { checked: false });
});

// ── pendingCount ──────────────────────────────────────────────────────────────

Deno.test("pendingCount — starts at 0", () => {
  const hook = useShoppingList([], []);
  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — returns to 0 after uncheckItem completes", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — is > 0 while an API call is in flight", async () => {
  let resolveCall!: () => void;
  const slowPatch = new Promise<void>((resolve) => {
    resolveCall = resolve;
  });
  using _patch = stub(api.shoppingList, "patch", () => slowPatch);

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  const promise = hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 1);

  resolveCall();
  await promise;

  assertEquals(hook.pendingCount.value, 0);
});

// ── refresh ───────────────────────────────────────────────────────────────────

Deno.test("refresh — overwrites list and checkedItems from API", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () =>
      Promise.resolve([
        makeListItem("sl-new-1", "item-2", false),
        makeListItem("sl-new-2", "item-2", true),
      ]),
  );
  using _itemsGetAll = stub(
    api.items,
    "getAll",
    () => Promise.resolve([makeItem("item-2", "Eggs")]),
  );
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  assertEquals(hook.list.value.length, 1);

  await hook.refresh();

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-new-1");
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-new-2");
  assertEquals(hook.items.value[0].name, "Eggs");
});

Deno.test("refresh — pendingCount returns to 0 after completion", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () => Promise.resolve([]),
  );
  using _itemsGetAll = stub(api.items, "getAll", () => Promise.resolve([]));
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList([], []);

  await hook.refresh();

  assertEquals(hook.pendingCount.value, 0);
});

// ── addToList / addToCatalog return IDs ───────────────────────────────────────

Deno.test("addToList — returns the id of the created list entry", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-returned", "item-1", false),
      ),
  );

  const hook = useShoppingList([makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, "sl-returned");
});

Deno.test("addToList — returns null when API call fails", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () => Promise.resolve(null),
  );

  const hook = useShoppingList([makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, null);
});

Deno.test("checkItem — pendingCount returns to 0 after completion", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("addToList — appends entry to list", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-new", "item-1", false),
      ),
  );

  const hook = useShoppingList([makeItem("item-1", "Milk")], []);

  assertEquals(hook.list.value.length, 0);
  await hook.addToList("item-1");
  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-new");
});

// ── addToCatalog ──────────────────────────────────────────────────────────────

Deno.test("addToCatalog — adds item to catalog and list, returns list entry id", async () => {
  using _create = stub(
    api.items,
    "create",
    () =>
      Promise.resolve(
        makeItem("item-new", "Cheese"),
      ),
  );
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-new", "item-new", false),
      ),
  );

  const hook = useShoppingList([], []);

  const id = await hook.addToCatalog("Cheese");

  assertEquals(id, "sl-new");
  assertEquals(hook.items.value.length, 1);
  assertEquals(hook.items.value[0].name, "Cheese");
  assertEquals(hook.list.value.length, 1);
});

Deno.test("addToCatalog — returns null for empty name", async () => {
  const hook = useShoppingList([], []);
  const id = await hook.addToCatalog("");
  assertEquals(id, null);
});

Deno.test("addToCatalog — pendingCount returns to 0 after completion", async () => {
  using _create = stub(
    api.items,
    "create",
    () => Promise.resolve(makeItem("item-new", "Cheese")),
  );
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(makeListItem("sl-new", "item-new", false)),
  );

  const hook = useShoppingList([], []);

  await hook.addToCatalog("Cheese");

  assertEquals(hook.pendingCount.value, 0);
});
