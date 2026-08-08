import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AppChrome from "./AppChrome.tsx";

Deno.test("AppChrome — mode:none renders only the loading bar (full-screen route)", () => {
  const html = render(
    h(AppChrome, {
      appBar: { mode: "none" },
      sectionTitle: "Shopping",
      actingMember: null,
      actingClaimed: true,
    }),
  );
  assertStringIncludes(html, 'role="progressbar"');
  assertFalse(html.includes('aria-label="Main navigation"'));
  assertFalse(html.includes("Shopping"));
});

Deno.test("AppChrome — mode:detail renders a back + title bar", () => {
  const html = render(
    h(AppChrome, {
      appBar: { mode: "detail", title: "Add items", backUrl: "/shopping/l1" },
      sectionTitle: "Shopping",
      actingMember: null,
      actingClaimed: true,
    }),
  );
  assertStringIncludes(html, "Add items");
  assertStringIncludes(html, "/shopping/l1");
});
