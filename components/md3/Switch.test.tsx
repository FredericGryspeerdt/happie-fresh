import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Switch } from "./Switch.tsx";

Deno.test("Switch — on: switch role, checked, primary track", () => {
  const html = render(h(Switch, { checked: true, onChange: () => {} }));
  assertStringIncludes(html, 'role="switch"');
  assertStringIncludes(html, 'aria-checked="true"');
  assertStringIncludes(html, "bg-primary");
});

Deno.test("Switch — off: unchecked, outlined surface track", () => {
  const html = render(h(Switch, { checked: false, onChange: () => {} }));
  assertStringIncludes(html, 'aria-checked="false"');
  assertStringIncludes(html, "bg-surface-chighest");
  assertStringIncludes(html, "border-outline");
});

Deno.test("Switch — disabled renders a disabled button", () => {
  const html = render(
    h(Switch, { checked: false, onChange: () => {}, disabled: true }),
  );
  assertStringIncludes(html, "disabled");
});
