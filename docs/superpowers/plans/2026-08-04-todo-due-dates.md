# To-do Due Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a to-do an optional due moment, group the open backlog by urgency, and let a due date be set or changed in one tap from the row.

**Architecture:** One new nullable field (`dueAt`, a UTC instant) threaded through model → repo → API → hook → island. The repo's ordering changes so a single-pass bucketer preserves order inside every section. All date reasoning lives in one pure, unit-tested module (`utils/todo-due.ts`) used by both the SSR loader and the island, because grouping depends on the *viewer's* timezone and the server doesn't know it.

**Tech Stack:** Deno, Fresh 2 (SSR + islands), Preact, `@preact/signals`, Deno KV, Tailwind CSS v4, native `<input type="datetime-local">`, `@std/assert` + `preact-render-to-string` for tests.

**Spec:** [`docs/superpowers/specs/2026-08-04-todo-due-dates-design.md`](../specs/2026-08-04-todo-due-dates-design.md)
**Decisions of record:** [ADR 0003](../../adr/0003-todos-are-one-off-chores-are-a-separate-module.md) (to-dos are one-off; chores are a separate module), [ADR 0004](../../adr/0004-due-dates-are-utc-instants-timezone-is-presentation.md) (due dates are UTC instants; timezone is presentation only)

## Before you start

Baseline on this branch (`feature/todos-due-dates`, off `main` at `ee43204`): `deno task check` passes and `deno task test` reports **274 passed, 0 failed**. If yours differs, find out why before starting — don't attribute a pre-existing failure to your own work. If `deno check` complains about missing npm packages, run `deno install` once.

## Global Constraints

- **Deno + Fresh 2.** Handlers are `define.handlers({...})` with `define` from `@/utils/index.ts`; context type is `Context` from `"fresh"`, never the deprecated `FreshContext`.
- **Imports use the `@/` alias** for project root. Repos come from `@/database/index.ts`, models from `@/models/index.ts`, HTTP helpers (`json`, `noContent`, `badRequest`, `notFound`) from `@/utils/index.ts`.
- **JSX is `precompile`** — write `class`, never `className`.
- **Never call `Deno.openKv()` directly** — always `getKv()` from `@/database/db.ts`.
- **Signals:** hooks create state with `signal()` at hook-body level; the island calls the hook inside `useMemo(() => useTodos(initialTodos), [])` so signals are created once. Island-local state uses `useSignal()`. Do not change either.
- **`dueAt` is a required key with a nullable value** (`string | null`), matching `completedAt` — never optional-and-absent, so every write path states it.
- **`dueAt` is always stored as a canonical UTC ISO string.** `<input type="datetime-local">` yields *local wall-clock with no zone*, so convert with `new Date(localValue).toISOString()` on the way in, and format from the instant on the way out. Never send the raw input value to the API; never render `dueAt` without converting.
- **Timezone is never stored.** Entry and display use the viewer's device zone. Nothing on the server knows it.
- **Grouping is computed at render, not on a timer.** A page left open overnight goes stale until the next interaction, navigation or pull-to-refresh. That is intended.
- **`mergeDefinedPatch` skips `undefined`, not `null`.** That is what lets `{ dueAt: null }` clear a due date. Never bypass it.
- **The PATCH allow-list stays an allow-list** — `createdBy` and `createdAt` remain unpatchable.
- **Copy stays English** and warm enough for a child to read; issue #13 converts the app in one pass.
- **Existing tests must keep passing untouched.** If an existing assertion needs weakening, the implementation is wrong, not the test.
- **Conventional Commits.** `deno task check` (`deno fmt --check && deno lint && deno check`) and `deno task test` (`deno test --unstable-kv -A`) must both pass before each commit.
- **Out of scope, do not build:** notifications, reminders, recurrence (ADR 0003 — it belongs to a future Chores module), assignment, `completedBy`, filters, labels, a review/meeting flow, a per-household timezone or week-boundary setting, a custom MD3 date picker.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Modify `models/todo/todo.interface.ts` | Add `dueAt` to the interface and `TodoInput`. |
| Create `utils/todo-due.ts` | **All** date reasoning: grouping boundaries and row formatting. Pure, no DOM, no KV. |
| Create `utils/todo-due.test.ts` | The bulk of new coverage — boundaries are the feature. |
| Modify `database/todo.repo.ts` | Read-normalise `dueAt`; change the open-to-do comparator. |
| Modify `database/todo.repo.test.ts` | Add `dueAt: null` to `draft()`; add dated-ordering cases. |
| Modify `routes/api/todos/index.ts` | Accept `dueAt` on create. |
| Modify `routes/api/todos/[id].ts` | Add `dueAt` to the PATCH allow-list. |
| Modify `routes/api/todos/index.test.ts` | `dueAt` on create, normalisation, validation. |
| Modify `routes/api/todos/[id].test.ts` | Add `dueAt: null` to `seed()`; patch/clear/validate cases. |
| Modify `hooks/useTodos.ts` | Add `setDueAt`. |
| Modify `hooks/useTodos.test.ts` | Add `dueAt: null` to `makeTodo()`; `setDueAt` success + rollback. |
| Create `islands/todos/DueChip.tsx` | The row's due chip: formatting, overdue colour, the undated affordance. One responsibility, so the island doesn't grow another 60 lines. |
| Modify `islands/todos/TodoBacklog.tsx` | Sections, the chip wiring, the picker sheet, the Done window. |
| Modify `islands/todos/TodoBacklog.test.tsx` | Add `dueAt: null` to `todo()`; section headers, chip, Done window. |
| Modify `routes/todos/index.tsx` | No change to the loader; it already passes the whole ordered list. **Verify only.** |

Task order follows the dependency chain: model → pure date logic → persistence → API → hook → UI. Each task ends green and committed.

---

### Task 1: Add `dueAt` to the model and fix the test helpers

