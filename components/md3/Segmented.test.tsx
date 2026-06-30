import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Segmented } from "./Segmented.tsx";

Deno.test("Segmented — selected option uses secondary-container and a check icon", () => {
  const html = render(h(Segmented, {
    options: [["plan", "edit", "Plan"], ["shop", "cart", "Shop"]],
    value: "plan",
    onChange: () => {},
  }));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
  assertStringIncludes(html, "bg-secondary-container");
});
