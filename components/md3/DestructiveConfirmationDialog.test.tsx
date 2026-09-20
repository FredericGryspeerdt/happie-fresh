import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { DestructiveConfirmationDialog } from "./DestructiveConfirmationDialog.tsx";

Deno.test("DestructiveConfirmationDialog — uses an MD3 dialog and destructive action", () => {
  const html = render(h(DestructiveConfirmationDialog, {
    open: true,
    headline: "Delete this dish?",
    supportingText: "Pasta will be removed for everyone.",
    confirmLabel: "Delete dish",
    onClose: () => {},
    onConfirm: () => {},
  }));

  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, "Delete this dish?");
  assertStringIncludes(html, "Pasta will be removed for everyone.");
  assertStringIncludes(html, "Delete dish");
  assertStringIncludes(html, "bg-error");
  assertStringIncludes(html, "Cancel");
});

Deno.test("DestructiveConfirmationDialog — blocks dismissal and actions while pending", () => {
  const html = render(h(DestructiveConfirmationDialog, {
    open: true,
    headline: "Clear this week?",
    supportingText: "Every planned dish will be removed.",
    confirmLabel: "Clear week",
    pending: true,
    onClose: () => {},
    onConfirm: () => {},
  }));

  assertStringIncludes(html, "Loading");
  assertStringIncludes(html, "disabled");
});
