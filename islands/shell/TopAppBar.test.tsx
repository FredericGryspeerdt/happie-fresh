import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import TopAppBar from "./TopAppBar.tsx";

Deno.test("TopAppBar — renders the title", () => {
  assertStringIncludes(
    render(h(TopAppBar, { title: "Weekly groceries" })),
    "Weekly groceries",
  );
});
Deno.test("TopAppBar — renders a back link only when backUrl is set", () => {
  assertStringIncludes(
    render(h(TopAppBar, { title: "X", backUrl: "/shopping" })),
    'href="/shopping"',
  );
  assertFalse(
    render(h(TopAppBar, { title: "X" })).includes('aria-label="Back"'),
  );
});
