import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AppChrome from "./AppChrome.tsx";

Deno.test("AppChrome — mode:none renders no chrome (full-screen route)", () => {
  const html = render(
    h(AppChrome, { appBar: { mode: "none" }, sectionTitle: "Shopping" }),
  );
  assertEquals(html, "");
});

Deno.test("AppChrome — mode:detail renders a back + title bar", () => {
  const html = render(
    h(AppChrome, {
      appBar: { mode: "detail", title: "Add items", backUrl: "/shopping/l1" },
      sectionTitle: "Shopping",
    }),
  );
  assertStringIncludes(html, "Add items");
  assertStringIncludes(html, "/shopping/l1");
});
