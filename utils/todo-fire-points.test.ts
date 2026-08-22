import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { selectDueFirePoints } from "./todo-fire-points.ts";
import type { TodoInterface } from "@/models/index.ts";

const now = new Date("2026-08-06T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60_000).toISOString();
const minutesAhead = (m: number) =>
  new Date(now.getTime() + m * 60_000).toISOString();

function todo(over: Partial<TodoInterface>): TodoInterface {
  return {
    id: "t1",
    householdId: "hh",
    title: "Book the venue",
    createdBy: "u1",
    createdAt: "2026-08-01T10:00:00.000Z",
    completedAt: null,
    dueAt: null,
    assignedTo: null,
    completedBy: null,
    ...over,
  };
}

Deno.test("selectDueFirePoints — a moment just passed is in the window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(3) })], now);
  assertEquals(res.length, 1);
  assertEquals(res[0].withinWindow, true);
  assertEquals(res[0].firePointId, `due@${minutesAgo(3)}`);
});

Deno.test("selectDueFirePoints — a future moment is not selected at all", () => {
  assertEquals(
    selectDueFirePoints([todo({ dueAt: minutesAhead(30) })], now),
    [],
  );
});

Deno.test("selectDueFirePoints — older than an hour is selected but out of window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(90) })], now);
  assertEquals(res.length, 1);
  assertEquals(res[0].withinWindow, false);
});

Deno.test("selectDueFirePoints — exactly one hour ago is still in the window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(60) })], now);
  assertEquals(res[0].withinWindow, true);
});

Deno.test("selectDueFirePoints — done to-dos are ignored", () => {
  assertEquals(
    selectDueFirePoints(
      [todo({ dueAt: minutesAgo(5), completedAt: minutesAgo(2) })],
      now,
    ),
    [],
  );
});

Deno.test("selectDueFirePoints — undated to-dos are ignored", () => {
  assertEquals(selectDueFirePoints([todo({ dueAt: null })], now), []);
});

Deno.test("selectDueFirePoints — the fire-point id carries the instant", () => {
  const due = minutesAgo(10);
  const res = selectDueFirePoints([todo({ dueAt: due })], now);
  // Rescheduling must mint a new fire-point, so the instant is part of the id.
  assertEquals(res[0].firePointId, `due@${due}`);
});
