import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Scrim } from "./Scrim.tsx";

Deno.test("Scrim — 32% black, fades with emphasized easing", () => {
  const html = render(h(Scrim, { open: true }));
  assertStringIncludes(html, "rgba(0,0,0,.32)");
  assertStringIncludes(html, "opacity:1");
  assertStringIncludes(html, 'aria-hidden="true"');
});

Deno.test("Scrim — transparent when closed", () => {
  const html = render(h(Scrim, { open: false }));
  assertStringIncludes(html, "opacity:0");
});
