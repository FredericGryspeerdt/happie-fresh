# Household Shared To-dos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a household one shared backlog of to-dos it can create, read, update, delete and tick off, replacing the `ComingSoon` placeholder at `/todos`.

**Architecture:** A new household-scoped KV aggregate (`["todos", householdId, id]`) behind `TodoRepo`, four JSON API handlers, a signals-based store in `hooks/useTodos.ts`, and one island (`islands/todos/TodoBacklog.tsx`) rendering an Open section and a Done section. Layered exactly like the existing loyalty-cards module, with one addition: shared HTTP response helpers in `utils/http.ts`.

**Tech Stack:** Deno, Fresh 2 (SSR + islands), Preact, `@preact/signals`, Deno KV, Tailwind CSS v4, `@std/assert` + `preact-render-to-string` for tests.

**Spec:** [`docs/superpowers/specs/2026-08-03-household-shared-todos-design.md`](../specs/2026-08-03-household-shared-todos-design.md)
**Decisions of record:** [ADR 0001](../../adr/0001-one-household-backlog-no-todo-lists.md), [ADR 0002](../../adr/0002-completion-is-a-timestamp-not-needed-is-a-deletion.md)

## Before you start

`deno.json` sets `"nodeModulesDir": "manual"`, so a fresh worktree has no
`node_modules` and `deno check` fails on the npm imports (`@bwip-js/browser` in
`components/md3/Barcode.tsx`) before you have written a line. Run this once:

```bash
deno install
```

Baseline after that, on the commit this plan was written against: `deno task
check` passes and `deno task test` reports **196 passed, 0 failed**. If your
baseline differs, find out why before starting — don't attribute a pre-existing
failure to your own work.

## Global Constraints

- **Deno + Fresh 2.** Fresh is `jsr:@fresh/core@^2.2.0`. Routes and handlers use `define.handlers({...})` / `define.page<typeof handler>(...)` from `@/utils/index.ts`. Never `FreshContext` — the type is `Context` from `"fresh"`.
- **Imports use the `@/` alias** for project root, e.g. `import { db } from "@/database/db.ts"`. Repos are re-exported from `@/database/index.ts`; models from `@/models/index.ts`.
- **JSX is `precompile`** — write `class`, never `className`.
- **Never call `Deno.openKv()` directly.** Always `getKv()` from `@/database/db.ts`.
- **Signals in islands:** hooks create state with `signal()` at hook-body level, and the island calls the hook inside `useMemo(() => useTodos(...), [])` so the signals are created once. This is the established pattern — see `islands/dishes/DishCatalogue.tsx:21-31`. Do **not** call `signal()` directly in an island component body.
- **KV keys** are `["todos", householdId, id]`. IDs via `crypto.randomUUID()`. Timestamps are ISO strings via `new Date().toISOString()`.
- **Entity type suffix is `XxxInterface`.** Create DTO is `CreateXxxDto = Omit<XxxInterface, "id">`. Client-input DTO is `XxxInput`. Update DTO is `Partial<Omit<XxxInterface, "id" | "householdId">>`.
- **Copy is English**, warm and readable by a child. Issue #13 converts the app to Dutch in one later pass — do not translate here.
- **Commits follow Conventional Commits**: `<type>[scope]: <description>`.
- **`deno task check`** (`deno fmt --check && deno lint && deno check`) and **`deno task test`** (`deno test --unstable-kv -A`) must both pass before each commit. `--unstable-kv` is required for KV-backed tests.
- **Out of scope, do not build:** assignment, `completedBy`, filters, due dates, recurrence, labels, bulk "clear done", `createKvRepo<T>`, the `services/api/<entity>.ts` split, Dutch copy, home-screen counts, nav badges.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `models/todo/todo.interface.ts` | `TodoInterface` + three DTOs. No behaviour. |
| Create `models/todo/index.ts` | Barrel (`export *`). |
| Modify `models/index.ts` | Add the todo barrel. |
| Create `utils/http.ts` | Four JSON response helpers, shared. |
| Modify `utils/index.ts` | Re-export `http.ts`. |
| Create `database/todo.repo.ts` | KV persistence + the sort contract. |
| Create `database/todo.repo.test.ts` | Repo behaviour, including household isolation. |
| Modify `database/index.ts` | Add the repo. |
| Create `routes/api/todos/index.ts` | `GET` list, `POST` create. |
| Create `routes/api/todos/[id].ts` | `PATCH` update, `DELETE` remove. |
| Create `routes/api/todos/index.test.ts` | Handler tests: create, list, validation, 401, household isolation. |
| Create `routes/api/todos/[id].test.ts` | Handler tests: patch, tick/un-tick, 400/404, cross-household refusal. |
| Modify `services/api.ts` | Add the `todos` namespace. |
| Create `hooks/useTodos.ts` | Signals store + all four mutations. |
| Create `hooks/useTodos.test.ts` | Mutation behaviour, rollback, exit timing, blank-title guard. |
| Create `islands/todos/TodoBacklog.tsx` | The whole `/todos` UI. |
| Create `islands/todos/TodoBacklog.test.tsx` | SSR render assertions. |
| Modify `routes/todos/index.tsx` | Replace `ComingSoon` with loader + island. |

Task order follows the dependency chain: types → helpers → persistence → API → client → UI. Each task ends green and committed.

---

### Task 1: Todo model and DTOs

**Files:**
- Create: `models/todo/todo.interface.ts`
- Create: `models/todo/index.ts`
- Modify: `models/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TodoInterface`, `CreateTodoDto`, `TodoInput`, `UpdateTodoDto`, all importable from `@/models/index.ts`.

There is no test in this task — it is types only, and `deno check` is the verification. `TodoInterface` is exercised by Task 3's tests.

- [ ] **Step 1: Write the interface and DTOs**

Create `models/todo/todo.interface.ts`:

```ts
export interface TodoInterface {
  id: string;
  householdId: string;
  /** What needs doing, as the household typed it. */
  title: string;
  /** Optional detail — a phone number, a deadline someone mentioned. */
  notes?: string;
  /** userId of whoever added it. Creating requires a login, so this is a user. */
  createdBy: string;
  createdAt: string;
  /**
   * When the household actually did this, or null if it is still open. The
   * timestamp *is* the state — there is no separate `done` boolean. See
   * docs/adr/0002.
   */
  completedAt: string | null;
}

// Derived type for creation (no ID — the server mints it).
export type CreateTodoDto = Omit<TodoInterface, "id">;

/**
 * What the client sends to create a to-do. The server fills in `householdId`,
 * `createdBy`, `createdAt`, `completedAt` and `id` — the client never sends
 * (and cannot spoof) the household.
 */
export type TodoInput = Pick<TodoInterface, "title" | "notes">;

// Derived type for patch/update: never the id or householdId, everything else optional.
export type UpdateTodoDto = Partial<Omit<TodoInterface, "id" | "householdId">>;
```

- [ ] **Step 2: Add the barrel**

Create `models/todo/index.ts`:

