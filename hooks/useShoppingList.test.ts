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
