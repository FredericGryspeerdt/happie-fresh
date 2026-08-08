import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { FullScreenDialog } from "./FullScreenDialog.tsx";

Deno.test("FullScreenDialog — open: header with close, title, action", () => {
  const html = render(h(FullScreenDialog, {
    open: true,
    onClose: () => {},
    title: "New member",
    action: "SAVE_ACTION_SLOT",
    children: "form goes here",
  }));
  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, "New member");
  assertStringIncludes(html, "md-title-large");
  assertStringIncludes(html, 'aria-label="Close"');
  assertStringIncludes(html, "SAVE_ACTION_SLOT");
  assertStringIncludes(html, "form goes here");
});

Deno.test("FullScreenDialog — closed: inert, slid a full viewport down", () => {
  const html = render(h(FullScreenDialog, {
    open: false,
    onClose: () => {},
    title: "New member",
  }));
  assertStringIncludes(html, "pointer-events:none");
  assertStringIncludes(html, "translateY(100dvh)");
});
