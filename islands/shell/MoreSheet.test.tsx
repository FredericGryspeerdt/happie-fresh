import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import MoreSheet from "./MoreSheet.tsx";

Deno.test("MoreSheet — opens launch diagnostics inside the installed app", () => {
  const html = render(
    h(MoreSheet, {
      open: true,
      onClose: () => {},
    }),
  );

  assertStringIncludes(html, "Launch diagnostics");
  assertStringIncludes(html, 'href="/launch-diagnostics"');
});
