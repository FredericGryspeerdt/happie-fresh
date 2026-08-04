import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import TodoBacklog from "./TodoBacklog.tsx";
import type { TodoInterface } from "@/models/index.ts";

function todo(over: Partial<TodoInterface>): TodoInterface {
  return {
    id: "t1",
    householdId: "hh",
    title: "Take out the bins",
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
    completedAt: null,
    dueAt: null,
    ...over,
  };
}

Deno.test("TodoBacklog — renders open and done to-dos, and the FAB", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Take out the bins" }),
      todo({ id: "t2", title: "Call the dentist", notes: "09 123 45 67" }),
      todo({
        id: "t3",
        title: "Pay the water bill",
        completedAt: "2026-08-02T12:00:00.000Z",
      }),
    ],
  }));

  assertStringIncludes(html, "Take out the bins");
  assertStringIncludes(html, "Call the dentist");
  assertStringIncludes(html, "09 123 45 67"); // notes hint on the row
  assertStringIncludes(html, "Pay the water bill");
  assertStringIncludes(html, ">Done<"); // done section heading
  assertStringIncludes(html, "New to-do"); // FAB label
});

Deno.test("TodoBacklog — empty state when the household has no to-dos", () => {
  const html = render(h(TodoBacklog, { initialTodos: [] }));

  assertStringIncludes(html, "Nothing to do");
  assertStringIncludes(html, "New to-do"); // FAB is still offered
});

Deno.test("TodoBacklog — no Done heading when nothing is done yet", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", title: "Take out the bins" })],
  }));

  assertStringIncludes(html, "Take out the bins");
  // The create sheet's body is gated on its open state, so nothing else in the
  // SSR output says "Done" — this really is the section heading.
  assertFalse(html.includes(">Done<"));
});

Deno.test("TodoBacklog — create sheet's title input does not rely on the bare autofocus attribute", () => {
  const html = render(h(TodoBacklog, { initialTodos: [] }));

  // `autofocus` is only honoured by browsers during initial document parse;
  // it's inert for the create sheet's title input, which mounts dynamically
  // when the sheet opens (gated on createOpen.value). Focus is instead set
  // programmatically — see the "create-sheet focus handoff" comment in
  // TodoBacklog.tsx — so the attribute must not appear anywhere in the SSR
  // output.
  assertFalse(html.includes("autofocus"));
});
