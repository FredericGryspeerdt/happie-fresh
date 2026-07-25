import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Spinner } from "./Spinner.tsx";

Deno.test("Spinner — renders status role and a default Loading label", () => {
  const html = render(h(Spinner, {}));
  assertStringIncludes(html, 'role="status"');
  assertStringIncludes(html, "Loading");
});

Deno.test("Spinner — applies a custom size", () => {
  const html = render(h(Spinner, { size: 40 }));
  assertStringIncludes(html, "40px");
});
