import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { PullToRefresh } from "./PullToRefresh.tsx";

Deno.test("PullToRefresh — renders its children", () => {
  const html = render(
    h(
      PullToRefresh,
      { onRefresh: () => Promise.resolve() },
      h("p", null, "Hello content"),
    ),
  );
  assertStringIncludes(html, "Hello content");
});

Deno.test("PullToRefresh — forwards class to the content root", () => {
  const html = render(
    h(
      PullToRefresh,
      { onRefresh: () => Promise.resolve(), class: "flex flex-col gap-4" },
      h("p", null, "x"),
    ),
  );
  assertStringIncludes(html, "flex flex-col gap-4");
});

Deno.test("PullToRefresh — idle: sr-only status present, no error snackbar", () => {
  const html = render(
    h(PullToRefresh, { onRefresh: () => Promise.resolve() }, h("p", null, "x")),
  );
  assertStringIncludes(html, "aria-live");
  assert(!html.includes("Couldn't refresh")); // error snackbar hidden at idle
});
