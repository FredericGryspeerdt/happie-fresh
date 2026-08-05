import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DueChip from "./DueChip.tsx";

const now = new Date(2026, 7, 5, 12, 0); // 5 Aug 2026, local noon

Deno.test("DueChip — undated shows the add affordance, not a date", () => {
  const html = render(
    h(DueChip, { dueAt: null, now, onClick: () => {} }),
  );

  assertStringIncludes(html, "due");
  assertFalse(html.includes("Aug"));
});

Deno.test("DueChip — dated shows the formatted moment including the time", () => {
  const due = new Date(2026, 7, 7, 9, 0).toISOString();
  const html = render(h(DueChip, { dueAt: due, now, onClick: () => {} }));

  assertStringIncludes(html, "Aug");
  assertStringIncludes(html, "09");
});

Deno.test("DueChip — an overdue moment is rendered in error colour", () => {
  const past = new Date(2026, 7, 4, 9, 0).toISOString();
  const html = render(h(DueChip, { dueAt: past, now, onClick: () => {} }));

  assertStringIncludes(html, "text-error");
});

Deno.test("DueChip — a future moment is not rendered in error colour", () => {
  const future = new Date(2026, 7, 9, 9, 0).toISOString();
  const html = render(h(DueChip, { dueAt: future, now, onClick: () => {} }));

  assertFalse(html.includes("text-error"));
});
