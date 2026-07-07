import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Pressable } from "./Pressable.tsx";

Deno.test("Pressable — renders md-press host and a state-layer span", () => {
  const html = render(h(Pressable, { class: "x" }, "Tap"));
  assertStringIncludes(html, "md-press");
  assertStringIncludes(html, "md-state");
  assertStringIncludes(html, "Tap");
});
