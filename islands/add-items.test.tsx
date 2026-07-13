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

Deno.test("AddItems — idle shows category chips and no item rows", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "" }));
  assertStringIncludes(html, "Dairy");
  assertStringIncludes(html, "Bakery");
  assertStringIncludes(html, "Adding to Groceries");
  assert(!html.includes("Butter")); // no catalogue rows when idle
});

Deno.test("AddItems — a matching query lists the catalogue item", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "But" }));
  assertStringIncludes(html, "Butter");
});

Deno.test("AddItems — a query with no match shows the Create card", () => {
  const html = render(h(AddItems, { ...base, initialQuery: "Tofu" }));
  // preact-render-to-string HTML-escapes literal quote characters in JSX text
  // (Create "{q}" → Create &quot;Tofu&quot;); this is correct/safe serialization,
  // so the assertion matches the escaped form rather than fighting it.
  assertStringIncludes(html, "Create &quot;Tofu&quot;");
});
