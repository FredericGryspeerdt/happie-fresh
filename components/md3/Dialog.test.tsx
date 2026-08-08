import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Dialog } from "./Dialog.tsx";

Deno.test("Dialog — open: modal dialog with headline on surface-chigh", () => {
  const html = render(h(Dialog, {
    open: true,
    onClose: () => {},
    headline: "Rename list",
    children: "Pick a new name.",
  }));
  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, 'aria-modal="true"');
  assertStringIncludes(html, "Rename list");
  assertStringIncludes(html, "md-headline-small");
  assertStringIncludes(html, "bg-surface-chigh");
  assertStringIncludes(html, "md-elevation-3");
  assertStringIncludes(html, "pointer-events:auto");
});

Deno.test("Dialog — closed: inert and invisible", () => {
  const html = render(h(Dialog, { open: false, onClose: () => {} }));
  assertStringIncludes(html, "pointer-events:none");
  assertStringIncludes(html, "opacity:0");
});
