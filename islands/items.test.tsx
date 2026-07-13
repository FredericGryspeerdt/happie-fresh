import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(
    h(Items, {
      listId: "l1",
      listName: "Test list",
      items: [],
      shoppingList: [],
      categories: [],
    }),
  );
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});

Deno.test("Items — add sheet is search-first with a full-screen handoff", () => {
  const html = render(
    h(Items, {
      listId: "l1",
      listName: "Test list",
      items: [],
      shoppingList: [],
      categories: [],
    }),
  );
  assertStringIncludes(html, "Search your catalogue"); // idle hint
  assertStringIncludes(html, "Full screen"); // expand handoff
});
