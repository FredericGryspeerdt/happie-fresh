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
