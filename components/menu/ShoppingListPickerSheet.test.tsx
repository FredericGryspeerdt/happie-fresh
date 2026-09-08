import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { ShoppingListPickerSheet } from "./ShoppingListPickerSheet.tsx";
import type { ShoppingListInterface } from "@/models/index.ts";

const list = (id: string, name: string): ShoppingListInterface => ({
  id,
  householdId: "h1",
  name,
  createdBy: "m1",
  createdAt: "2026-09-08T00:00:00.000Z",
});
const noop = () => {};
const never = () => Promise.resolve(false);

Deno.test("ShoppingListPickerSheet — lists every list and marks the remembered one", () => {
  const html = render(h(ShoppingListPickerSheet, {
    open: true,
    lists: [list("A", "Weekly shop"), list("B", "DIY store")],
    rememberedListId: "B",
    busy: false,
    onPick: noop,
    onCreate: never,
    onClose: noop,
  }));
  assertStringIncludes(html, "Which list?");
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "DIY store");
  assertStringIncludes(html, "Used last time");
  assertStringIncludes(html, "New list");
  assertEquals(html.includes('value="Groceries"'), false);
});

Deno.test("ShoppingListPickerSheet — with no lists, opens the create dialog prefilled with Groceries", () => {
  const html = render(h(ShoppingListPickerSheet, {
    open: true,
    lists: [],
    rememberedListId: null,
    busy: false,
    onPick: noop,
    onCreate: never,
    onClose: noop,
  }));
  assertStringIncludes(html, "New shopping list");
  assertStringIncludes(html, 'value="Groceries"');
  assertStringIncludes(html, "Create list");
  assertEquals(html.includes("Which list?"), false);
});

Deno.test("ShoppingListPickerSheet — the list-name field is labelled for assistive tech", () => {
  const html = render(h(ShoppingListPickerSheet, {
    open: true,
    lists: [],
    rememberedListId: null,
    busy: false,
    onPick: noop,
    onCreate: never,
    onClose: noop,
  }));
  assertStringIncludes(html, 'for="new-shopping-list-name"');
  assertStringIncludes(html, 'id="new-shopping-list-name"');
});
