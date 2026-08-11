import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Sheet } from "./Sheet.tsx";

Deno.test("Sheet — SSR renders in place (portal waits for mount)", () => {
  const html = render(h(Sheet, {
    open: false,
    onClose: () => {},
    title: "The household",
    children: "sheet-child-marker",
  }));
  assertStringIncludes(html, "The household");
  assertStringIncludes(html, "sheet-child-marker");
});

Deno.test("Sheet — open panel content renders", () => {
  const html = render(h(Sheet, {
    open: true,
    onClose: () => {},
    title: "The household",
    children: "sheet-child-marker",
  }));
  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, "sheet-child-marker");
});
