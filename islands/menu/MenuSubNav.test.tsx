import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import MenuSubNav from "./MenuSubNav.tsx";

Deno.test("MenuSubNav — renders both tab labels", () => {
  const html = render(h(MenuSubNav, { active: "plan" }));
  assertStringIncludes(html, "This week");
  assertStringIncludes(html, "Dishes");
});
