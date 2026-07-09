import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import CategoryReorder from "./category-reorder.tsx";

Deno.test("CategoryReorder — renders categories in aisle order with move controls", () => {
  const html = render(h(CategoryReorder, {
    initialCategories: [
      { id: "b", label: "Bakery", order: 1 },
      { id: "a", label: "Produce", order: 0 },
    ],
  }));
  // sorted by order → Produce (0) before Bakery (1)
  const produceAt = html.indexOf("Produce");
  const bakeryAt = html.indexOf("Bakery");
  assertStringIncludes(html, "Produce");
  assertStringIncludes(html, "Bakery");
  if (produceAt > bakeryAt) throw new Error("expected Produce before Bakery");
  assertStringIncludes(html, "Move up");
});