**Files:**
- Modify: `models/todo/todo.interface.ts`
- Modify: `database/todo.repo.test.ts` (the `draft()` helper only)
- Modify: `routes/api/todos/[id].test.ts` (the `seed()` helper only)
- Modify: `hooks/useTodos.test.ts` (the `makeTodo()` helper only)
- Modify: `islands/todos/TodoBacklog.test.tsx` (the `todo()` helper only)

**Interfaces:**
- Consumes: nothing.
- Produces: `TodoInterface.dueAt: string | null`, and `TodoInput = Pick<TodoInterface, "title" | "notes" | "dueAt">`. `CreateTodoDto` and `UpdateTodoDto` are derived and pick `dueAt` up automatically.

Making `dueAt` a required key **breaks compilation of four test helpers** that build `TodoInterface` / `CreateTodoDto`. Fixing them is part of this task, and each gains `dueAt: null` in its defaults so every existing assertion behaves exactly as before. This task deliberately has no new test of its own — `deno check` plus the untouched 274 are the gate.

- [ ] **Step 1: Add the field**

In `models/todo/todo.interface.ts`, add to `TodoInterface` after `completedAt`:

```ts
  /**
   * When this is due, as a UTC instant, or null if it has no due moment.
   * Always a moment and never just a day — see docs/adr/0004. Entered and
   * displayed in the viewer's timezone; neither this record nor the server
   * knows what that zone is.
   */
  dueAt: string | null;
```

- [ ] **Step 2: Let the client send it at capture time**

In the same file, change `TodoInput`:

```ts
export type TodoInput = Pick<TodoInterface, "title" | "notes" | "dueAt">;
```

Leave `CreateTodoDto` and `UpdateTodoDto` alone — they are derived from `TodoInterface` and already include `dueAt`.

- [ ] **Step 3: Confirm the breakage is exactly the four helpers**

Run: `deno check`
Expected: FAIL, with errors pointing at the four helper functions named above (missing property `dueAt`). If any *other* file fails, stop and report it — that means something constructs a to-do somewhere this plan didn't account for.

- [ ] **Step 4: Fix all four helpers**

In `database/todo.repo.test.ts`, add to the object `draft()` returns, before the `...overrides` spread:

```ts
    dueAt: null,
```

In `routes/api/todos/[id].test.ts`, add the same line to the object `seed()` passes to `TodoRepo.create`.

In `hooks/useTodos.test.ts`, add the same line to the object `makeTodo()` returns, before its `...over` spread.

In `islands/todos/TodoBacklog.test.tsx`, add the same line to the object `todo()` returns, before its `...over` spread.

In each case the line goes **before** the spread, so a test can still override it.

- [ ] **Step 5: Verify check and the whole suite pass**

Run: `deno task check && deno task test`
Expected: both PASS, **274 passed** — unchanged, because every helper now supplies `dueAt: null` and no assertion depended on the field.

- [ ] **Step 6: Commit**

```bash
git add models/todo/todo.interface.ts database/todo.repo.test.ts routes/api/todos/[id].test.ts hooks/useTodos.test.ts islands/todos/TodoBacklog.test.tsx
git commit -m "feat(todos): add dueAt to the Todo model"
```

---

### Task 2: `utils/todo-due.ts` — grouping and formatting

**Files:**
- Create: `utils/todo-due.ts`
- Create: `utils/todo-due.test.ts`

**Interfaces:**
- Consumes: `TodoInterface` from `@/models/index.ts` (Task 1).
- Produces:
  - `type TodoGroupKey = "overdue" | "today" | "thisWeek" | "later" | "noDate"`
  - `interface TodoGroup { key: TodoGroupKey; todos: TodoInterface[] }`
  - `groupOpenTodos(todos: TodoInterface[], now: Date): TodoGroup[]` — preserves input order within each group, omits empty groups, returns groups in the fixed order overdue → today → thisWeek → later → noDate
  - `formatDueAt(dueAt: string, now: Date): string`
  - `GROUP_LABELS: Record<TodoGroupKey, string>` — the user-facing headers
  - `isOverdue(dueAt: string | null, now: Date): boolean`
  - `parseDueAt(raw: unknown): string | null | undefined` — the server-side
    parser: canonical UTC string, `null` to clear, or `undefined` when unusable
    so the caller can `400`. It lives here rather than in a route because it is
    date reasoning, and Task 4's two handlers both need it — a route importing a
    helper from a sibling route would be the wrong seam.

This module is deliberately **pure**: no DOM, no KV, no signals. That is what makes the boundaries testable without a browser, and the boundaries *are* the feature. It is **not** exported from `utils/index.ts` — that barrel is for cross-cutting helpers, and this is to-do-specific; import it by path, as `hooks/useDishes.ts` and friends are imported by path.

Boundary rules, all evaluated in the local zone of the `now` you are given:

- **overdue** — `dueAt < now`. A to-do due at 09:00 seen at 18:00 is overdue, not today.
- **today** — `dueAt >= now` and the same local calendar day as `now`.
- **thisWeek** — after today, through the end of the coming Sunday. **When `now` is itself a Sunday**, that would collapse the group and push Monday into *later* — wrong on the evening a household plans the week — so on a Sunday the window runs to the end of the *following* Sunday.
- **later** — any dated to-do beyond that.
- **noDate** — `dueAt === null`.

- [ ] **Step 1: Write the failing tests**

Create `utils/todo-due.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
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

function todo(id: string, dueAt: string | null, createdAt = "2026-08-01T00:00:00.000Z"): TodoInterface {
  return {
    id,
    householdId: "hh",
    title: `todo ${id}`,
    createdBy: "u1",
    createdAt,
    completedAt: null,
    dueAt,
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
```

Add `parseDueAt` to the import list at the top of this test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A utils/todo-due.test.ts`
Expected: FAIL — `Module not found "file:///.../utils/todo-due.ts"`.

- [ ] **Step 3: Write the implementation**

Create `utils/todo-due.ts`:

```ts
import type { TodoInterface } from "@/models/index.ts";

