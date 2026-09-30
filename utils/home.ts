import type { TodoInterface } from "@/models/index.ts";

/** Local calendar-day ordering: today's work first, then older overdue work. */
export function homeTodos(todos: TodoInterface[], now: Date): TodoInterface[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    .getTime();
  return todos.filter((t) =>
    t.completedAt === null && t.dueAt !== null && Date.parse(t.dueAt) < end
  )
    .sort((a, b) => {
      const at = Date.parse(a.dueAt!);
      const bt = Date.parse(b.dueAt!);
      return Number(bt >= start) - Number(at >= start) || at - bt ||
        a.id.localeCompare(b.id);
    });
}

export function homeDueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const day = due.toDateString() === now.toDateString()
    ? "Vandaag"
    : due.toDateString() === yesterday.toDateString()
    ? "Gisteren"
    : due.toLocaleDateString("nl-BE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${day}, ${
    due.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })
  }`;
}
