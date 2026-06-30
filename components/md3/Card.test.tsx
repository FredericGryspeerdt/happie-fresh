import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Card } from "./Card.tsx";
import { Chip } from "./Chip.tsx";

Deno.test("Card — filled variant uses surface-container-high", () => {
  assertStringIncludes(render(h(Card, {}, "x")), "bg-surface-chigh");
});
Deno.test("Chip — selected chip uses secondary-container and renders check", () => {
  const html = render(h(Chip, { selected: true }, "Produce"));
  assertStringIncludes(html, "bg-secondary-container");
  assertStringIncludes(html, "<svg");
});
