import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Icon } from "./Icon.tsx";

Deno.test("Icon — renders an svg of the requested size", () => {
  const html = render(h(Icon, { name: "cart", size: 20 }));
  assertStringIncludes(html, "<svg");
  assertStringIncludes(html, 'width="20"');
});
