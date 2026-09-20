import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import AssigneePicker from "./AssigneePicker.tsx";

Deno.test("AssigneePicker — labels its radiogroup with the visible heading", () => {
  const html = render(h(AssigneePicker, {
    members: [],
    value: null,
    onChange: () => {},
  }));

  assertStringIncludes(html, 'id="assignee-picker-label"');
  assertStringIncludes(html, 'aria-labelledby="assignee-picker-label"');
  assertFalse(html.includes('aria-label="Assigned to"'));
});