/**
 * All date reasoning for to-do due moments, kept pure and free of DOM, KV and
 * signals so the boundaries can be tested directly — they are the feature.
 *
 * Everything here reasons in the **local zone of the `now` it is handed**.
 * Grouping cannot be computed on the server, which does not know the viewer's
 * zone (see docs/adr/0004); the SSR loader and the island therefore call the
 * same functions with a different `now`, and can briefly disagree about which
 * group a boundary-adjacent to-do belongs to until hydration settles it.
 */

export type TodoGroupKey =
  | "overdue"
  | "today"
  | "thisWeek"
  | "later"
  | "noDate";

export interface TodoGroup {
  key: TodoGroupKey;
  todos: TodoInterface[];
}

export const GROUP_LABELS: Record<TodoGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  thisWeek: "This week",
  later: "Later",
  noDate: "No date",
};

/** Fixed render order — urgent first, undated last. */
const GROUP_ORDER: TodoGroupKey[] = [
  "overdue",
  "today",
  "thisWeek",
  "later",
  "noDate",
];

export function isOverdue(dueAt: string | null, now: Date): boolean {
  if (dueAt === null) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** Local midnight at the start of the day `d` falls on. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Local midnight ending the "this week" window: the end of the coming Sunday.
 * When `now` is itself a Sunday the window would collapse to nothing and push
 * Monday into `later` — wrong on the evening a household plans the week ahead —
 * so a Sunday extends to the end of the following Sunday.
 */
function endOfWeekWindow(now: Date): Date {
  const day = now.getDay(); // 0 = Sunday
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const start = startOfDay(now);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + daysUntilSunday + 1,
  );
}

function classify(todo: TodoInterface, now: Date): TodoGroupKey {
  if (todo.dueAt === null) return "noDate";
  const due = new Date(todo.dueAt);
  if (due.getTime() < now.getTime()) return "overdue";

  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  if (due.getTime() < tomorrow.getTime()) return "today";
  if (due.getTime() < endOfWeekWindow(now).getTime()) return "thisWeek";
  return "later";
}

/**
 * Buckets already-ordered open to-dos by urgency. Preserves input order within
 * each group — `TodoRepo.getAll` emits dated-ascending then undated-newest
 * precisely so this single pass needs no sorting of its own — and omits groups
 * that end up empty.
 */
export function groupOpenTodos(
  todos: TodoInterface[],
  now: Date,
): TodoGroup[] {
  const buckets = new Map<TodoGroupKey, TodoInterface[]>();
  for (const todo of todos) {
    const key = classify(todo, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(todo);
    else buckets.set(key, [todo]);
  }

  return GROUP_ORDER
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, todos: buckets.get(key)! }));
}

/**
 * The row label for a due moment, e.g. "Fri 1 Aug, 09:00". The time is always
 * included: once notifications exist it is when the phone will buzz, so hiding
 * it would be dishonest. The year is included only when it differs from `now`'s.
 * No explicit locale, so the device's is used and issue #13's Dutch conversion
 * is automatic.
 */
