import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { renderToString } from "npm:preact-render-to-string@6.6.3";
import { SelectionRow } from "./SelectionRow.tsx";
Deno.test("selection row exposes a checkbox, note and plain quantity without editing controls", () => {
  const html = renderToString(
    <SelectionRow
      name="Milk"
      item={{
        id: "a",
        listId: "l",
        itemId: "milk",
        quantity: 3,
        note: "big pack",
        checked: true,
      }}
      selected
      onToggle={() => {}}
    />,
  );
  assertStringIncludes(html, 'type="checkbox"');
  assertStringIncludes(html, "checked");
  assertStringIncludes(html, "Milk");
  assertStringIncludes(html, "big pack");
  assertStringIncludes(html, "Quantity: 3");
  assertEquals(html.includes("Increase quantity"), false);
});
