import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  compareTodos,
  formatDueAt,
  GROUP_LABELS,
  groupOpenTodos,
  isOverdue,
  parseDueAt,
  type TodoGroupKey,
} from "./todo-due.ts";
import type { TodoInterface } from "@/models/index.ts";

// Local-time constructor so these tests are independent of the machine's zone:
// `new Date(y, m, d, h, min)` interprets its arguments in local time, which is
// exactly the zone the functions under test reason in.
const local = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
): Date => new Date(y, m - 1, d, h, min, 0, 0);

function todo(
  id: string,
  dueAt: string | null,
  createdAt = "2026-08-01T00:00:00.000Z",
): TodoInterface {
  return {
    id,
    householdId: "hh",
    title: `todo ${id}`,
    createdBy: "u1",
    createdAt,
    completedAt: null,
    dueAt,
    assignedTo: null,
    completedBy: null,
  };
}

const keys = (todos: TodoInterface[], now: Date): TodoGroupKey[] =>
  groupOpenTodos(todos, now).map((g) => g.key);

// ── grouping boundaries ──────────────────────────────────────────────────────

Deno.test("groupOpenTodos — a to-do due earlier today is overdue, not today", () => {
  const now = local(2026, 8, 5, 18, 0); // Wednesday 18:00
  const t = todo("a", local(2026, 8, 5, 9, 0).toISOString());

  assertEquals(keys([t], now), ["overdue"]);
});

Deno.test("groupOpenTodos — a to-do due later today is today", () => {
  const now = local(2026, 8, 5, 9, 0);
  const t = todo("a", local(2026, 8, 5, 18, 0).toISOString());

  assertEquals(keys([t], now), ["today"]);
});

Deno.test("groupOpenTodos — tomorrow through the coming Sunday is thisWeek", () => {
  const now = local(2026, 8, 5, 9, 0); // Wednesday
  const thu = todo("a", local(2026, 8, 6, 9, 0).toISOString());
  const sun = todo("b", local(2026, 8, 9, 23, 0).toISOString()); // Sunday

  assertEquals(keys([thu, sun], now), ["thisWeek"]);
  assertEquals(groupOpenTodos([thu, sun], now)[0].todos.map((t) => t.id), [
    "a",
    "b",
  ]);
});

Deno.test("groupOpenTodos — the Monday after the coming Sunday is later", () => {
  const now = local(2026, 8, 5, 9, 0); // Wednesday
  const mon = todo("a", local(2026, 8, 10, 9, 0).toISOString());

  assertEquals(keys([mon], now), ["later"]);
});

Deno.test("groupOpenTodos — on a Sunday, thisWeek covers the week ahead", () => {
  const now = local(2026, 8, 9, 18, 0); // Sunday evening
  const mon = todo("a", local(2026, 8, 10, 9, 0).toISOString());
  const nextSun = todo("b", local(2026, 8, 16, 9, 0).toISOString());
  const beyond = todo("c", local(2026, 8, 17, 9, 0).toISOString());

  assertEquals(keys([mon, nextSun, beyond], now), ["thisWeek", "later"]);
  const groups = groupOpenTodos([mon, nextSun, beyond], now);
  assertEquals(groups[0].todos.map((t) => t.id), ["a", "b"]);
  assertEquals(groups[1].todos.map((t) => t.id), ["c"]);
});

Deno.test("groupOpenTodos — undated to-dos land in noDate", () => {
  const now = local(2026, 8, 5, 9, 0);

  assertEquals(keys([todo("a", null)], now), ["noDate"]);
});

// ── group mechanics ──────────────────────────────────────────────────────────

Deno.test("groupOpenTodos — empty groups are omitted and order is fixed", () => {
  const now = local(2026, 8, 5, 12, 0); // Wednesday
  const list = [
    todo("late", local(2026, 8, 4, 9, 0).toISOString()),
    todo("soon", local(2026, 8, 5, 20, 0).toISOString()),
    todo("far", local(2026, 8, 20, 9, 0).toISOString()),
    todo("none", null),
  ];

  assertEquals(keys(list, now), ["overdue", "today", "later", "noDate"]);
});