export function formatDueAt(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const date = due.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(due.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  const time = due.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/**
 * Parses a client-supplied due moment. Returns the canonical UTC string, `null`
 * to clear, or `undefined` when the value is unusable so the caller can 400.
 *
 * Canonicalising matters: `TodoRepo.getAll` compares `dueAt` as **strings**, so
 * an offset form like "2026-08-05T18:00:00+02:00" stored verbatim would sort
 * wrongly against "…Z" values. `<input type="datetime-local">` also yields a
 * zoneless local string, which the client converts before sending — this is the
 * server-side backstop for both.
 */
export function parseDueAt(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A utils/todo-due.test.ts`
Expected: PASS, 17 passed.

- [ ] **Step 5: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 291 passed (274 + 17).

- [ ] **Step 6: Commit**

```bash
git add utils/todo-due.ts utils/todo-due.test.ts
git commit -m "feat(todos): add pure due-date grouping and formatting"
```

---

### Task 3: Repo — normalise `dueAt` on read, order dated to-dos first

**Files:**
- Modify: `database/todo.repo.ts`
- Modify: `database/todo.repo.test.ts`

**Interfaces:**
- Consumes: `TodoInterface` with `dueAt` (Task 1).
- Produces: `TodoRepo.getAll(householdId)` emits — open dated by `dueAt` **ascending**, then open undated by `createdAt` **descending**, then done by `completedAt` **descending**; ties broken by `id` throughout. Every returned to-do has `dueAt` present (`null` when absent in storage). Method signatures are unchanged.

Two changes, and the ordering one is what makes Task 2's single-pass bucketer correct.

**Read-normalisation.** Records written before `dueAt` existed have no such key, so `value.dueAt` is `undefined` rather than `null`. Normalise once, in the repo, rather than defending at every call site. **No migration is needed** — this is an additive optional field, unlike #42's household-scoping migration.

- [ ] **Step 1: Add the failing tests**

Append to `database/todo.repo.test.ts`:

```ts
Deno.test({
  name: "getAll — dated open to-dos come before undated ones, soonest first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due";
    await TodoRepo.create(draft(hh, "undated newer", {
      createdAt: "2026-08-03T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "undated older", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "due later", {
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: "2026-09-01T09:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "due soon", {
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), [
      "due soon",
      "due later",
      "undated newer",
      "undated older",
    ]);
  },
});

Deno.test({
  name: "getAll — ties on identical dueAt break by id for a stable order",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due-tie";
    const a = await TodoRepo.create(draft(hh, "a", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));
    const b = await TodoRepo.create(draft(hh, "b", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);
    const expected = [a.id, b.id].sort((x, y) => x.localeCompare(y));

    assertEquals(all.map((t) => t.id), expected);
  },
});

Deno.test({
  name: "getAll — done to-dos stay after every open one, dated or not",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due-done";
    await TodoRepo.create(draft(hh, "done", {
      completedAt: "2026-08-04T12:00:00.000Z",
      dueAt: "2026-08-01T09:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "open undated"));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), ["open undated", "done"]);
  },
});

Deno.test({
  name: "getAll — a record stored without dueAt reads back as null",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-legacy";
    const kv = await getKv();
    const id = "legacy-1";
    // Write a pre-dueAt record shape directly, bypassing create().
    await kv.set(["todos", hh, id], {
      id,
      householdId: hh,
      title: "written before dueAt existed",
      createdBy: "user-1",
      createdAt: "2026-07-01T10:00:00.000Z",
      completedAt: null,
    });

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.length, 1);
    assertEquals(all[0].dueAt, null);
    assertEquals((await TodoRepo.getById(hh, id))?.dueAt, null);
  },
});

Deno.test({
  name: "update — clearing dueAt to null sticks",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-clear-due";
    const todo = await TodoRepo.create(draft(hh, "Book the venue", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const updated = await TodoRepo.update(hh, todo.id, { dueAt: null });

    assertEquals(updated?.dueAt, null);
    assertEquals(updated?.title, "Book the venue");
  },
});
```

The last test needs `getKv`. Add it to the imports at the top of the file:

```ts
import { getKv } from "@/database/db.ts";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A database/todo.repo.test.ts`
Expected: FAIL — the dated-ordering test fails (dated to-dos are not yet ordered first) and the legacy-record test fails (`dueAt` reads back `undefined`, not `null`).

- [ ] **Step 3: Normalise on read**

In `database/todo.repo.ts`, add a private normaliser above the class:

```ts
/**
 * `dueAt` was added after the first to-dos were written, so older records have
 * no such key and `value.dueAt` is `undefined`. Normalising here — once, at the
 * read boundary — keeps every consumer free of `?? null` defensiveness. No
 * migration is needed: the field is additive and optional in storage.
 */
function normalise(value: TodoInterface): TodoInterface {
  return value.dueAt === undefined ? { ...value, dueAt: null } : value;
}
```

Then apply it at both read paths. In `getAll`, change the scan loop:

```ts
    for await (const { value } of iter) todos.push(normalise(value));
```

And in `getById`, change the return:

```ts
    const result = await kv.get<TodoInterface>(["todos", householdId, id]);
    return result.value === null ? null : normalise(result.value);
```

- [ ] **Step 4: Change the open-to-do ordering**

Replace `getAll`'s docblock and comparator. The docblock:

```ts
  /**
   * Every consumer gets the same order, so the SSR render and the hydrated view
   * agree and the island only has to bucket: open to-dos first — those with a
   * due moment ordered soonest-first, then undated ones newest-created first —
   * and finally done ones, most recently done first.
   *
   * Dated-ascending-then-undated-newest is what lets `groupOpenTodos` in
   * utils/todo-due.ts bucket in a single pass without sorting: each urgency
   * group comes out ascending, and "No date" keeps the newest-first order that
   * makes quick capture feel responsive.
   */
```

And the comparator body:

```ts
    return todos.sort((a, b) => {
      const aOpen = a.completedAt === null;
      const bOpen = b.completedAt === null;

      // Open before done.
      if (aOpen !== bOpen) return aOpen ? -1 : 1;

      if (aOpen) {
        const aDated = a.dueAt !== null;
        const bDated = b.dueAt !== null;
        // Dated before undated.
        if (aDated !== bDated) return aDated ? -1 : 1;

        if (aDated) {
          // Soonest due first.
          if (a.dueAt !== b.dueAt) return a.dueAt! < b.dueAt! ? -1 : 1;
          return a.id.localeCompare(b.id);
        }

        // Undated: newest created first. Plain string comparison, not
        // localeCompare — two to-dos captured in the same rapid-capture burst
        // can share a millisecond-precision createdAt, so ties break by id for
        // a total, stable order; otherwise they'd fall back to KV iteration
        // order and could swap places relative to the optimistic prepend.
        if (a.createdAt !== b.createdAt) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.id.localeCompare(b.id);
      }

      // Both done: most recently done first.
      if (a.completedAt !== b.completedAt) {
        return a.completedAt! < b.completedAt! ? 1 : -1;
      }
      return a.id.localeCompare(b.id);
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --unstable-kv -A database/todo.repo.test.ts`
Expected: PASS — the five new tests plus all ten pre-existing ones. **The pre-existing ordering tests must pass untouched**: they construct only undated to-dos, which still sort newest-first. If one needs changing to pass, the comparator is wrong — stop and report it.

- [ ] **Step 6: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 296 passed (291 + 5).

- [ ] **Step 7: Commit**

```bash
git add database/todo.repo.ts database/todo.repo.test.ts
git commit -m "feat(todos): order dated to-dos first and normalise dueAt on read"
```

---

### Task 4: API — accept and validate `dueAt`

**Files:**
- Modify: `routes/api/todos/index.ts`
- Modify: `routes/api/todos/[id].ts`
- Modify: `routes/api/todos/index.test.ts`
- Modify: `routes/api/todos/[id].test.ts`

**Interfaces:**
- Consumes: `TodoRepo` (Task 3); `badRequest` / `json` from `@/utils/index.ts`.
- Produces the wire contract Task 5 relies on:
  - `POST /api/todos` accepts an optional `dueAt` — `null`, absent, or a date-parseable string. Stores the **canonical** `new Date(value).toISOString()`. `400` on anything else.
  - `PATCH /api/todos/:id` accepts `dueAt` in its allow-list with the same rules, including `null` to clear.

Normalising to `toISOString()` rather than storing the raw string matters: a client may legitimately send an offset form like `"2026-08-05T18:00:00+02:00"`, and the repo's comparator compares `dueAt` values as **strings**. Mixed representations of the same instant would sort wrongly. Canonicalising at the boundary keeps every stored value directly comparable.

- [ ] **Step 1: Write the failing tests**

Append to `routes/api/todos/index.test.ts`:

```ts
Deno.test({
  name: "POST accepts a dueAt and stores it canonicalised to UTC",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const created = await (await handler.POST(
      ctx(
        post({ title: "Book the venue", dueAt: "2026-08-05T18:00:00+02:00" }),
        AUTH,
      ),
    )).json();

    assertEquals(created.dueAt, "2026-08-05T16:00:00.000Z");
  },
});

Deno.test({
  name: "POST defaults dueAt to null when absent or explicitly null",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const absent = await (await handler.POST(
      ctx(post({ title: "no date" }), AUTH),
    )).json();
    assertEquals(absent.dueAt, null);

    const explicit = await (await handler.POST(
      ctx(post({ title: "null date", dueAt: null }), AUTH),
    )).json();
    assertEquals(explicit.dueAt, null);
  },
});

Deno.test({
  name: "POST rejects a dueAt that is neither null nor a valid date (400)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.POST(
        ctx(post({ title: "x", dueAt: "not a date" }), AUTH),
      )).status,
      400,
    );
    assertEquals(
      (await handler.POST(ctx(post({ title: "x", dueAt: 12345 }), AUTH)))
        .status,
      400,
    );
  },
});
```

Append to `routes/api/todos/[id].test.ts`:

```ts
Deno.test({
  name: "PATCH sets dueAt, canonicalising to UTC",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await seed();
    const updated = await (await handler.PATCH(
      ctx(patch({ dueAt: "2026-08-05T18:00:00+02:00" }), t.id, AUTH),
    )).json();

    assertEquals(updated.dueAt, "2026-08-05T16:00:00.000Z");
  },
});