```ts
export * from "./todo.interface.ts";
```

- [ ] **Step 3: Register in the models barrel**

In `models/index.ts`, append one line after the existing exports:

```ts
export * from "./todo/index.ts";
```

- [ ] **Step 4: Verify it type-checks and formats**

Run: `deno task check`
Expected: PASS, no output beyond the fmt/lint/check summaries.

- [ ] **Step 5: Commit**

```bash
git add models/todo models/index.ts
git commit -m "feat(todos): add Todo model and DTOs"
```

---

### Task 2: Shared HTTP response helpers

**Files:**
- Create: `utils/http.ts`
- Create: `utils/http.test.ts`
- Modify: `utils/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `json(data: unknown, status?: number): Response` — default status `200`, `Content-Type: application/json`
  - `noContent(): Response` — `204`, null body
  - `badRequest(message: string): Response` — `400`, plain text body
  - `notFound(message?: string): Response` — `404`, plain text body, default message `"Not found"`

These are the uncontroversial half of issue #51. `routes/api/cards/index.ts:14` currently defines a local `json` — leave it alone, this task does not refactor existing routes.

- [ ] **Step 1: Write the failing test**

Create `utils/http.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { badRequest, json, noContent, notFound } from "./http.ts";

Deno.test("json — serialises the body with a JSON content type and default 200", async () => {
  const res = json({ ok: true });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("json — honours an explicit status", async () => {
  const res = json({ id: "a" }, 201);
  assertEquals(res.status, 201);
  assertEquals(await res.json(), { id: "a" });
});

Deno.test("noContent — 204 with an empty body", async () => {
  const res = noContent();
  assertEquals(res.status, 204);
  assertEquals(await res.text(), "");
});

Deno.test("badRequest — 400 carrying the message", async () => {
  const res = badRequest("title required");
  assertEquals(res.status, 400);
  assertEquals(await res.text(), "title required");
});

Deno.test("notFound — 404, with a default message", async () => {
  assertEquals(notFound().status, 404);
  assertEquals(await notFound().text(), "Not found");
  assertEquals(await notFound("no such to-do").text(), "no such to-do");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A utils/http.test.ts`
Expected: FAIL — module not found, `Module not found "file:///.../utils/http.ts"`.

- [ ] **Step 3: Write minimal implementation**

Create `utils/http.ts`:

```ts
/** JSON response helpers shared by the API routes, so handlers stop repeating
 *  `new Response(JSON.stringify(x), { status, headers })`. See issue #51. */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function badRequest(message: string): Response {
  return new Response(message, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return new Response(message, { status: 404 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A utils/http.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 5: Register in the utils barrel**

In `utils/index.ts`, append:

```ts
export * from "./http.ts";
```

- [ ] **Step 6: Verify the whole suite and check still pass**

Run: `deno task check && deno task test`
Expected: both PASS. The barrel addition must not collide with an existing export name — if `deno check` reports a duplicate export, stop and report it rather than renaming a public helper.

- [ ] **Step 7: Commit**

```bash
git add utils/http.ts utils/http.test.ts utils/index.ts
git commit -m "feat(api): add shared JSON response helpers"
```

---

### Task 3: TodoRepo

**Files:**
- Create: `database/todo.repo.ts`
- Create: `database/todo.repo.test.ts`
- Modify: `database/index.ts`

**Interfaces:**
- Consumes: `TodoInterface`, `CreateTodoDto`, `UpdateTodoDto` from `@/models/index.ts` (Task 1); `getKv` from `./db.ts`; `mergeDefinedPatch` from `./merge-patch.ts`.
- Produces `TodoRepo` with static methods:
  - `create(data: CreateTodoDto): Promise<TodoInterface>`
  - `getAll(householdId: string): Promise<TodoInterface[]>` — **sorted**: open first by `createdAt` descending, then done by `completedAt` descending
  - `getById(householdId: string, id: string): Promise<TodoInterface | null>`
  - `update(householdId: string, id: string, patch: UpdateTodoDto): Promise<TodoInterface | null>`
  - `delete(householdId: string, id: string): Promise<void>`

Note `create` takes the DTO **alone** — `CreateTodoDto` already carries `householdId`, exactly as `LoyaltyCardRepo.create` does (`database/loyalty-card.repo.ts:15`). Every other method takes `householdId` first.

- [ ] **Step 1: Write the failing tests**

Create `database/todo.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { TodoRepo } from "@/database/todo.repo.ts";
import type { CreateTodoDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use (inside a repo method), and no repo method is called until a test
// body runs — so setting it here at module load is early enough. Each test uses
// a distinct householdId because the process-wide KV singleton is shared.
Deno.env.set("KV_PATH", ":memory:");

// sanitizeResources is disabled because getKv() opens a module-level KV
// singleton lazily on first use and never closes it (by design — it's meant
// to live for the process's lifetime, same as in production). Deno's default
// resource sanitizer would otherwise flag that singleton as "leaked" from
// whichever test happens to open it first.

function draft(
  householdId: string,
  title: string,
  overrides: Partial<CreateTodoDto> = {},
): CreateTodoDto {
  return {
    householdId,
    title,
    createdBy: "user-1",
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

Deno.test({
  name: "create — mints an id and stores the to-do open",
  sanitizeResources: false,
  async fn() {
    const todo = await TodoRepo.create(draft("hh-create", "Take out the bins"));

    assertEquals(todo.title, "Take out the bins");
    assertEquals(todo.completedAt, null);
    assertEquals(typeof todo.id, "string");
    assertEquals(todo.id.length > 0, true);

    const found = await TodoRepo.getById("hh-create", todo.id);
    assertEquals(found?.id, todo.id);
  },
});

Deno.test({
  name: "getAll — open to-dos come first, newest first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-open";
    await TodoRepo.create(draft(hh, "oldest", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "newest", {
      createdAt: "2026-08-03T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "middle", {
      createdAt: "2026-08-02T10:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), ["newest", "middle", "oldest"]);
  },
});

Deno.test({
  name: "getAll — done to-dos sort after open ones, most recently done first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-done";
    await TodoRepo.create(draft(hh, "still open", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "done earlier", {
      createdAt: "2026-08-02T10:00:00.000Z",
      completedAt: "2026-08-02T12:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "done later", {
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: "2026-08-03T12:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), [
      "still open",
      "done later",
      "done earlier",
    ]);
  },
});

Deno.test({
  name: "getById — returns null for an unknown id",
  sanitizeResources: false,
  async fn() {
    assertEquals(await TodoRepo.getById("hh-missing", "nope"), null);
  },
});

Deno.test({
  name: "update — a partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-update";
    const todo = await TodoRepo.create(
      draft(hh, "Call the dentist", { notes: "09 123 45 67" }),
    );

    const updated = await TodoRepo.update(hh, todo.id, {
      completedAt: "2026-08-03T09:00:00.000Z",
    });

    assertEquals(updated?.completedAt, "2026-08-03T09:00:00.000Z");
    assertEquals(updated?.title, "Call the dentist");
    assertEquals(updated?.notes, "09 123 45 67");
    assertEquals(updated?.createdBy, "user-1");
  },
});

Deno.test({
  name: "update — un-ticking writes completedAt back to null",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-untick";
    const todo = await TodoRepo.create(
      draft(hh, "Pay the water bill", {
        completedAt: "2026-08-03T09:00:00.000Z",
      }),
    );

    const updated = await TodoRepo.update(hh, todo.id, { completedAt: null });

    assertEquals(updated?.completedAt, null);
  },
});

Deno.test({
  name: "update — returns null for an unknown id",
  sanitizeResources: false,
  async fn() {
    assertEquals(
      await TodoRepo.update("hh-update-missing", "nope", { title: "x" }),
      null,
    );
  },
});

Deno.test({
  name: "delete — removes the to-do",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-delete";
    const todo = await TodoRepo.create(draft(hh, "Cancel the newspaper"));

    await TodoRepo.delete(hh, todo.id);

    assertEquals(await TodoRepo.getById(hh, todo.id), null);
    assertEquals(await TodoRepo.getAll(hh), []);
  },
});

Deno.test({
  name: "households are isolated — one never reads another's to-dos",
  sanitizeResources: false,
  async fn() {
    const mine = await TodoRepo.create(draft("hh-mine", "Mine"));
    await TodoRepo.create(draft("hh-theirs", "Theirs"));

    assertEquals((await TodoRepo.getAll("hh-mine")).map((t) => t.title), [
      "Mine",
    ]);
    assertEquals(await TodoRepo.getById("hh-theirs", mine.id), null);
    assertEquals(await TodoRepo.update("hh-theirs", mine.id, { title: "x" }), null);
  },
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A database/todo.repo.test.ts`
Expected: FAIL — module not found, `Module not found "file:///.../database/todo.repo.ts"`.

- [ ] **Step 3: Write the implementation**

Create `database/todo.repo.ts`:

```ts
import type {
  CreateTodoDto,
  TodoInterface,
  UpdateTodoDto,
} from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

/**
 * To-dos are shared within a household. Keys are scoped by household so a
 * member only ever reads or writes their own household's to-dos
 * (`["todos", householdId, id]`), mirroring `LoyaltyCardRepo`. A household has
 * exactly one backlog — there is no to-do list aggregate (see docs/adr/0001).
 */
export class TodoRepo {
  static async create(data: CreateTodoDto): Promise<TodoInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const todo: TodoInterface = { ...data, id };
    await kv.set(["todos", data.householdId, id], todo);
    return todo;
  }

  /**
   * Every consumer gets the same order, so the SSR render and the hydrated view
   * agree and the island only has to find the partition point: open to-dos
   * first (newest created first), then done ones (most recently done first).
   */
  static async getAll(householdId: string): Promise<TodoInterface[]> {
    const kv = await getKv();
    const iter = kv.list<TodoInterface>({ prefix: ["todos", householdId] });
    const todos: TodoInterface[] = [];
    for await (const { value } of iter) todos.push(value);

    return todos.sort((a, b) => {
      if (a.completedAt === null && b.completedAt === null) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (a.completedAt === null) return -1;
      if (b.completedAt === null) return 1;
      return b.completedAt.localeCompare(a.completedAt);
    });
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<TodoInterface | null> {
    const kv = await getKv();
    const result = await kv.get<TodoInterface>(["todos", householdId, id]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateTodoDto,
  ): Promise<TodoInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<TodoInterface>(existing, patch);
    await kv.set(["todos", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["todos", householdId, id]);
  }
}
```

`mergeDefinedPatch` skips only `undefined`, not `null` (`database/merge-patch.ts:16`), which is exactly why `{ completedAt: null }` un-ticks correctly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A database/todo.repo.test.ts`
Expected: PASS, 9 passed.

- [ ] **Step 5: Register in the database barrel**

In `database/index.ts`, append:

```ts
export * from "./todo.repo.ts";
```

- [ ] **Step 6: Verify the whole suite and check**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add database/todo.repo.ts database/todo.repo.test.ts database/index.ts
git commit -m "feat(todos): add household-scoped TodoRepo"
```

---

### Task 4: API routes

**Files:**
- Create: `routes/api/todos/index.ts`
- Create: `routes/api/todos/[id].ts`
- Create: `routes/api/todos/index.test.ts`
- Create: `routes/api/todos/[id].test.ts`

**Interfaces:**
- Consumes: `TodoRepo` from `@/database/index.ts` (Task 3); `json`, `noContent`, `badRequest`, `notFound` from `@/utils/index.ts` (Task 2); `define` from `@/utils/index.ts`.
- Produces the wire contract Task 5 consumes:
  - `GET /api/todos` → `200` `TodoInterface[]`
  - `POST /api/todos`, body `{ title, notes? }` → `201` `TodoInterface`; `400` when title is blank
  - `PATCH /api/todos/:id`, body any subset of `{ title, notes, completedAt }` → `200` `TodoInterface`; `400` when title is present but blank; `404` when absent
  - `DELETE /api/todos/:id` → `204`; `404` when absent

Unauthenticated `/api/*` requests already 401 in middleware (`routes/_middleware.ts:44`), so handlers do not repeat that. They **do** guard on `ctx.state.householdId` being present, because the type is optional.

**Handler tests are a house pattern.** `routes/api/cards/index.test.ts` calls the exported `handler.GET` / `handler.POST` directly with a hand-built fake `Context` and an in-memory KV. Follow it exactly. For the `[id]` route the fake context must also carry `params`, since the handler reads `ctx.params.id`.

- [ ] **Step 1: Write the failing tests**

Create `routes/api/todos/index.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/todos/index.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
}

function ctx(req: Request, state: State = {}): Context<State> {
  return { req, state } as unknown as Context<State>;
}

async function clearTodos() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["todos"] })) {
    await kv.delete(e.key);
  }
}

const AUTH: State = { userId: "u1", householdId: "h1" };

const post = (body: unknown) =>
  new Request("http://x/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST creates an open to-do (201); GET lists it for the household",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const createRes = await handler.POST(
      ctx(post({ title: "Take out the bins" }), AUTH),
    );
    assertEquals(createRes.status, 201);
    const created = await createRes.json();
    assertEquals(created.title, "Take out the bins");
    assertEquals(created.householdId, "h1");
    assertEquals(created.createdBy, "u1");
    assertEquals(created.completedAt, null);

    const listRes = await handler.GET(
      ctx(new Request("http://x/api/todos"), AUTH),
    );
    assertEquals(listRes.status, 200);
    const list = await listRes.json();
    assertEquals(list.map((t: { title: string }) => t.title), [
      "Take out the bins",
    ]);
  },
});

Deno.test({
  name: "POST trims the title and omits blank notes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const created = await (await handler.POST(
      ctx(post({ title: "  Call the dentist  ", notes: "   " }), AUTH),
    )).json();
    assertEquals(created.title, "Call the dentist");
    assertEquals(created.notes, undefined);
  },
});

Deno.test({
  name: "POST keeps notes when given",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const created = await (await handler.POST(
      ctx(post({ title: "Call the dentist", notes: "09 123 45 67" }), AUTH),
    )).json();
    assertEquals(created.notes, "09 123 45 67");
  },
});

Deno.test({
  name: "POST rejects a blank title (400)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.POST(ctx(post({ title: "   " }), AUTH))).status,
      400,
    );
    assertEquals((await handler.POST(ctx(post({}), AUTH))).status, 400);
  },
});

Deno.test({
  name: "GET and POST require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.GET(ctx(new Request("http://x/api/todos")))).status,
      401,
    );
    assertEquals(
      (await handler.POST(ctx(post({ title: "x" })))).status,
      401,
    );
  },
});

Deno.test({
  name: "GET does not leak another household's to-dos",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    await handler.POST(
      ctx(post({ title: "Theirs" }), { userId: "u2", householdId: "h2" }),
    );
    const list = await (await handler.GET(
      ctx(new Request("http://x/api/todos"), AUTH),
    )).json();
    assertEquals(list, []);
  },
});
```

Create `routes/api/todos/[id].test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/todos/[id].ts";
import { TodoRepo } from "@/database/todo.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
}

function ctx(req: Request, id: string, state: State = {}): Context<State> {
  return { req, state, params: { id } } as unknown as Context<State>;
}

async function clearTodos() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["todos"] })) {
    await kv.delete(e.key);
  }
}

const AUTH: State = { userId: "u1", householdId: "h1" };

const patch = (body: unknown) =>
  new Request("http://x/api/todos/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = () => new Request("http://x/api/todos/x", { method: "DELETE" });

function seed(householdId = "h1", title = "Take out the bins") {
  return TodoRepo.create({
    householdId,
    title,
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
    completedAt: null,
  });
}

Deno.test({
  name: "PATCH updates the title",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ title: "  Take out the recycling  " }), todo.id, AUTH),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).title, "Take out the recycling");
  },
});

Deno.test({
  name: "PATCH ticks off and un-ticks via completedAt",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();

    const ticked = await (await handler.PATCH(
      ctx(patch({ completedAt: "2026-08-03T12:00:00.000Z" }), todo.id, AUTH),
    )).json();
    assertEquals(ticked.completedAt, "2026-08-03T12:00:00.000Z");

    const reopened = await (await handler.PATCH(
      ctx(patch({ completedAt: null }), todo.id, AUTH),
    )).json();
    assertEquals(reopened.completedAt, null);
  },
});

Deno.test({
  name: "PATCH can clear notes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await TodoRepo.create({
      householdId: "h1",
      title: "Call the dentist",
      notes: "09 123 45 67",
      createdBy: "u1",
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: null,
    });

    const cleared = await (await handler.PATCH(
      ctx(patch({ notes: "" }), todo.id, AUTH),
    )).json();
    assertEquals(cleared.notes, "");
  },
});

Deno.test({
  name: "PATCH rejects a blank title (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "  " }), todo.id, AUTH))).status,
      400,
    );
    const still = await TodoRepo.getById("h1", todo.id);
    assertEquals(still?.title, "Take out the bins");
  },
});

Deno.test({
  name: "PATCH ignores client-supplied createdBy and createdAt",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const updated = await (await handler.PATCH(
      ctx(
        patch({ createdBy: "hacker", createdAt: "1999-01-01T00:00:00.000Z" }),
        todo.id,
        AUTH,
      ),
    )).json();
    assertEquals(updated.createdBy, "u1");
    assertEquals(updated.createdAt, "2026-08-03T10:00:00.000Z");
  },
});

Deno.test({
  name: "PATCH on an unknown id is 404",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), "nope", AUTH))).status,
      404,
    );
  },
});

Deno.test({
  name: "DELETE removes the to-do (204), then 404",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals((await handler.DELETE(ctx(del(), todo.id, AUTH))).status, 204);
    assertEquals((await handler.DELETE(ctx(del(), todo.id, AUTH))).status, 404);
    assertEquals(await TodoRepo.getById("h1", todo.id), null);
  },
});

Deno.test({
  name: "another household cannot patch or delete your to-do",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const theirs: State = { userId: "u2", householdId: "h2" };

    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), todo.id, theirs))).status,
      404,
    );
    assertEquals(
      (await handler.DELETE(ctx(del(), todo.id, theirs))).status,
      404,
    );
    assertEquals((await TodoRepo.getById("h1", todo.id))?.title, "Take out the bins");
  },
});

Deno.test({
  name: "PATCH and DELETE require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), "any"))).status,
      401,
    );
    assertEquals((await handler.DELETE(ctx(del(), "any"))).status, 401);
  },
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A routes/api/todos/`
Expected: FAIL — module not found for `routes/api/todos/index.ts` and `routes/api/todos/[id].ts`.

- [ ] **Step 3: Write the collection route**

Create `routes/api/todos/index.ts`:

```ts
import { badRequest, define, json } from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await TodoRepo.getAll(householdId));
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await ctx.req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return badRequest("title required");
    const rawNotes = String(body.notes ?? "").trim();

    const todo = await TodoRepo.create({
      householdId,
      title,
      notes: rawNotes || undefined,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    return json(todo, 201);
  },
});
```

- [ ] **Step 4: Write the item route**

Create `routes/api/todos/[id].ts`. The `PATCH` handler picks only the three client-writable fields off the body, so a client cannot patch `createdBy` or `createdAt` even though `UpdateTodoDto` permits them:

```ts
import { badRequest, define, json, noContent, notFound } from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";
import type { UpdateTodoDto } from "@/models/index.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const body = await ctx.req.json();
    const patch: UpdateTodoDto = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return badRequest("title required");
      patch.title = title;
    }
    if (body.notes !== undefined) {
      // Empty string, not undefined: mergeDefinedPatch skips undefined, so
      // `undefined` here would silently leave an existing note in place and
      // clearing notes in the UI would appear to fail.
      patch.notes = String(body.notes).trim();
    }
    if (body.completedAt !== undefined) {
      patch.completedAt = body.completedAt === null
        ? null
        : String(body.completedAt);
    }

    const updated = await TodoRepo.update(householdId, ctx.params.id, patch);
    if (!updated) return notFound("no such to-do");
    return json(updated);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const existing = await TodoRepo.getById(householdId, ctx.params.id);
    if (!existing) return notFound("no such to-do");

    await TodoRepo.delete(householdId, existing.id);
    return noContent();
  },
});
```

Note `DELETE` reads before deleting so a wrong or other-household id returns `404` rather than a misleading `204` — `kv.delete` on a missing key succeeds silently.

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/todos/`
Expected: PASS, 15 passed (6 in `index.test.ts`, 9 in `[id].test.ts`).

- [ ] **Step 6: Verify the whole suite and check**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add routes/api/todos
git commit -m "feat(todos): add to-do API routes"
```

---

### Task 5: API client namespace

**Files:**
- Modify: `services/api.ts`

**Interfaces:**
- Consumes: the wire contract from Task 4; `TodoInput`, `TodoInterface`, `UpdateTodoDto` from `@/models/index.ts`.
- Produces `api.todos`:
  - `getAll(): Promise<TodoInterface[]>` — `[]` on failure
  - `create(input: TodoInput): Promise<TodoInterface | null>` — `null` on failure
  - `update(id: string, patch: UpdateTodoDto): Promise<TodoInterface | null>` — `null` on failure
  - `delete(id: string): Promise<boolean>` — `true` on success

Every method follows the `api` error boundary: never throw, return `null` / `[]` / `false` so the caller can roll back and snackbar. `delete` returns a `boolean` rather than `void` (unlike `api.cards.delete`) because Task 6 needs to know whether to roll the optimistic removal back.

Do **not** start the `services/api/<entity>.ts` split — that is issue #51, done all at once.

- [ ] **Step 1: Add the types to the existing import**

In `services/api.ts`, add a new import line beside the existing model imports at the top:

```ts
import { TodoInput, TodoInterface, UpdateTodoDto } from "@/models/index.ts";
```

- [ ] **Step 2: Add the namespace**

In `services/api.ts`, add a `todos` namespace inside the `api` object, after the `cards` namespace and before `dishTagGroups`:

```ts
  todos: {
    getAll: async (): Promise<TodoInterface[]> => {
      const res = await fetch("/api/todos");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (input: TodoInput): Promise<TodoInterface | null> => {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return res.json();
    },
    update: async (
      id: string,
      patch: UpdateTodoDto,
    ): Promise<TodoInterface | null> => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<boolean> => {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      return res.ok;
    },
  },
```

- [ ] **Step 3: Verify check passes**

Run: `deno task check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api.ts
git commit -m "feat(todos): add todos API client namespace"
```

---

### Task 6: useTodos store

**Files:**
- Create: `hooks/useTodos.ts`
- Create: `hooks/useTodos.test.ts`

**Interfaces:**
- Consumes: `api.todos` (Task 5); `TodoInterface`, `TodoInput` from `@/models/index.ts`; `createDebouncedMergeScheduler` from `@/utils/debounce-update.ts`; `beginBusy` / `endBusy` from `@/utils/loading.ts`.
- Produces `useTodos(initialTodos: TodoInterface[])` returning:
  - `openTodos: Signal<TodoInterface[]>`
  - `doneTodos: Signal<TodoInterface[]>`
  - `exitingIds: Signal<string[]>`
  - `pendingCount: Signal<number>`
  - `addTodo(input: TodoInput): Promise<TodoInterface | null>`
  - `editTodo(id: string, patch: { title?: string; notes?: string }): void`
  - `flushTodo(id: string): void`
  - `tickOff(id: string): Promise<boolean>`
  - `unTick(id: string): Promise<boolean>`
  - `removeTodo(id: string): Promise<boolean>`
  - `refresh(): Promise<void>`

**Two things to know before writing this.**

**§6 exit animations.** `docs/ui-ux-patterns.md` §6 requires that a row leaving a list is marked "exiting", waits ~300ms for the CSS transition, and *then* leaves state. `useShoppingList` implements exactly this in `removeListItem` (`hooks/useShoppingList.ts:129`) and `checkItem` (`:147`) via an `exitingItems` signal — and note `uncheckItem` (`:171`) deliberately has **no** animation. Mirror that asymmetry: `tickOff` and `removeTodo` animate, `unTick` does not.

Be aware `useShoppingList` returns `exitingItems` but `islands/items.tsx` never consumes it, so there is **no existing CSS class** for an exiting row. Task 7 renders it with an inline transition; don't go hunting for a class.

**Hook tests do exist.** `hooks/useShoppingList.test.ts` calls the hook directly and drives timers with `FakeTime` and `stub` from `jsr:@std/testing@^1.0.18`. Follow it.

- [ ] **Step 1: Write the failing tests**

Create `hooks/useTodos.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { api } from "@/services/api.ts";
import { useTodos } from "@/hooks/useTodos.ts";
import type { TodoInterface } from "@/models/index.ts";

function makeTodo(over: Partial<TodoInterface> = {}): TodoInterface {
  return {
    id: "t1",
    householdId: "hh",
    title: "Take out the bins",
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
    completedAt: null,
    ...over,
  };
}

Deno.test("useTodos — splits the initial to-dos into open and done", () => {
  const hook = useTodos([
    makeTodo({ id: "t1" }),
    makeTodo({ id: "t2", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
  assertEquals(hook.doneTodos.value.map((t) => t.id), ["t2"]);
});

Deno.test("tickOff — moves the to-do into done with a completedAt", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.openTodos.value, []);
  assertEquals(hook.doneTodos.value.length, 1);
  assertEquals(hook.doneTodos.value[0].id, "t1");
  assertEquals(hook.doneTodos.value[0].completedAt !== null, true);
});

Deno.test("tickOff — the to-do is in exitingIds during the 300ms animation", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");

  assertEquals(hook.exitingIds.value.includes("t1"), true);

  await time.tickAsync(300);
  await promise;

  assertEquals(hook.exitingIds.value.includes("t1"), false);
});

Deno.test("tickOff — rolls back and reports failure when the server rejects", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(null),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");
  await time.tickAsync(300);
  const ok = await promise;

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
  assertEquals(hook.doneTodos.value, []);
});

Deno.test("unTick — moves the to-do back to open with a null completedAt", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  const ok = await hook.unTick("t1");

  assertEquals(ok, true);
  assertEquals(hook.doneTodos.value, []);
  assertEquals(hook.openTodos.value.length, 1);
  assertEquals(hook.openTodos.value[0].completedAt, null);
});

Deno.test("removeTodo — removes the to-do and cancels a pending edit", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  using _d = stub(api.todos, "delete", (_id: string) => Promise.resolve(true));
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "Changed my mind" }); // schedules a 500ms write
  const promise = hook.removeTodo("t1");
  await time.tickAsync(300); // exit animation
  const ok = await promise;
  await time.tickAsync(1000); // the cancelled write must never fire

  assertEquals(ok, true);
  assertEquals(patches, []);
  assertEquals(hook.openTodos.value, []);
});

Deno.test("removeTodo — restores the to-do when the delete fails", async () => {
  using _d = stub(api.todos, "delete", (_id: string) => Promise.resolve(false));
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.removeTodo("t1");
  await time.tickAsync(300);
  const ok = await promise;

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
});

Deno.test("editTodo — echoes locally but never persists a blank title", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "   " });
  await time.tickAsync(600);

  assertEquals(patches, []); // nothing written
  assertEquals(hook.openTodos.value[0].title, "   "); // local echo only
});

Deno.test("editTodo — persists a non-blank title after the debounce", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "Take out the recycling" });
  await time.tickAsync(600);

  assertEquals(patches, [{ title: "Take out the recycling" }]);
  assertEquals(hook.openTodos.value[0].title, "Take out the recycling");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --unstable-kv -A hooks/useTodos.test.ts`
Expected: FAIL — module not found, `Module not found "file:///.../hooks/useTodos.ts"`.

- [ ] **Step 3: Write the hook**

Create `hooks/useTodos.ts`:

```ts
import { signal } from "@preact/signals";
import type { TodoInput, TodoInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

type TodoEdit = { title?: string; notes?: string };

/**
 * Reactive store for a household's backlog. Follows the app's mutation
 * conventions: creates are **pessimistic** (the server mints the id, so we wait
 * for the returned to-do), edits are **optimistic and debounced**, and ticking
 * off and deleting are **optimistic with rollback**. The `api` boundary never
 * throws, so every mutation reports failure by return value and the island
 * surfaces a snackbar.
 *
 * Call this inside `useMemo(() => useTodos(initial), [])` so the signals are
 * created once — see `islands/todos/TodoBacklog.tsx`.
 */
export function useTodos(initialTodos: TodoInterface[]) {
  const initial = initialTodos ?? [];
  // TodoRepo.getAll already returns open before done, so this is a partition.
  const openTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt === null),
  );
  const doneTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt !== null),
  );
  const pendingCount = signal(0);
  /** Ids mid-exit-animation — the island fades these out (patterns doc §6). */
  const exitingIds = signal<string[]>([]);

  const EXIT_MS = 300; // keep in sync with the row transition in TodoBacklog.tsx

  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const findAnywhere = (id: string): TodoInterface | undefined =>
    openTodos.value.find((t) => t.id === id) ??
      doneTodos.value.find((t) => t.id === id);

  /** Debounced title/notes writes, merged per to-do (500ms default). */
  const scheduler = createDebouncedMergeScheduler<TodoEdit>({
    flush: async (id, patch) => {
      // Never persist a blank title — the sheet's field can be emptied
      // mid-typing, and the last non-empty value is what the user meant.
      if (patch.title !== undefined && !patch.title.trim()) return;
      startPending();
      try {
        await api.todos.update(id, patch);
      } finally {
        endPending();
      }
    },
  });

  const addTodo = async (input: TodoInput): Promise<TodoInterface | null> => {
    startPending();
    try {
      const created = await api.todos.create(input);
      if (created) openTodos.value = [created, ...openTodos.value];
      return created;
    } finally {
      endPending();
    }
  };

  /** Optimistic local edit; the write is debounced and merged. */
  const editTodo = (id: string, patch: TodoEdit): void => {
    const apply = (list: TodoInterface[]) =>
      list.map((t) => (t.id === id ? { ...t, ...patch } : t));
    if (openTodos.value.some((t) => t.id === id)) {
      openTodos.value = apply(openTodos.value);
    } else {
      doneTodos.value = apply(doneTodos.value);
    }
    scheduler.schedule(id, patch);
  };

  /** Persist a pending edit immediately — call when the edit sheet closes. */
  const flushTodo = (id: string): void => scheduler.flush(id);

  const tickOff = async (id: string): Promise<boolean> => {
    const todo = openTodos.value.find((t) => t.id === id);
    if (!todo) return false;

    // §6: keep the row on screen for the transition, then move it.
    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    // Snapshot after the wait — state may have changed during the animation.
    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const completedAt = new Date().toISOString();
    const ticked = { ...todo, completedAt };

    openTodos.value = openTodos.value.filter((t) => t.id !== id);
    doneTodos.value = [ticked, ...doneTodos.value];
    exitingIds.value = exitingIds.value.filter((x) => x !== id);

    // Deliberately does NOT cancel pending edits, unlike useShoppingList's
    // checkItem: a queued title patch still targets a live record, and both
    // patches go through mergeDefinedPatch, so neither clobbers the other.
    startPending();
    try {
      const saved = await api.todos.update(id, { completedAt });
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

  const unTick = async (id: string): Promise<boolean> => {
    const todo = doneTodos.value.find((t) => t.id === id);
    if (!todo) return false;
    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const reopened = { ...todo, completedAt: null };

    doneTodos.value = doneTodos.value.filter((t) => t.id !== id);
    openTodos.value = [reopened, ...openTodos.value];

    startPending();
    try {
      const saved = await api.todos.update(id, { completedAt: null });
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

  const removeTodo = async (id: string): Promise<boolean> => {
    if (!findAnywhere(id)) return false;

    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;

    // Drop any pending debounced edit first, or a late flush would PATCH a
    // to-do we just deleted (the hazard clearCheckedItems guards against in
    // hooks/useShoppingList.ts:195).
    scheduler.cancel(id);
    openTodos.value = openTodos.value.filter((t) => t.id !== id);
    doneTodos.value = doneTodos.value.filter((t) => t.id !== id);
    exitingIds.value = exitingIds.value.filter((x) => x !== id);

    startPending();
    try {
      const ok = await api.todos.delete(id);
      if (!ok) {
        openTodos.value = openSnapshot;
        doneTodos.value = doneSnapshot;
      }
      return ok;
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    // Pull-to-refresh renders its own spinner, so this intentionally tracks
    // pendingCount without driving the global loading bar (beginBusy/endBusy).
    pendingCount.value++;
    try {
      const all = await api.todos.getAll();
      openTodos.value = all.filter((t) => t.completedAt === null);
      doneTodos.value = all.filter((t) => t.completedAt !== null);
    } finally {
      pendingCount.value--;
    }
  };

  return {
    openTodos,
    doneTodos,
    exitingIds,
    pendingCount,
    addTodo,
    editTodo,
    flushTodo,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A hooks/useTodos.test.ts`
Expected: PASS, 9 passed.

- [ ] **Step 5: Verify the whole suite and check**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add hooks/useTodos.ts hooks/useTodos.test.ts
git commit -m "feat(todos): add useTodos store"
```

---

### Task 7: TodoBacklog island

**Files:**
- Create: `islands/todos/TodoBacklog.tsx`
- Create: `islands/todos/TodoBacklog.test.tsx`

**Interfaces:**
- Consumes: `useTodos` (Task 6); `TodoInterface` from `@/models/index.ts`; `Sheet`, `Button`, `RoundCheck`, `Icon`, `Snackbar`, `PullToRefresh`, `Pressable` from `@/components/md3/*`; `Fab` from `@/islands/shell/Fab.tsx`.
- Produces: default-exported `TodoBacklog({ initialTodos }: { initialTodos: TodoInterface[] })`, consumed by Task 8.

Copy strings the test asserts on, so keep them exact: FAB label `"New to-do"`, create sheet title `"New to-do"`, empty-state title `"Nothing to do"`, done heading `"Done"`, delete confirmation title `"Delete this to-do?"`.

- [ ] **Step 1: Write the failing test**

Create `islands/todos/TodoBacklog.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/todos/TodoBacklog.test.tsx`
Expected: FAIL — module not found, `Module not found "file:///.../islands/todos/TodoBacklog.tsx"`.

- [ ] **Step 3: Write the island**

Create `islands/todos/TodoBacklog.tsx`:

```tsx
import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { TodoInterface } from "@/models/index.ts";
import { useTodos } from "@/hooks/useTodos.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import Fab from "@/islands/shell/Fab.tsx";

interface Props {
  initialTodos: TodoInterface[];
}

export default function TodoBacklog({ initialTodos }: Props) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    openTodos,
    doneTodos,
    exitingIds,
    addTodo,
    editTodo,
    flushTodo,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  } = useMemo(() => useTodos(initialTodos), []);

  const createOpen = useSignal(false);
  const newTitle = useSignal("");
  const newNotes = useSignal("");
  const editingId = useSignal<string | null>(null);
  const confirmingId = useSignal<string | null>(null);
  const snack = useSignal<{ msg: string } | null>(null);

  const open = openTodos.value;
  const done = doneTodos.value;
  const exiting = exitingIds.value;

  const editing = () =>
    open.find((t) => t.id === editingId.value) ??
      done.find((t) => t.id === editingId.value);

  const say = (msg: string) => {
    snack.value = { msg };
    setTimeout(() => (snack.value = null), 4000);
  };

  const submitNew = async () => {
    const title = newTitle.value.trim();
    if (!title) return;
    const notes = newNotes.value.trim();
    const created = await addTodo({ title, notes: notes || undefined });
    if (!created) {
      say("Couldn't add that to-do. Try again?");
      return;
    }
    // Keep the sheet open and the field focused so several to-dos can be
    // captured in a row without the mobile keyboard dismissing.
    newTitle.value = "";
    newNotes.value = "";
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushTodo(id);
    editingId.value = null;
  };

  // The 300ms here must match EXIT_MS in useTodos (patterns doc §6).
  const row = (t: TodoInterface, isDone: boolean) => (
    <div
      key={t.id}
      class="flex items-start gap-3 px-1 py-2.5"
      style={{
        opacity: exiting.includes(t.id) ? 0 : 1,
        transform: exiting.includes(t.id)
          ? "translateX(12px)"
          : "translateX(0)",
        transition:
          "opacity .3s var(--md-emphasized), transform .3s var(--md-emphasized)",
      }}
    >
      <Pressable
        onClick={async () => {
          const ok = isDone ? await unTick(t.id) : await tickOff(t.id);
          if (!ok) say("That didn't save. Try again?");
        }}
        aria-label={isDone ? `Reopen ${t.title}` : `Tick off ${t.title}`}
        class="pt-0.5"
      >
        <RoundCheck checked={isDone} />
      </Pressable>
      <Pressable
        onClick={() => (editingId.value = t.id)}
        class="flex-1 min-w-0 text-left"
      >
        <div
          class={`md-body-large ${
            isDone ? "text-on-surface-variant line-through" : "text-on-surface"
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
    </div>
  );

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {open.length === 0 && done.length === 0
          ? (
            <div class="flex flex-col items-center text-center gap-4 pt-12 px-7">
              <div
                class="grid place-items-center bg-primary-container text-on-primary-container"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "var(--md-shape-xl)",
                }}
              >
                <Icon name="checklist" size={44} />
              </div>
              <div class="md-headline-small text-on-surface">Nothing to do</div>
              <div
                class="md-body-medium text-on-surface-variant"
                style={{ maxWidth: 280 }}
              >
                When something needs doing around the house, add it here so
                everyone can see it.
              </div>
            </div>
          )
          : (
            <>
              {open.length > 0 && (
                <div class="flex flex-col">
                  {open.map((t) => row(t, false))}
                </div>
              )}

              {done.length > 0 && (
                <div class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    Done
                  </div>
                  {done.map((t) => row(t, true))}
                </div>
              )}
            </>
          )}
      </div>

      {/* New-to-do FAB — shared component, fixed below the nav chrome */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="New to-do"
          aria-label="New to-do"
          onClick={() => {
            newTitle.value = "";
            newNotes.value = "";
            createOpen.value = true;
          }}
        />
      </div>

      {/* Create sheet — stays open between saves for rapid capture.
          Body gated on createOpen: <Sheet> renders its children even when
          closed (see islands/items.tsx:442), so an ungated `autofocus` would
          steal focus and raise the mobile keyboard on page load. Gating also
          means `autofocus` fires on mount, i.e. exactly when the sheet opens. */}
      <Sheet
        open={createOpen.value}
        onClose={() => (createOpen.value = false)}
        title="New to-do"
      >
        {createOpen.value && (
          <div class="flex flex-col gap-3 pb-1">
            <input
              autofocus
              value={newTitle.value}
              onInput={(e) => (newTitle.value = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNew();
                }
              }}
              placeholder="What needs doing?"
              aria-label="What needs doing?"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
            />
            <textarea
              value={newNotes.value}
              onInput={(e) => (newNotes.value = e.currentTarget.value)}
              rows={2}
              placeholder="Notes (optional)"
              aria-label="Notes (optional)"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
            />
            <Button variant="filled" full onClick={submitNew}>Add</Button>
            {/* "Close", not "Done" — "Done" beside "Add" reads as a second
                save, and the Done *section* heading must stay unambiguous. */}
            <Button
              variant="text"
              full
              onClick={() => (createOpen.value = false)}
            >
              Close
            </Button>
          </div>
        )}
      </Sheet>

      {/* Edit sheet */}
      <Sheet
        open={editingId.value !== null}
        onClose={closeEditor}
        title="Edit to-do"
      >
        {(() => {
          const t = editing();
          if (!t) return null;
          return (
            <div class="flex flex-col gap-3 pb-1">
              <input
                value={t.title}
                onInput={(e) =>
                  editTodo(t.id, { title: e.currentTarget.value })}
                aria-label="Title"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
              />
              <textarea
                value={t.notes ?? ""}
                onInput={(e) =>
                  editTodo(t.id, { notes: e.currentTarget.value })}
                rows={2}
                placeholder="Notes (optional)"
                aria-label="Notes"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
              />
              <Button variant="filled" full onClick={closeEditor}>Done</Button>
              <Button
                variant="error"
                full
                onClick={() => {
                  const id = t.id;
                  closeEditor();
                  confirmingId.value = id;
                }}
              >
                Delete
              </Button>
            </div>
          );
        })()}
      </Sheet>

      {/* Delete confirmation — the house pattern is a sheet, not a dialog */}
      <Sheet
        open={confirmingId.value !== null}
        onClose={() => (confirmingId.value = null)}
        title="Delete this to-do?"
      >
        <div class="flex flex-col gap-3 pb-1">
          <div class="md-body-medium text-on-surface-variant">
            This removes it for everyone. Use it when the to-do never needed
            doing — ticking it off is how you say it's done.
          </div>
          <Button
            variant="error"
            full
            onClick={async () => {
              const id = confirmingId.value;
              confirmingId.value = null;
              if (!id) return;
              const ok = await removeTodo(id);
              if (!ok) say("Couldn't delete that. Try again?");
            }}
          >
            Delete
          </Button>
          <Button
            variant="text"
            full
            onClick={() => (confirmingId.value = null)}
          >
            Keep it
          </Button>
        </div>
      </Sheet>

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/todos/TodoBacklog.test.tsx`
Expected: PASS, 3 passed.

- [ ] **Step 5: Verify the whole suite and check**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add islands/todos
git commit -m "feat(todos): add TodoBacklog island"
```

---

### Task 8: Wire up the /todos route

**Files:**
- Modify: `routes/todos/index.tsx` (replace the whole file — it is currently a 14-line `ComingSoon`)

**Interfaces:**
- Consumes: `TodoRepo` (Task 3), `TodoBacklog` (Task 7), `define` and `page`.
- Produces: the working `/todos` page. Nothing downstream consumes this.

`/todos` is a top-level nav tab, already registered at `config/navigation.ts:41`, so it takes the default section-title app bar and must **not** set `ctx.state.appBar`.

- [ ] **Step 1: Replace the route**

Overwrite `routes/todos/index.tsx`:

```tsx
import { page } from "fresh";
import { TodoRepo } from "@/database/index.ts";
import TodoBacklog from "@/islands/todos/TodoBacklog.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    return page({ todos: await TodoRepo.getAll(householdId) });
  },
});

export default define.page<typeof handler>(function Todos({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <TodoBacklog initialTodos={data.todos} />
    </main>
  );
});
```

- [ ] **Step 2: Verify check and the whole suite pass**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 3: Start the dev server and open /todos**

Run: `deno task dev`, then open `/todos` in the browser preview.
Expected: the empty state — "Nothing to do" — and a "New to-do" FAB. No "Coming soon" pill.

- [ ] **Step 4: Verify the full journey by hand**

Walk each of these and confirm the stated result:

1. Tap the FAB → sheet opens with the title field focused.
2. Type "Take out the bins", press Enter → it appears at the top of the list; the sheet stays open with an empty, still-focused field.
3. Type "Call the dentist", press Enter → it appears **above** "Take out the bins" (newest first). Close the sheet.
4. Tap the round check on "Take out the bins" → it leaves the open list and appears under a **Done** heading, struck through.
5. Tap its round check again → it returns to the open list.
6. Tap the "Call the dentist" row → the edit sheet opens. Add a note, then tap Done → the note shows on the row with a 📝 prefix.
7. Reload the page → both to-dos, the note, and any done state all survive (this proves SSR and persistence agree).
8. Open a to-do, tap Delete → the confirmation sheet appears. Tap "Keep it" → nothing is deleted. Tap Delete again, then confirm → the to-do disappears.
9. Reload → the deleted to-do is still gone.
10. Select the whole title in the edit sheet and delete it, then close the sheet → reload and confirm the **old title is still there** (the blank-title guard held).

- [ ] **Step 5: Confirm the empty state and the seed still work**

Run: `deno task db:seed`
Expected: completes without error. Then reload `/todos` — a seeded household has no to-dos, so the empty state shows. The seed script is not modified by this plan.

- [ ] **Step 6: Stop the dev server and commit**

```bash
git add routes/todos/index.tsx
git commit -m "feat(todos): replace the /todos placeholder with the backlog"
```

---

### Task 9: Update the patterns doc and the More sheet

**Files:**
- Modify: `islands/shell/MoreSheet.tsx:37-66` (the To-dos module row currently says "coming soon")
- Modify: `docs/ui-ux-patterns.md`

**Interfaces:**
- Consumes: the working `/todos` route (Task 8).
- Produces: nothing consumed by code.

CLAUDE.md requires `docs/ui-ux-patterns.md` to be kept updated when a new pattern is introduced. This feature introduces one: **a create sheet that stays open across saves for rapid capture**.

- [ ] **Step 1: Point the More sheet at the live route**

In `islands/shell/MoreSheet.tsx`, replace the To-dos row (currently at `:47-52`):

```tsx
        <ListItem
          leading={badge("checklist")}
          headline="To-dos"
          trailing={chevron()}
          onClick={() => soon("To-dos")}
        />
```

with the navigating form, matching the Shopping row directly above it:

```tsx
        <ListItem
          leading={badge("checklist")}
          headline="To-dos"
          trailing={chevron()}
          onClick={() => {
            onClose();
            navigateTo("/todos");
          }}
        />
```

Leave the Menu planner row's `soon(...)` call alone. If `soon` becomes unused after this edit, `deno lint` will say so — in that case keep it, because Menu planner still uses it.

- [ ] **Step 2: Document the persistent-create-sheet pattern**

In `docs/ui-ux-patterns.md`, add a short subsection near the existing mutation and sheet guidance:

```markdown
### Create sheets that stay open for rapid capture

Most create sheets close on save (New list, Add card, Add dish). Where a user
plausibly adds several things in one sitting — the to-do backlog — the sheet
**stays open** after a successful save, clearing its fields and keeping focus,
and closes only via its own button or the scrim.

**Why:** it removes two taps per item, and it stops the mobile soft keyboard
dismissing and re-opening between entries — the class of problem behind the
keyboard primer in `islands/items.tsx` and the autofocus regression in PR #45.

**Don't** use this for creates that need a decision per item (choosing a
category, a barcode format) — there the sheet closing *is* the confirmation.

**See:** `islands/todos/TodoBacklog.tsx` — the create `Sheet` and `submitNew`.
```

- [ ] **Step 3: Verify check passes**

Run: `deno task check`
Expected: PASS. (`deno.json` excludes `docs/`, so the doc edit is not format-checked; the `MoreSheet.tsx` edit is.)

- [ ] **Step 4: Verify the More sheet in the browser**

Run `deno task dev`, open the More tab, tap To-dos.
Expected: it navigates to `/todos` instead of showing a "coming soon" snackbar.

- [ ] **Step 5: Stop the dev server and commit**

```bash
git add islands/shell/MoreSheet.tsx docs/ui-ux-patterns.md
git commit -m "docs(todos): surface to-dos in the More sheet and document the capture-sheet pattern"
```

---

## Verification before calling this done

- [ ] `deno task check` passes
- [ ] `deno task test` passes, and includes the new `utils/http.test.ts`, `database/todo.repo.test.ts`, `routes/api/todos/index.test.ts`, `routes/api/todos/[id].test.ts`, `hooks/useTodos.test.ts` and `islands/todos/TodoBacklog.test.tsx` — 196 baseline + 41 new = 237 passing
- [ ] The full manual journey in Task 8 Step 4 has been walked, not assumed
- [ ] `/todos` shows no "Coming soon" pill anywhere
- [ ] No file outside the File Structure table was modified

## Deliberately not built

Re-read this before adding anything: assignment, `completedBy`, filters, due dates, recurrence, labels, bulk "clear done", `createKvRepo<T>`, the `services/api/<entity>.ts` split, Dutch copy, home-screen counts, nav badges. Each is scoped to a later iteration in the spec, and assignment is hard-blocked on issue #17.