Deno.test("groupOpenTodos — input order is preserved inside a group", () => {
  const now = local(2026, 8, 5, 12, 0);
  const first = todo("first", local(2026, 8, 6, 9, 0).toISOString());
  const second = todo("second", local(2026, 8, 7, 9, 0).toISOString());

  const group = groupOpenTodos([first, second], now)[0];
  assertEquals(group.todos.map((t) => t.id), ["first", "second"]);
});

Deno.test("groupOpenTodos — an empty input yields no groups", () => {
  assertEquals(groupOpenTodos([], local(2026, 8, 5)), []);
});

Deno.test("GROUP_LABELS — every key has a user-facing header", () => {
  assertEquals(GROUP_LABELS.overdue, "Overdue");
  assertEquals(GROUP_LABELS.today, "Today");
  assertEquals(GROUP_LABELS.thisWeek, "This week");
  assertEquals(GROUP_LABELS.later, "Later");
  assertEquals(GROUP_LABELS.noDate, "No date");
});

// ── isOverdue ────────────────────────────────────────────────────────────────

Deno.test("isOverdue — past is overdue, future is not, null never is", () => {
  const now = local(2026, 8, 5, 12, 0);

  assertEquals(isOverdue(local(2026, 8, 5, 11, 0).toISOString(), now), true);
  assertEquals(isOverdue(local(2026, 8, 5, 13, 0).toISOString(), now), false);
  assertEquals(isOverdue(null, now), false);
});

// ── formatDueAt ──────────────────────────────────────────────────────────────

Deno.test("formatDueAt — always includes the time", () => {
  const now = local(2026, 8, 5, 12, 0);
  const out = formatDueAt(local(2026, 8, 7, 9, 0).toISOString(), now);

  assertEquals(out.includes("09"), true);
});

Deno.test("formatDueAt — omits the year in the current year, includes it otherwise", () => {
  const now = local(2026, 8, 5, 12, 0);

  const sameYear = formatDueAt(local(2026, 12, 1, 9, 0).toISOString(), now);
  assertEquals(sameYear.includes("2026"), false);

  const nextYear = formatDueAt(local(2027, 1, 5, 9, 0).toISOString(), now);
  assertEquals(nextYear.includes("2027"), true);
});

// ── parseDueAt ───────────────────────────────────────────────────────────────

Deno.test("parseDueAt — null clears, and passes through as null", () => {
  assertEquals(parseDueAt(null), null);
});

Deno.test("parseDueAt — canonicalises an offset form to UTC", () => {
  assertEquals(
    parseDueAt("2026-08-05T18:00:00+02:00"),
    "2026-08-05T16:00:00.000Z",
  );
});

Deno.test("parseDueAt — leaves an already-canonical instant unchanged", () => {
  assertEquals(
    parseDueAt("2026-08-05T16:00:00.000Z"),
    "2026-08-05T16:00:00.000Z",
  );
});

Deno.test("parseDueAt — undefined signals unusable input", () => {
  assertEquals(parseDueAt("not a date"), undefined);
  assertEquals(parseDueAt(12345), undefined);
  assertEquals(parseDueAt(undefined), undefined);
  assertEquals(parseDueAt({}), undefined);
});

// ── compareTodos ─────────────────────────────────────────────────────────────

Deno.test("compareTodos — produces the full documented order for a mixed list", () => {
  const dueSoon = todo("due-soon", "2026-08-06T09:00:00.000Z");
  const dueLater = todo("due-later", "2026-08-20T09:00:00.000Z");
  const undatedNewer = todo("undated-newer", null, "2026-08-03T10:00:00.000Z");
  const undatedOlder = todo("undated-older", null, "2026-08-01T10:00:00.000Z");
  const doneLater = {
    ...todo("done-later", null),
    completedAt: "2026-08-04T12:00:00.000Z",
  };
  const doneEarlier = {
    ...todo("done-earlier", null),
    completedAt: "2026-08-02T12:00:00.000Z",
  };

  const shuffled = [
    doneEarlier,
    undatedOlder,
    dueLater,
    doneLater,
    undatedNewer,
    dueSoon,
  ];

  assertEquals(
    [...shuffled].sort(compareTodos).map((t) => t.id),
    [
      "due-soon",
      "due-later",
      "undated-newer",
      "undated-older",
      "done-later",
      "done-earlier",
    ],
  );
});
