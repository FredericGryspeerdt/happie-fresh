import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AddItems from "./add-items.tsx";

const base = {
  listId: "l1",
  listName: "Groceries",
  items: [{ id: "i1", name: "Butter", categoryId: "d" }],
  shoppingList: [],
  categories: [
    { id: "d", label: "Dairy", order: 0 },
    { id: "b", label: "Bakery", order: 1 },
  ],
};

Deno.test("AddItems — idle: search-first hint, no chips, no rows", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, "Search your catalogue"); // idle hint
  assertStringIncludes(html, "Adding to Groceries"); // context line
  assert(!html.includes("Butter")); // no catalogue rows when idle
  assert(!html.includes("Bakery")); // category chips are gone
});

Deno.test("AddItems — a back link to the list is always present", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, `href="/shopping/l1"`);
});

Deno.test("AddItems — matching query: results first, then a slim Create row (not the card)", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "But" }));
  assertStringIncludes(html, "Butter");
  // "But" has no exact match, so a Create affordance shows too — but BELOW the
  // results and as a slim row, NOT the prominent card.
  assert(html.indexOf("Butter") < html.indexOf("Create &quot;But&quot;"));
  assert(!html.includes("New item")); // de-emphasized: slim row, not the full card
});

Deno.test("AddItems — no-match query shows the full Create card", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "Tofu" }));
  // preact-render-to-string HTML-escapes the literal quotes in Create "{q}".
  assertStringIncludes(html, "Create &quot;Tofu&quot;");
  assertStringIncludes(html, "New item"); // no matches → the prominent card
});
