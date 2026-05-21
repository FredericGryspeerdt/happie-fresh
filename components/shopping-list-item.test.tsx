import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import ShoppingListItem from "./shopping-list-item.tsx";
import type { ShoppingListItemInterface } from "@/models/index.ts";

const baseItem: ShoppingListItemInterface = {
  id: "sl-1",
  itemId: "item-1",
  listId: "list-1",
  quantity: 2,
  checked: false,
};

Deno.test("ShoppingListItem — renders item name", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "Milk");
});

Deno.test("ShoppingListItem — applies exiting CSS class when isExiting is true", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: true,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "opacity-0");
});

Deno.test("ShoppingListItem — shows spinner aria-label when isPending is true", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: true,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "Saving");
});

Deno.test("ShoppingListItem — note input has no id attribute (duplicate id bug fix)", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertEquals(html.includes('id="note-input"'), false);
});
