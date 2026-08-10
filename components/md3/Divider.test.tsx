import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Divider } from "./Divider.tsx";
import { ListSubheader } from "./ListSubheader.tsx";

Deno.test("Divider — 1px outline-variant hairline", () => {
  const html = render(h(Divider, { inset: false }));
  assertStringIncludes(html, "h-px");
  assertStringIncludes(html, "bg-outline-variant");
});

Deno.test("Divider — inset variant is indented", () => {
  const html = render(h(Divider, { inset: true }));
  assertStringIncludes(html, "mx-4");
});

Deno.test("ListSubheader — title-small on-surface-variant", () => {
  const html = render(h(ListSubheader, { children: "General" }));
  assertStringIncludes(html, "General");
  assertStringIncludes(html, "md-title-small");
  assertStringIncludes(html, "text-on-surface-variant");
});
