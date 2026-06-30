import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { assertNotMatch } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import ShoppingLists from "./shopping-lists.tsx";

Deno.test("ShoppingLists — renders list name and done/total", () => {
  const html = render(h(ShoppingLists, {
    initialLists: [
      {
        id: "1",
        householdId: "h",
        name: "Weekly groceries",
        createdBy: "u",
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        total: 9,
        done: 3,
      },
    ],
  }));
  assertStringIncludes(html, "Weekly groceries");
  assertStringIncludes(html, "3/9 done");
  assertNotMatch(html, /NaN/);
});
