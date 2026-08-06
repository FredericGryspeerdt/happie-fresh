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

Deno.test("TodoBacklog — renders a section header per populated group", () => {
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Overdue one", dueAt: past }),
      todo({ id: "t2", title: "Due later today", dueAt: soon }),
      todo({ id: "t3", title: "Undated one", dueAt: null }),
    ],
  }));

  assertStringIncludes(html, ">Overdue<");
  assertStringIncludes(html, ">Today<");
  assertStringIncludes(html, ">No date<");
  assertStringIncludes(html, "Overdue one");
  assertStringIncludes(html, "Undated one");
});

Deno.test("TodoBacklog — omits headers for empty groups", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", title: "Undated one", dueAt: null })],
  }));

  assertStringIncludes(html, ">No date<");
  assertFalse(html.includes(">Overdue<"));
  assertFalse(html.includes(">This week<"));
});

Deno.test("TodoBacklog — an undated to-do offers the add-due affordance", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", dueAt: null })],
  }));

  assertStringIncludes(html, "Add a due date");
});

Deno.test("TodoBacklog — Done hides to-dos completed more than 7 days ago", () => {
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Done recently", completedAt: recent }),
      todo({ id: "t2", title: "Done ages ago", completedAt: old }),
    ],
  }));

  assertStringIncludes(html, "Done recently");
  assertFalse(html.includes("Done ages ago"));
  assertStringIncludes(html, "Show earlier");
});

Deno.test("TodoBacklog — no Show earlier button when nothing is outside the window", () => {
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Done recently", completedAt: recent }),
    ],
  }));

  assertStringIncludes(html, "Done recently");
  assertFalse(html.includes("Show earlier"));
});

Deno.test("TodoBacklog — Done section (and its reveal) still renders when every done to-do is outside the window, with no open to-dos", () => {
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Done ages ago", completedAt: old }),
    ],
  }));

  assertStringIncludes(html, ">Done<"); // section exists even with zero visible rows
  assertStringIncludes(html, "Show earlier (1)"); // the only way to reach it
  assertFalse(html.includes("Done ages ago")); // outside the window until revealed
  assertFalse(html.includes("Nothing to do")); // this isn't the empty state
});

Deno.test("TodoBacklog — Done section (and its reveal) still renders when every done to-do is outside the window, alongside an open to-do", () => {
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Take out the bins" }),
      todo({ id: "t2", title: "Done ages ago", completedAt: old }),
    ],
  }));

  assertStringIncludes(html, "Take out the bins");
  assertStringIncludes(html, ">Done<");
  assertStringIncludes(html, "Show earlier (1)");
});

Deno.test("TodoBacklog — offers the reminder nudge when a to-do has a due date", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", dueAt: new Date(Date.now() + 86400000).toISOString() }),
    ],
  }));

  assertStringIncludes(html, "Get reminded when a to-do is due");
});

Deno.test("TodoBacklog — no nudge when nothing has a due date", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", dueAt: null })],
  }));

  assertFalse(html.includes("Get reminded when a to-do is due"));
});
