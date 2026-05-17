import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DoneListItem from "./done-list-item.tsx";
import type { ShoppingListItemInterface } from "@/models/index.ts";

const baseItem: ShoppingListItemInterface = {
  id: "sl-1",
  itemId: "item-1",
  userId: "user-1",
  quantity: 1,
  checked: true,
};

Deno.test("DoneListItem — renders item name", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Milk");
});

Deno.test("DoneListItem — renders a Re-add button", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Re-add");
});

Deno.test("DoneListItem — renders a delete button", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Remove");
});
