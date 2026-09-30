import { assertEquals } from "jsr:@std/assert@^1.0.19";
import type { TodoInterface } from "@/models/index.ts";
import { homeTodos } from "@/utils/home.ts";

const todo = (
  id: string,
  dueAt: string | null,
  completedAt: string | null = null,
): TodoInterface => ({
  id,
  dueAt,
  completedAt,
  householdId: "h",
  title: id,
  createdBy: "m",
  createdAt: "2026-01-01T00:00:00Z",
  assignedTo: null,
  completedBy: null,
});
Deno.test("Start — today precedes older overdue work; hides undated, tomorrow and done", () => {
  const now = new Date(2026, 8, 30, 12);
  const iso = (day: number, hour: number) =>
    new Date(2026, 8, day, hour).toISOString();
  const result = homeTodos([
    todo("oldest", iso(27, 8)),
    todo("today-late", iso(30, 19)),
    todo("undated", null),
    todo("today-past", iso(30, 8)),
    todo("yesterday", iso(29, 11)),
    todo("tomorrow", iso(31, 0)),
    todo("done", iso(30, 9), iso(30, 10)),
    todo("today-midnight", iso(30, 0)),
  ], now);
  assertEquals(result.map((t) => t.id), [
    "today-midnight",
    "today-past",
    "today-late",
    "oldest",
    "yesterday",
  ]);
});
Deno.test("Start — midnight rollover promotes the new day without duplicating yesterday", () => {
  const items = [
    todo("yesterday", new Date(2026, 8, 30, 23).toISOString()),
    todo("today", new Date(2026, 9, 1, 0).toISOString()),
  ];
  assertEquals(homeTodos(items, new Date(2026, 9, 1, 0)).map((t) => t.id), [
    "today",
    "yesterday",
  ]);
});