Deno.test({
  name: "PATCH clears dueAt with null",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await TodoRepo.create({
      householdId: "h1",
      title: "Book the venue",
      createdBy: "u1",
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: null,
      dueAt: "2026-08-10T09:00:00.000Z",
    });

    const updated = await (await handler.PATCH(
      ctx(patch({ dueAt: null }), t.id, AUTH),
    )).json();

    assertEquals(updated.dueAt, null);
  },
});

Deno.test({
  name: "PATCH rejects an invalid dueAt (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ dueAt: "nope" }), t.id, AUTH))).status,
      400,
    );
    assertEquals(
      (await handler.PATCH(ctx(patch({ dueAt: 7 }), t.id, AUTH))).status,
      400,
    );
    assertEquals((await TodoRepo.getById("h1", t.id))?.dueAt, null);
  },
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A routes/api/todos/`
Expected: FAIL — `dueAt` comes back `null` where a value was sent (the handlers ignore it), and the invalid-input cases return `201`/`200` instead of `400`.

- [ ] **Step 3: Accept `dueAt` on create**

In `routes/api/todos/index.ts`, add the parser to the imports — it lives in the
date module from Task 2, not in a route:

```ts
import { parseDueAt } from "@/utils/todo-due.ts";
```

Then use it in `POST`, after the `rawNotes` line:

```ts
    let dueAt: string | null = null;
    if (body.dueAt !== undefined) {
      const parsed = parseDueAt(body.dueAt);
      if (parsed === undefined) {
        return badRequest("dueAt must be null or a valid date string");
      }
      dueAt = parsed;
    }
