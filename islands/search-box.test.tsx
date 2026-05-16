import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
import { h } from "preact";
import { signal } from "@preact/signals";
import SearchBox from "./search-box.tsx";

Deno.test("SearchBox — renders clear button when query is non-empty", () => {
  const query = signal("milk");
  const html = render(
    h(SearchBox, {
      query,
      results: signal([]),
      inputRef: { current: null },
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
      inputRef: { current: null },
      renderItem: () => h("li", null, "item"),
      renderEmpty: () => h("div", null, "empty"),
    }),
  );
  assertEquals(html.includes("Clear search"), false);
});
