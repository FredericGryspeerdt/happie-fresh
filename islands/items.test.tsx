import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

const base = {
  listId: "l1",
  listName: "Test list",
  items: [],
  shoppingList: [],
  categories: [],
};

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});

Deno.test("Items — Plan mode shows the Add items FAB, no quick-add sheet", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Add items"); // FAB label
  assert(!html.includes("Search your catalogue")); // old quick-add sheet gone
});