```

and add `dueAt,` to the object passed to `TodoRepo.create`.

- [ ] **Step 4: Add `dueAt` to the PATCH allow-list**

In `routes/api/todos/[id].ts`, import the parser:

```ts
import { parseDueAt } from "@/utils/todo-due.ts";
```

Then add a branch after the `completedAt` block, still inside the allow-list:

```ts
    if (body.dueAt !== undefined) {
      const parsed = parseDueAt(body.dueAt);
      if (parsed === undefined) {
        return badRequest("dueAt must be null or a valid date string");
      }
      patch.dueAt = parsed;
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/todos/`
Expected: PASS, 21 passed (15 pre-existing + 6 new).

- [ ] **Step 6: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 302 passed (296 + 6).

- [ ] **Step 7: Commit**

```bash
git add routes/api/todos
git commit -m "feat(todos): accept and canonicalise dueAt in the API"
```

---

### Task 5: Hook — `setDueAt`

**Files:**
- Modify: `hooks/useTodos.ts`
- Modify: `hooks/useTodos.test.ts`

**Interfaces:**
- Consumes: `api.todos.update(id, patch)` (unchanged — `UpdateTodoDto` already carries `dueAt`).
- Produces: `setDueAt(id: string, dueAt: string | null): Promise<boolean>` on the object `useTodos` returns.

`setDueAt` is **optimistic with rollback and an immediate PATCH — never debounced.** Picking a date is a discrete commit, like ticking off, not like typing a title. It needs no exit animation: the to-do stays in the open list, it just moves between groups, which the island re-derives from `openTodos`.

It must also handle a due date being set on a **done** to-do (reachable from the edit sheet, which opens for done to-dos too), so it looks in both lists.

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useTodos.test.ts`:

```ts
Deno.test("setDueAt — sets the due moment optimistically", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, true);
  assertEquals(patches, [{ dueAt: "2026-08-10T09:00:00.000Z" }]);
  assertEquals(hook.openTodos.value[0].dueAt, "2026-08-10T09:00:00.000Z");
});

Deno.test("setDueAt — clears the due moment with null", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", dueAt: "2026-08-10T09:00:00.000Z" }),
  ]);

  const ok = await hook.setDueAt("t1", null);

  assertEquals(ok, true);
  assertEquals(hook.openTodos.value[0].dueAt, null);
});

Deno.test("setDueAt — rolls back and reports failure when the server rejects", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(null),
  );
  const hook = useTodos([makeTodo({ id: "t1", dueAt: null })]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value[0].dueAt, null);
});

Deno.test("setDueAt — works on a done to-do", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, true);
  assertEquals(hook.doneTodos.value[0].dueAt, "2026-08-10T09:00:00.000Z");
});

Deno.test("setDueAt — returns false for an unknown id without calling the api", async () => {
  const calls: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    calls.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  assertEquals(await hook.setDueAt("nope", null), false);
  assertEquals(calls, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A hooks/useTodos.test.ts`
Expected: FAIL — `hook.setDueAt is not a function`.

- [ ] **Step 3: Implement `setDueAt`**

In `hooks/useTodos.ts`, add after `flushTodo`:

```ts
  /**
   * Set or clear a to-do's due moment. Optimistic with rollback and an
   * immediate PATCH — deliberately **not** debounced, because picking a date is
   * a discrete commit like ticking off, not incremental typing.
   *
   * No exit animation: the to-do stays open, it only moves between urgency
   * groups, and the island derives those from `openTodos`. Works on done to-dos
   * too, since the edit sheet opens for them.
   */
  const setDueAt = async (
    id: string,
    dueAt: string | null,
  ): Promise<boolean> => {
    const inOpen = openTodos.value.some((t) => t.id === id);
    const inDone = doneTodos.value.some((t) => t.id === id);
    if (!inOpen && !inDone) return false;

    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const apply = (list: TodoInterface[]) =>
      list.map((t) => (t.id === id ? { ...t, dueAt } : t));

    if (inOpen) openTodos.value = apply(openTodos.value);
    else doneTodos.value = apply(doneTodos.value);

    startPending();
    try {
      const saved = await api.todos.update(id, { dueAt });
      if (!saved) {
        openTodos.value = openSnapshot;
        doneTodos.value = doneSnapshot;
        return false;
      }
      return true;
    } finally {
      endPending();
    }
  };
```

Then add `setDueAt,` to the returned object, after `flushTodo,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A hooks/useTodos.test.ts`
Expected: PASS, 15 passed (10 pre-existing + 5 new).

- [ ] **Step 5: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 307 passed (302 + 5).

- [ ] **Step 6: Commit**

```bash
git add hooks/useTodos.ts hooks/useTodos.test.ts
git commit -m "feat(todos): add setDueAt to the useTodos store"
```

---

### Task 6: `DueChip` component

**Files:**
- Create: `islands/todos/DueChip.tsx`
- Create: `islands/todos/DueChip.test.tsx`

**Interfaces:**
- Consumes: `formatDueAt`, `isOverdue` from `@/utils/todo-due.ts` (Task 2); `Pressable` from `@/components/md3/Pressable.tsx`; `Icon` from `@/components/md3/Icon.tsx`.
- Produces: default-exported `DueChip({ dueAt, now, onClick }: { dueAt: string | null; now: Date; onClick: () => void })`, consumed by Task 7.

Its own file so `TodoBacklog.tsx` doesn't grow another sixty lines of presentation logic — it already carries the sheets, the primer hand-off and the sections.

Two rules that matter:

**Overdue uses error colour on text and outline, never a filled badge.** `bg-error` is the destructive-action colour in this codebase (the Delete buttons), and borrowing it for "late" would dilute a meaning worth protecting. A screen of overdue to-dos must not become a wall of red.

**The chip needs a real hit area.** It sits inside a row that already has a checkbox and a body tap, so it gets `py-1 px-2` and its own `Pressable` — small chips are the classic mobile mis-tap.

- [ ] **Step 1: Write the failing test**

Create `islands/todos/DueChip.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/todos/DueChip.test.tsx`
Expected: FAIL — `Module not found "file:///.../islands/todos/DueChip.tsx"`.

- [ ] **Step 3: Write the component**

Create `islands/todos/DueChip.tsx`:

```tsx
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { formatDueAt, isOverdue } from "@/utils/todo-due.ts";

interface Props {
  dueAt: string | null;
  /** Passed in rather than read here so SSR and the island agree on one clock. */
  now: Date;
  onClick: () => void;
}

/**
 * A to-do's due moment, and the control for changing it.
 *
 * Overdue is marked with error colour on text and outline — never a filled
 * badge. `bg-error` is this codebase's destructive-action colour (the Delete
 * buttons), so filling a chip with it would both dilute that meaning and turn a
 * screen of overdue to-dos into a wall of red. The section header does the
 * structural shouting; the chip only has to be unmistakable once you look at it.
 */
export default function DueChip({ dueAt, now, onClick }: Props) {
  const overdue = isOverdue(dueAt, now);
  const tone = overdue
    ? "text-error border-error"
    : "text-on-surface-variant border-outline-variant";

  return (
    <Pressable
      onClick={onClick}
      aria-label={dueAt ? `Change due date` : "Add a due date"}
      // py-1/px-2 plus the row's own spacing keeps this above the mobile
      // mis-tap threshold; it sits beside a checkbox and a full-row tap target.
      class={`inline-flex items-center gap-1 self-start border rounded-[var(--md-shape-full)] py-1 px-2 md-label-medium ${tone}`}
    >
      {dueAt
        ? (
          <>
            <Icon name="calendar" size={13} />
            {formatDueAt(dueAt, now)}
          </>
        )
        : (
          <>
            <Icon name="plus" size={13} />
            due
          </>
        )}
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/todos/DueChip.test.tsx`
Expected: PASS, 4 passed.

- [ ] **Step 5: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 311 passed (307 + 4).

- [ ] **Step 6: Commit**

```bash
git add islands/todos/DueChip.tsx islands/todos/DueChip.test.tsx
git commit -m "feat(todos): add the DueChip row component"
```

---

### Task 7: Island — sections, the chip, the picker, the Done window

**Files:**
- Modify: `islands/todos/TodoBacklog.tsx`
- Modify: `islands/todos/TodoBacklog.test.tsx`

**Interfaces:**
- Consumes: `setDueAt` from `useTodos` (Task 5); `groupOpenTodos`, `GROUP_LABELS`, `formatDueAt` from `@/utils/todo-due.ts` (Task 2); `DueChip` (Task 6).
- Produces: the finished screen. Nothing downstream consumes it.

This is the largest task. Five changes, in order.

**One clock for the whole render.** Read `Date.now()` **once** per render into a local `now`, and pass it to every grouping and formatting call. Calling `new Date()` separately in each helper would let a row and its section header disagree if the render straddles a second.

**Copy the tests assert on, keep exact:** section headers come from `GROUP_LABELS` (`"Overdue"`, `"Today"`, `"This week"`, `"Later"`, `"No date"`), and the Done reveal reads `Show earlier`.

- [ ] **Step 1: Write the failing tests**

Add to `islands/todos/TodoBacklog.test.tsx`. The existing `todo()` helper already gained `dueAt: null` in Task 1; these override it:

```tsx
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
    initialTodos: [todo({ id: "t1", title: "Done recently", completedAt: recent })],
  }));

  assertStringIncludes(html, "Done recently");
  assertFalse(html.includes("Show earlier"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A islands/todos/TodoBacklog.test.tsx`
Expected: FAIL — no section headers, no due affordance, and both done to-dos rendered.

- [ ] **Step 3: Add imports, `setDueAt`, and the render clock**

In `islands/todos/TodoBacklog.tsx`, add to the imports:

```tsx
import DueChip from "@/islands/todos/DueChip.tsx";
import { GROUP_LABELS, groupOpenTodos } from "@/utils/todo-due.ts";
```

Add `setDueAt,` to the destructured `useTodos` result, after `flushTodo,`.

Add three island-local signals beside the existing ones:

```tsx
  const dueEditingId = useSignal<string | null>(null);
  const dueDraft = useSignal("");
  const showEarlierDone = useSignal(false);
```

Then, immediately after the existing `const exiting = exitingIds.value;`:

```tsx
  // One clock for the whole render: a row and its section header must never
  // disagree because the render straddled a second.
  const now = new Date();

  const groups = groupOpenTodos(open, now);

  // Done is windowed to a rolling 7 days (spec + ADR 0002): a done one-off is
  // finished forever, so the long tail has almost no value — but this is a
  // *render* window, not a fetch window. The loader still pulls the whole
  // backlog, because keys are ["todos", householdId, id] and filtering by
  // completion date would scan everything anyway.
  const doneCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentDone = done.filter((t) =>
    new Date(t.completedAt!).getTime() >= doneCutoff
  );
  const earlierDoneCount = done.length - recentDone.length;
  const visibleDone = showEarlierDone.value ? done : recentDone;
```

- [ ] **Step 4: Add the picker handlers**

Add after `closeEditor`:

```tsx
  /**
   * `<input type="datetime-local">` speaks **local wall-clock with no zone**, so
   * both directions need converting: an existing UTC instant becomes a local
   * "YYYY-MM-DDTHH:mm" for the input, and the value the user picks becomes a UTC
   * instant via `new Date(local).toISOString()`. Never round-trip the raw value.
   */
  const toLocalInputValue = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${
      pad(d.getHours())
    }:${pad(d.getMinutes())}`;
  };

  /** 09:00 tomorrow, as the pre-filled default when no due moment is set. A
   *  household to-do wants telling at the start of a day, and midnight — the
   *  obvious alternative — is the worst possible moment to be reminded. */
  const defaultDueInputValue = (): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d.toISOString());
  };

  const openDuePicker = (id: string, current: string | null) => {
    dueDraft.value = current
      ? toLocalInputValue(current)
      : defaultDueInputValue();
    dueEditingId.value = id;
  };

  const commitDue = async () => {
    const id = dueEditingId.value;
    const local = dueDraft.value;
    dueEditingId.value = null;
    if (!id || !local) return;
    const ok = await setDueAt(id, new Date(local).toISOString());
    if (!ok) say("Couldn't save that due date. Try again?");
  };

  const clearDue = async () => {
    const id = dueEditingId.value;
    dueEditingId.value = null;
    if (!id) return;
    const ok = await setDueAt(id, null);
    if (!ok) say("Couldn't remove that due date. Try again?");
  };
