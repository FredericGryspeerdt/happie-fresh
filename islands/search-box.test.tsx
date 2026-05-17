import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { signal } from "@preact/signals";
import SearchBox from "./search-box.tsx";

Deno.test("SearchBox — renders clear button when query is non-empty", () => {
  const query = signal("milk");
  const html = render(
    h(SearchBox, {
      query,
      results: signal([]),
      renderItem: () => h("li", null, "item"),
      renderEmpty: () => h("div", null, "empty"),
    }),
  );
  assertStringIncludes(html, "Clear search");
});

Deno.test("SearchBox — does not render clear button when query is empty", () => {
  const query = signal("");
  const html = render(
    h(SearchBox, {
      query,
      results: signal([]),
      renderItem: () => h("li", null, "item"),
      renderEmpty: () => h("div", null, "empty"),
    }),
  );
  assertEquals(html.includes("Clear search"), false);
});
