import { assertMatch, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { ShoppingAmountDialog } from "./ShoppingAmountDialog.tsx";

Deno.test("ShoppingAmountDialog — conflict editor exposes labelled decimal input and compatible units", () => {
  const html = render(h(ShoppingAmountDialog, {
    name: "Tomatoes",
    amount: { quantity: 500, unit: "g" },
    existingAmount: { quantity: 2, unit: "pieces" },
    additional: true,
    onSave: () => {},
    onClose: () => {},
  }));

  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, 'aria-modal="true"');
  assertStringIncludes(html, 'aria-label="Tomatoes"');
  assertStringIncludes(html, 'tabindex="-1"');
  assertStringIncludes(html, "w-full");
  assertStringIncludes(html, '<label for="shopping-amount"');
  assertStringIncludes(html, 'inputmode="decimal"');
  assertStringIncludes(html, "Add for these dishes");
  assertStringIncludes(html, "Already on your list: 2");
  assertStringIncludes(html, 'value="pieces"');
  assertMatch(html, /<button[^>]*disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Save/);
});