```

- [ ] **Step 5: Add the chip to the row**

The chip must be **below the title** *and* **outside the body `Pressable`** — below so the row stays readable on a narrow phone, and outside so tapping the chip doesn't also open the edit sheet. Neither alone is enough: a sibling of the body `Pressable` at row level would sit to its *right*, and a child of it would swallow the tap. So the title/notes `Pressable` and the chip become siblings inside a new **text column**.

Replace the body `Pressable` (from `<Pressable onClick={() => (editingId.value = t.id)}` through its closing `</Pressable>`) with:

```tsx
      <div class="flex-1 min-w-0 flex flex-col gap-1.5 items-start">
        <Pressable
          onClick={() => (editingId.value = t.id)}
          class="w-full text-left"
        >
          <div
            class={`md-body-large ${
              isDone
                ? "text-on-surface-variant line-through"
                : "text-on-surface"
            }`}
          >
            {t.title}
          </div>
          {t.notes && (
            <div class="md-body-small text-on-surface-variant truncate">
              📝 {t.notes}
            </div>
          )}
        </Pressable>
        <DueChip
          dueAt={t.dueAt}
          now={now}
          onClick={() => openDuePicker(t.id, t.dueAt)}
        />
      </div>
```

The row's outer `class="flex items-start gap-3 px-1 py-2.5"` is unchanged, and the `flex-1 min-w-0` that used to sit on the `Pressable` moves to the new column so long titles still truncate rather than pushing the layout wide.

- [ ] **Step 6: Replace the flat Open list with grouped sections**

Replace this block:

```tsx
              {open.length > 0 && (
                <div class="flex flex-col">
                  {open.map((t) => row(t, false))}
                </div>
              )}
