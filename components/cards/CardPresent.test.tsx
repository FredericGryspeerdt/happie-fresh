import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { CardPresent } from "./CardPresent.tsx";

Deno.test("CardPresent — removes a card through the shared confirmation dialog", () => {
  const html = render(h(CardPresent, {
    card: {
      id: "c1",
      householdId: "h1",
      label: "Library",
      value: "ABC",
      format: "code128",
      color: "#fff",
    },
    canDelete: true,
    deletePending: false,
    onClose: () => {},
    onEdit: () => {},
    onDelete: () => Promise.resolve(true),
  }));
  assertStringIncludes(html, "Remove this card?");
  assertStringIncludes(html, "Remove card");
});

Deno.test("CardPresent — blocks confirmation dismissal while removal is pending", () => {
  const html = render(h(CardPresent, {
    card: {
      id: "c1",
      householdId: "h1",
      label: "Library",
      value: "ABC",
      format: "code128",
      color: "#fff",
    },
    canDelete: true,
    deletePending: true,
    onClose: () => {},
    onEdit: () => {},
    onDelete: () => Promise.resolve(false),
  }));

  assertStringIncludes(html, "Loading");
  assertStringIncludes(html, "disabled");
});
