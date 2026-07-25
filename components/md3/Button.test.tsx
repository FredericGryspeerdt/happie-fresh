import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Button } from "./Button.tsx";

Deno.test("Button — filled variant uses primary background utility", () => {
  const html = render(h(Button, { variant: "filled" }, "Save"));
  assertStringIncludes(html, "bg-primary");
  assertStringIncludes(html, "Save");
});

Deno.test("Button — loading renders a spinner and disabled styling", () => {
  const html = render(h(Button, { loading: true }, "Save"));
  assertStringIncludes(html, 'role="status"'); // the spinner
  assertStringIncludes(html, "38%"); // disabled text mix (color-mix ... 38%)
  assertStringIncludes(html, "Save");
});