```

with:

```tsx
              {groups.map((g) => (
                <div key={g.key} class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    {GROUP_LABELS[g.key]}
                  </div>
                  {g.todos.map((t) => row(t, false))}
                </div>
              ))}
```

- [ ] **Step 7: Window the Done section**

Replace this block:

```tsx
              {done.length > 0 && (
                <div class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    Done
                  </div>
                  {done.map((t) => row(t, true))}
                </div>
              )}
```

with:

```tsx
              {visibleDone.length > 0 && (
                <div class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    Done
                  </div>
                  {visibleDone.map((t) => row(t, true))}
                  {earlierDoneCount > 0 && !showEarlierDone.value && (
                    <Pressable
                      onClick={() => (showEarlierDone.value = true)}
                      class="self-start md-label-large text-primary px-1 py-2"
                    >
                      Show earlier ({earlierDoneCount})
                    </Pressable>
                  )}
                </div>
              )}
```

- [ ] **Step 8: Add the picker sheet**

Add a fourth `Sheet` just before the closing `<Snackbar ... />`, following the same body-gating the create sheet uses:

```tsx
      {/* Due-date picker. Native <input type="datetime-local"> rather than a
          custom MD3 picker: on mobile it opens the platform's own control,
          which is familiar, accessible and localised for free, and resolves
          local wall-clock time natively — exactly what docs/adr/0004 needs. */}
      <Sheet
        open={dueEditingId.value !== null}
        onClose={() => (dueEditingId.value = null)}
        title="When is it due?"
      >
        {dueEditingId.value !== null && (
          <div class="flex flex-col gap-3 pb-1">
            <input
              type="datetime-local"
              value={dueDraft.value}
              onInput={(e) => (dueDraft.value = e.currentTarget.value)}
              aria-label="Due date and time"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
            />
            <Button variant="filled" full onClick={commitDue}>Save</Button>
            <Button variant="text" full onClick={clearDue}>
              Remove due date
            </Button>
          </div>
        )}
      </Sheet>
```

- [ ] **Step 9: Disable pull-to-refresh while the picker is open**

The existing `PullToRefresh` already guards the other three sheets. Add the fourth, or a drag inside the picker will refresh the list and discard the draft:

```tsx
      disabled={createOpen.value || editingId.value !== null ||
        confirmingId.value !== null || dueEditingId.value !== null}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `deno test --unstable-kv -A islands/todos/TodoBacklog.test.tsx`
Expected: PASS, 9 passed (4 pre-existing + 5 new).

- [ ] **Step 11: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 316 passed (311 + 5).

- [ ] **Step 12: Commit**

```bash
git add islands/todos/TodoBacklog.tsx islands/todos/TodoBacklog.test.tsx
git commit -m "feat(todos): group the backlog by urgency and add the due picker"
```

---

### Task 8: Verify end to end in the browser

**Files:**
- Verify only: `routes/todos/index.tsx` (should need **no** change — it already passes the whole ordered list to the island)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing. This task is proof.

- [ ] **Step 1: Confirm the loader needs no change**

Read `routes/todos/index.tsx`. It calls `TodoRepo.getAll(householdId)` and passes the result as `initialTodos`. Grouping happens in the island, so **no change is required**. If you find yourself wanting to group in the loader, re-read ADR 0004 — the server does not know the viewer's timezone.

- [ ] **Step 2: Confirm check and the full suite are green**

Run: `deno task check && deno task test`
Expected: both PASS, 316 passed.

- [ ] **Step 3: Start the dev server**

Use the project's preview tooling (`.claude/launch.json` has a `dev-wt` entry for worktrees). Do **not** run a dev server with a raw shell command.

- [ ] **Step 4: Walk the journey**

Confirm each, in order:

1. `/todos` renders with existing to-dos under a **No date** header (they have no `dueAt` yet).
2. Tap a row's `＋ due` chip → the picker sheet opens, pre-filled with 09:00 tomorrow.
3. Save → the row moves under **This week** (or **Later**), and the chip shows the formatted moment *including the time*.
4. Reload → the grouping, the chip and the time all survive (SSR and hydration agree).
5. Set a to-do's due moment to a time earlier today → it appears under **Overdue**, and the chip is in error colour — **not** a filled red badge.
6. Set one to later today → it appears under **Today**, chip in normal colour.
7. Tap the chip on a dated to-do → the picker opens pre-filled with that moment, not the default.
8. Tap **Remove due date** → the to-do returns to **No date** and the chip reverts to `＋ due`.
9. Tap the row **body** (not the chip) → the *edit* sheet opens, not the picker. Then tap the chip → the picker opens, not the editor. Both must work independently.
10. Tick off a dated to-do → it leaves its group and lands under **Done**.
11. Drag downward inside an open picker sheet → the list must **not** pull-to-refresh.

**Use real pointer events, not programmatic `.click()`.** During iteration 1 a synthetic click twice reported a passing focus behaviour that was actually broken — untrusted events don't run the browser's default actions.

- [ ] **Step 5: Report the result and stop the dev server**

If everything passes, report done with the observations. If anything fails, report it as a finding rather than patching past it — a failure here likely means a boundary rule in `utils/todo-due.ts` is wrong, which is a unit-test-level fix, not a UI tweak.

---

## Verification before calling this done

- [ ] `deno task check` passes
- [ ] `deno task test` passes: **316** (274 baseline + 42 new)
- [ ] The pre-existing repo ordering tests were **not modified** — only `draft()` gained `dueAt: null`
- [ ] The 11-step journey in Task 8 was walked with real pointer events, not assumed
- [ ] No file outside the File Structure table was modified

## Deliberately not built

Re-read before adding anything: notifications, reminders, recurrence (ADR 0003 — future Chores module), assignment, `completedBy`, filters, labels, a meeting/review flow, a per-household timezone or week-boundary setting, a custom MD3 date picker, and any change to `services/api.ts` (`dueAt` rides the existing DTOs).
