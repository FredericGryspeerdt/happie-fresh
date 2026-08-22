# To-do Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #88 — a to-do can be assigned to one member (or left up for grabs) and remembers who ticked it off; both editor surfaces migrate from bottom Sheet to FullScreenDialog.

**Architecture:** Two additive fields on `TodoInterface` (`assignedTo`, `completedBy`), normalised at the read boundary like `dueAt` (no migration). The PATCH handler validates `assignedTo` against household membership and stamps/clears `completedBy` on `completedAt` transitions (clients never send `completedBy`). The backlog island gains member props, an inline avatar-chip assignee picker inside both new `FullScreenDialog` surfaces, quiet row avatars, and an All/Mine `Segmented` filter. Member removal sweeps `assignedTo` off open to-dos.

**Tech Stack:** Deno + Fresh 2, Preact + @preact/signals, Deno KV, MD3 components (`FullScreenDialog`, `Segmented`, `MemberAvatar`).

**Spec (authoritative):** `docs/superpowers/specs/2026-08-10-todo-assignment-design.md`. Design authority: ADR 0006 (members/acting member), ADR 0002 (completion is a timestamp), the overlay boundary rule (`docs/ui-ux-patterns.md` §9).

## Global Constraints

- `deno task check` and `deno task test` must pass after every task.
- Preact JSX: `class`, never `className`; `@/` import alias; `useSignal` in component bodies.
- Conventional Commits.
- Domain language: "member", "assigned", "up for grabs" — never "owner", "responsible", "delegated", "user".
- Anyone assigns anyone: NO permission checks on assignment (assignment is not destructive; the ADR 0006 manager gate does not apply).
- `completedBy` is server-stamped from `ctx.state.actingMember` only — a client-sent `completedBy` is ignored.
- Mine = `assignedTo === acting member`, everywhere including Done — never `completedBy`.
- **Rapid capture is retired** (product owner tested it in real life): the create surface closes on save. Do not preserve the stays-open behavior.
- The §12 keyboard-primer hand-off in `islands/todos/TodoBacklog.tsx` must survive the dialog migration untouched.
- Repo/handler tests: in-memory KV pattern (`Deno.env.set("KV_PATH", ":memory:")`, `sanitizeResources: false`); quote bracket paths in test commands.
- Run one test file: `deno test --unstable-kv -A <path>`.

---

### Task 1: Model fields + `TodoRepo.unassignMember`

**Files:**
- Modify: `models/todo/todo.interface.ts`
- Modify: `database/todo.repo.ts` (normalise + new method)
- Test: `database/todo.repo.test.ts` (append; also extend its `draft()` helper)
- Modify: any `TodoRepo.create(` call site the type checker flags (handler tests, `routes/api/todos/index.ts` — Task 2 rewrites that handler anyway, but `deno task check` must pass NOW, so add the two nulls wherever needed)

**Interfaces:**
- Consumes: existing `TodoRepo`, `mergeDefinedPatch`.
- Produces (used by every later task):
  - `TodoInterface.assignedTo: string | null` — memberId or null. Intent.
  - `TodoInterface.completedBy: string | null` — memberId or null. Fact.
  - `CreateTodoDto` (derived) now requires both.
  - `TodoInput = Pick<TodoInterface, "title" | "notes" | "dueAt" | "assignedTo">`
  - `TodoRepo.unassignMember(householdId: string, memberId: string): Promise<number>` — clears `assignedTo` on OPEN to-dos only, returns how many it cleared.

- [ ] **Step 1: Extend the model**

In `models/todo/todo.interface.ts`, add to `TodoInterface` after `dueAt`:

```ts
/**
 * The member this to-do is for, or null when it is up for grabs. Intent —
 * never mutated by completion (see docs/adr/0007). Anyone may set it.
 */
assignedTo: string | null;
/**
 * The member who ticked it off, or null while open. Fact — server-stamped
 * from the acting member together with completedAt, cleared together with
 * it. Clients never send this. See docs/adr/0007.
 */
completedBy: string | null;
```

and change `TodoInput` to:

```ts
export type TodoInput = Pick<
  TodoInterface,
  "title" | "notes" | "dueAt" | "assignedTo"
>;
```

- [ ] **Step 2: Write the failing repo tests**

Append to `database/todo.repo.test.ts` (its `draft()` helper must gain `assignedTo: null, completedBy: null` defaults first so existing tests compile):

```ts
Deno.test({
  name: "normalise — records written before assignment read as null fields",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    const hh = "hh-norm-assign";
    // Simulate a pre-assignment record: write directly, without the fields.
    const legacy = {
      id: "legacy-todo",
      householdId: hh,
      title: "Old row",
      createdBy: "m-x",
      createdAt: "2026-08-01T10:00:00.000Z",
      completedAt: null,
      dueAt: null,
    };
    await kv.set(["todos", hh, legacy.id], legacy);
    const read = await TodoRepo.getById(hh, legacy.id);
    assertEquals(read?.assignedTo, null);
    assertEquals(read?.completedBy, null);
  },
});

Deno.test({
  name: "unassignMember — clears open, leaves done, scoped to household",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-sweep";
    const openMine = await TodoRepo.create(
      draft(hh, "Open mine", { assignedTo: "m-bo" }),
    );
    const openOther = await TodoRepo.create(
      draft(hh, "Open other", { assignedTo: "m-pip" }),
    );
    const doneMine = await TodoRepo.create(
      draft(hh, "Done mine", {
        assignedTo: "m-bo",
        completedAt: "2026-08-09T10:00:00.000Z",
        completedBy: "m-bo",
      }),
    );
    const elsewhere = await TodoRepo.create(
      draft("hh-other", "Elsewhere", { assignedTo: "m-bo" }),
    );

    const cleared = await TodoRepo.unassignMember(hh, "m-bo");
    assertEquals(cleared, 1);
    assertEquals((await TodoRepo.getById(hh, openMine.id))?.assignedTo, null);
    assertEquals(
      (await TodoRepo.getById(hh, openOther.id))?.assignedTo,
      "m-pip",
    );
    // Done rows dangle by design (graceful dangle, ADR 0006/0007).
    assertEquals((await TodoRepo.getById(hh, doneMine.id))?.assignedTo, "m-bo");
    assertEquals(
      (await TodoRepo.getById(hh, doneMine.id))?.completedBy,
      "m-bo",
    );
    assertEquals(
      (await TodoRepo.getById("hh-other", elsewhere.id))?.assignedTo,
      "m-bo",
    );
  },
});
```

- [ ] **Step 3: Run to verify failure**

Run: `deno test --unstable-kv -A database/todo.repo.test.ts`
Expected: FAIL — `unassignMember` is not a function; the normalise test fails on `assignedTo` being `undefined`.

- [ ] **Step 4: Implement**

In `database/todo.repo.ts`, replace `normalise` (keep its doc comment, extended):

```ts
/**
 * `dueAt`, `assignedTo` and `completedBy` were each added after the first
 * to-dos were written, so older records lack the keys. Normalising here —
 * once, at the read boundary — keeps every consumer free of `?? null`
 * defensiveness. No migration is needed: the fields are additive and
 * optional in storage.
 */
function normalise(value: TodoInterface): TodoInterface {
  if (
    value.dueAt !== undefined && value.assignedTo !== undefined &&
    value.completedBy !== undefined
  ) return value;
  return {
    ...value,
    dueAt: value.dueAt ?? null,
    assignedTo: value.assignedTo ?? null,
    completedBy: value.completedBy ?? null,
  };
}
```

Add to the `TodoRepo` class:

```ts
/**
 * A removed member's open to-dos return to "up for grabs" (spec: the work
 * still needs doing and must not be invisibly parked on a ghost). Done rows
 * keep their ids dangling by design. Called from the members DELETE handler.
 */
static async unassignMember(
  householdId: string,
  memberId: string,
): Promise<number> {
  const kv = await getKv();
  let cleared = 0;
  for await (
    const entry of kv.list<TodoInterface>({ prefix: ["todos", householdId] })
  ) {
    const todo = entry.value;
    if (todo.assignedTo !== memberId || todo.completedAt !== null) continue;
    await kv.set(entry.key, { ...todo, assignedTo: null });
    cleared++;
  }
  return cleared;
}
```

- [ ] **Step 5: Fix compile fallout, run everything**

Run `deno task check`. Every `TodoRepo.create(` call site now requires `assignedTo`/`completedBy` — add `assignedTo: null, completedBy: null` to the `seed()`/draft helpers in `routes/api/todos/index.test.ts`, `routes/api/todos/[id].test.ts`, and the POST handler in `routes/api/todos/index.ts` (minimal edit here — Task 2 rewrites it properly). Then:

Run: `deno task check && deno task test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add models/todo/ database/todo.repo.ts database/todo.repo.test.ts routes/api/todos/
git commit -m "feat(todos): assignedTo and completedBy fields with unassign sweep"
```

---

### Task 2: API — validate `assignedTo`, stamp `completedBy`

**Files:**
- Modify: `routes/api/todos/[id].ts` (PATCH)
- Modify: `routes/api/todos/index.ts` (POST)
- Test: `routes/api/todos/[id].test.ts`, `routes/api/todos/index.test.ts` (append + fix states)

**Interfaces:**
- Consumes: `MemberRepo.getById(householdId, id)`, `ctx.state.actingMember`, Task 1's fields.
- Produces: `PATCH /api/todos/:id` accepts `assignedTo: null | <household member id>` (else 400) and manages `completedBy` on `completedAt` transitions; PATCH now requires an acting member (401 without). `POST /api/todos` accepts optional `assignedTo`, same validation, and always writes `completedBy: null`.

- [ ] **Step 1: Write the failing tests**

Append to `routes/api/todos/[id].test.ts` (reuse its `ctx`/`patch`/`seed` helpers and MANAGER/KID member fixtures; `seed()` gains an optional overrides param if it lacks one — pass `assignedTo` through to `TodoRepo.create`):

```ts
Deno.test({
  name: "PATCH — assigns and unassigns a household member",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const member = await MemberRepo.create({
      householdId: "h1",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ assignedTo: member.id }), todo.id, AUTH_MANAGER),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).assignedTo, member.id);

    const cleared = await handler.PATCH(
      ctx(patch({ assignedTo: null }), todo.id, AUTH_MANAGER),
    );
    assertEquals((await cleared.json()).assignedTo, null);
  },
});

Deno.test({
  name: "PATCH — rejects a non-member assignee with 400",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ assignedTo: "not-a-member" }), todo.id, AUTH_MANAGER),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "PATCH — ticking off stamps completedBy with the acting member; un-ticking clears it",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const ticked = await (await handler.PATCH(
      ctx(
        patch({ completedAt: "2026-08-10T12:00:00.000Z" }),
        todo.id,
        AUTH_MANAGER,
      ),
    )).json();
    assertEquals(ticked.completedBy, MANAGER.id);

    const reopened = await (await handler.PATCH(
      ctx(patch({ completedAt: null }), todo.id, AUTH_MANAGER),
    )).json();
    assertEquals(reopened.completedBy, null);
  },
});

Deno.test({
  name: "PATCH — a client-sent completedBy is ignored",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await (await handler.PATCH(
      ctx(patch({ completedBy: "m-spoofed" }), todo.id, AUTH_MANAGER),
    )).json();
    assertEquals(res.completedBy, null);
  },
});
```

And to `routes/api/todos/index.test.ts` (reuse its helpers/fixtures):

```ts
Deno.test({
  name: "POST — accepts an optional assignee; rejects a non-member",
  sanitizeResources: false,
  async fn() {
    const member = await MemberRepo.create({
      householdId: "h-post-assign",
      name: "Pip",
      color: "lavender",
      emoji: "🦄",
      isManager: false,
    });
    const state = {
      userId: "u1",
      householdId: "h-post-assign",
      actingMember: { ...MANAGER, householdId: "h-post-assign" },
    };
    const ok = await handler.POST(
      ctx(post({ title: "Water the plants", assignedTo: member.id }), state),
    );
    assertEquals(ok.status, 201);
    const created = await ok.json();
    assertEquals(created.assignedTo, member.id);
    assertEquals(created.completedBy, null);

    const bad = await handler.POST(
      ctx(post({ title: "Nope", assignedTo: "not-a-member" }), state),
    );
    assertEquals(bad.status, 400);
  },
});
```

**Existing-test fallout to expect and fix (never weaken assertions):** PATCH now requires `actingMember` in state — any existing PATCH test whose state lacks it gets the MANAGER fixture added. The existing "PATCH ticks off and un-ticks via completedAt" test still passes (it asserts `completedAt` only), but if it asserts full-object equality anywhere, update expectations to include the stamped `completedBy`.

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A "routes/api/todos/[id].test.ts" routes/api/todos/index.test.ts`
Expected: new cases FAIL (assignedTo not accepted; completedBy never stamped).

- [ ] **Step 3: Implement PATCH**

In `routes/api/todos/[id].ts`: add `MemberRepo` to the `@/database/index.ts` import. Replace the auth guard and extend the field handling:

```ts
async PATCH(ctx) {
  const { householdId, actingMember } = ctx.state;
  if (!householdId || !actingMember) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await ctx.req.json();
  const patch: UpdateTodoDto = {};
  // ... title / notes / dueAt handling unchanged ...

  if (body.completedAt !== undefined) {
    if (body.completedAt === null) {
      patch.completedAt = null;
      patch.completedBy = null;
    } else {
      if (
        typeof body.completedAt !== "string" ||
        Number.isNaN(Date.parse(body.completedAt))
      ) {
        return badRequest("completedAt must be null or a valid date string");
      }
      patch.completedAt = body.completedAt;
      // Fact, stamped server-side: whoever is acting ticked it off. A
      // client-sent completedBy is deliberately ignored (docs/adr/0007).
      patch.completedBy = actingMember.id;
    }
  }
  if (body.assignedTo !== undefined) {
    if (body.assignedTo === null) {
      patch.assignedTo = null;
    } else if (
      typeof body.assignedTo !== "string" ||
      !(await MemberRepo.getById(householdId, body.assignedTo))
    ) {
      return badRequest("assignedTo must be null or a member of the household");
    } else {
      patch.assignedTo = body.assignedTo;
    }
  }
  // ... TodoRepo.update + responses unchanged ...
},
```

- [ ] **Step 4: Implement POST**

In `routes/api/todos/index.ts` POST, after the `dueAt` block:

```ts
let assignedTo: string | null = null;
if (body.assignedTo !== undefined && body.assignedTo !== null) {
  if (
    typeof body.assignedTo !== "string" ||
    !(await MemberRepo.getById(householdId, body.assignedTo))
  ) {
    return badRequest("assignedTo must be null or a member of the household");
  }
  assignedTo = body.assignedTo;
}
```

and include `assignedTo, completedBy: null,` in the `TodoRepo.create` call (replacing Task 1's stopgap nulls). Import `MemberRepo` alongside `TodoRepo`.

- [ ] **Step 5: Run everything**

Run: `deno task check && deno task test`
Expected: all green after fixing the state fallout described in Step 1.

- [ ] **Step 6: Commit**

```bash
git add routes/api/todos/
git commit -m "feat(todos): validate assignedTo and stamp completedBy from the acting member"
```

---

### Task 3: Member removal sweeps open to-dos

**Files:**
- Modify: `routes/api/members/[id].ts` (DELETE)
- Test: `routes/api/members/[id].test.ts` (append)

**Interfaces:**
- Consumes: `TodoRepo.unassignMember` (Task 1).
- Produces: DELETE `/api/members/:id` also clears `assignedTo` on the removed member's open to-dos.

- [ ] **Step 1: Write the failing test**

Append to `routes/api/members/[id].test.ts` (reuse `ctx`/`del`/`seed` helpers; import `TodoRepo`):

```ts
Deno.test({
  name: "DELETE — unassigns the removed member's open to-dos, leaves done ones",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const bo = await seed("Bo", false);
    const openTodo = await TodoRepo.create({
      householdId: "h1",
      title: "Water the plants",
      createdBy: mgr.id,
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueAt: null,
      assignedTo: bo.id,
      completedBy: null,
    });
    const doneTodo = await TodoRepo.create({
      householdId: "h1",
      title: "Feed the cat",
      createdBy: mgr.id,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      dueAt: null,
      assignedTo: bo.id,
      completedBy: bo.id,
    });

    const res = await handler.DELETE(
      ctx(del(), bo.id, { householdId: "h1", actingMember: mgr }),
    );
    assertEquals(res.status, 204);
    assertEquals((await TodoRepo.getById("h1", openTodo.id))?.assignedTo, null);
    assertEquals(
      (await TodoRepo.getById("h1", doneTodo.id))?.assignedTo,
      bo.id,
    );
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A "routes/api/members/[id].test.ts"`
Expected: the new case FAILS (open to-do still assigned).

- [ ] **Step 3: Implement**

In `routes/api/members/[id].ts` DELETE, right after `await MemberRepo.delete(householdId, target.id);`:

```ts
// Their open to-dos return to "up for grabs" — the work still needs doing
// and must not be parked on a ghost. Done rows dangle (docs/adr/0007).
await TodoRepo.unassignMember(householdId, target.id);
```

Add `TodoRepo` to the `@/database/index.ts` import.

- [ ] **Step 4: Run + commit**

Run: `deno task check && deno task test` — green.

```bash
git add routes/api/members/
git commit -m "feat(members): removing a member unassigns their open to-dos"
```

---

### Task 4: Hook — `assign()` + adopting server responses

**Files:**
- Modify: `hooks/useTodos.ts`
- Test: `hooks/useTodos.test.ts` (append; extend any local todo-factory with the two new fields)

**Interfaces:**
- Consumes: `api.todos.update` (unchanged — `UpdateTodoDto` now carries `assignedTo`).
- Produces: `assign(id: string, memberId: string | null): Promise<boolean>` — optimistic immediate PATCH (a discrete commit like `setDueAt`, not debounced) with snapshot rollback. `tickOff`/`unTick` now adopt the server-returned todo so the stamped/cleared `completedBy` reaches local state without a refresh.

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useTodos.test.ts` (follow its existing stub style; its todo factory gains `assignedTo: null, completedBy: null` defaults):

```ts
Deno.test("assign — optimistic, rolls back when the server rejects", async () => {
  const update = stub(api.todos, "update", () => Promise.resolve(null));
  const hook = useTodos([todo({ id: "1", title: "Bins" })]);
  try {
    const ok = await hook.assign("1", "m-bo");
    assertEquals(ok, false);
    assertEquals(hook.openTodos.value[0].assignedTo, null); // rolled back
  } finally {
    update.restore();
  }
});

Deno.test("assign — persists and keeps the server's value", async () => {
  const saved = todo({ id: "1", title: "Bins", assignedTo: "m-bo" });
  const update = stub(api.todos, "update", () => Promise.resolve(saved));
  const hook = useTodos([todo({ id: "1", title: "Bins" })]);
  try {
    const ok = await hook.assign("1", "m-bo");
    assertEquals(ok, true);
    assertEquals(hook.openTodos.value[0].assignedTo, "m-bo");
    assertEquals(update.calls[0].args[1], { assignedTo: "m-bo" });
  } finally {
    update.restore();
  }
});

Deno.test("tickOff — adopts the server's completedBy stamp", async () => {
  const base = todo({ id: "1", title: "Bins" });
  const stamped = {
    ...base,
    completedAt: "2026-08-10T12:00:00.000Z",
    completedBy: "m-demo",
  };
  const update = stub(api.todos, "update", () => Promise.resolve(stamped));
  const hook = useTodos([base]);
  try {
    const ok = await hook.tickOff("1");
    assertEquals(ok, true);
    assertEquals(hook.doneTodos.value[0].completedBy, "m-demo");
  } finally {
    update.restore();
  }
});
```

(Note: `tickOff` waits `EXIT_MS` internally; the test just awaits it.)

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A hooks/useTodos.test.ts`
Expected: FAIL — `assign` is not a function; `completedBy` stays null after tickOff.

- [ ] **Step 3: Implement**

In `hooks/useTodos.ts`, add after `setDueAt`:

```ts
/**
 * Set or clear who a to-do is for. Optimistic with rollback and an
 * immediate PATCH — a discrete commit like setDueAt, not debounced typing.
 * Works on done to-dos too (the editor opens for them). Assignment never
 * changes rank, so no re-sort is needed.
 */
const assign = async (
  id: string,
  memberId: string | null,
): Promise<boolean> => {
  if (!findAnywhere(id)) return false;
  const openSnapshot = openTodos.value;
  const doneSnapshot = doneTodos.value;
  const apply = (list: TodoInterface[]) =>
    list.map((t) => (t.id === id ? { ...t, assignedTo: memberId } : t));
  openTodos.value = apply(openTodos.value);
  doneTodos.value = apply(doneTodos.value);

  startPending();
  try {
    const saved = await api.todos.update(id, { assignedTo: memberId });
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

In `tickOff`, after the successful update (`if (!saved) { …rollback… }` branch), adopt the response so the server-stamped `completedBy` lands locally — replace `return true;` with:

```ts
// Adopt the server's record: it carries the completedBy stamp the
// optimistic copy can't know (the acting member lives server-side).
doneTodos.value = doneTodos.value.map((t) => (t.id === id ? saved : t));
return true;
```

In `unTick`, same shape (the server clears `completedBy`); replace its `return true;` with:

```ts
openTodos.value = openTodos.value
  .map((t) => (t.id === id ? saved : t))
  .sort(compareTodos);
return true;
```

Export `assign` from the returned object.

- [ ] **Step 4: Run + commit**

Run: `deno task check && deno task test` — green.

```bash
git add hooks/useTodos.ts hooks/useTodos.test.ts
git commit -m "feat(todos): assign() in useTodos and completedBy adoption"
```

---

### Task 5: Props plumbing + `AssigneePicker` component

**Files:**
- Create: `islands/todos/AssigneePicker.tsx`
- Modify: `routes/todos/index.tsx`
- Modify: `islands/todos/TodoBacklog.tsx` (props only in this task)
- Test: `islands/todos/TodoBacklog.test.tsx` (fixtures gain the new required props)

**Interfaces:**
- Consumes: `MemberRepo.getAll`, `ctx.state.actingMember`, `MemberAvatar` (`components/members/MemberAvatar.tsx`, props `{color?, emoji, size?}`).
- Produces:
  - `TodoBacklog` props gain `members: MemberInterface[]` and `actingMemberId: string | null` (both REQUIRED — the type checker finds every call site).
  - `AssigneePicker({ members, value, onChange })` — inline radio-row: "No one" + one avatar-chip per member.

- [ ] **Step 1: Route**

`routes/todos/index.tsx` becomes:

```tsx
import { page } from "fresh";
import { MemberRepo, TodoRepo } from "@/database/index.ts";
import TodoBacklog from "@/islands/todos/TodoBacklog.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const [todos, members] = await Promise.all([
      TodoRepo.getAll(householdId),
      MemberRepo.getAll(householdId),
    ]);
    return page({
      todos,
      members,
      actingMemberId: ctx.state.actingMember?.id ?? null,
      canDelete: ctx.state.actingMember?.isManager === true,
    });
  },
});

export default define.page<typeof handler>(function Todos({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <TodoBacklog
        initialTodos={data.todos}
        members={data.members}
        actingMemberId={data.actingMemberId}
        canDelete={data.canDelete}
      />
    </main>
  );
});
```

- [ ] **Step 2: Island props**

In `islands/todos/TodoBacklog.tsx` extend `Props` and the destructure:

```ts
import type { MemberInterface, TodoInterface } from "@/models/index.ts";

interface Props {
  initialTodos: TodoInterface[];
  members: MemberInterface[];
  actingMemberId: string | null;
  canDelete: boolean;
}
```

(No behavior change yet; Tasks 6–7 consume them.)

- [ ] **Step 3: `islands/todos/AssigneePicker.tsx`**

```tsx
import type { MemberInterface } from "@/models/index.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { cn } from "@/components/md3/tokens.ts";

interface AssigneePickerProps {
  members: MemberInterface[];
  value: string | null;
  onChange: (memberId: string | null) => void;
}

/**
 * Inline "who's doing it" radio row for the to-do dialogs — deliberately
 * never a nested overlay (spec: no overlay stacks on a dialog). Same
 * plain-button radio-row pattern as the members screen's colour/emoji
 * pickers.
 */
export default function AssigneePicker(
  { members, value, onChange }: AssigneePickerProps,
) {
  const chip = (selected: boolean) =>
    cn(
      "inline-flex items-center gap-2 h-10 rounded-[var(--md-shape-full)] md-label-large border",
      selected
        ? "bg-primary-container text-on-primary-container border-transparent"
        : "text-on-surface border-outline",
    );
  return (
    <div class="flex flex-col gap-2">
      <div class="md-label-medium uppercase text-on-surface-variant px-1">
        Assigned to
      </div>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Assigned to">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          class={`px-4 ${chip(value === null)}`}
        >
          No one
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value === m.id}
            onClick={() => onChange(m.id)}
            class={`pl-1.5 pr-3 ${chip(value === m.id)}`}
          >
            <MemberAvatar color={m.color} emoji={m.emoji} size={28} />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fix test fixtures, run, commit**

Every `h(TodoBacklog, {...})` in `islands/todos/TodoBacklog.test.tsx` gains `members: [], actingMemberId: null` (a `member()` fixture factory comes in Task 7 for the tests that need real members).

Run: `deno task check && deno task test` — green.

```bash
git add routes/todos/index.tsx islands/todos/AssigneePicker.tsx islands/todos/TodoBacklog.tsx islands/todos/TodoBacklog.test.tsx
git commit -m "feat(todos): thread members and acting member into the backlog"
```

---

### Task 6: Dialog migration (create + edit), rapid capture retired

**Files:**
- Modify: `islands/todos/TodoBacklog.tsx`
- Test: `islands/todos/TodoBacklog.test.tsx` (append)

**Interfaces:**
- Consumes: `FullScreenDialog` (`components/md3/FullScreenDialog.tsx`, props `{open, onClose, title, action?, children, class?}` — `action` is the header commit affordance, pass a `Button variant="text"`), `AssigneePicker` (Task 5), `assign` (Task 4).
- Produces: create + edit as `FullScreenDialog`s; create closes on save; both carry the assignee picker; delete flow and confirm Sheet unchanged.

- [ ] **Step 1: Migrate the create surface**

In `islands/todos/TodoBacklog.tsx`:

1. Import `FullScreenDialog` and `AssigneePicker`; keep the `Sheet` import (confirm + due-picker sheets remain).
2. Add a `newAssignee` signal beside the other create fields: `const newAssignee = useSignal<string | null>(null);` and reset it in `openCreate` (`newAssignee.value = null;`).
3. Rewrite `submitNew` — **closes on save** (rapid capture retired after real-world testing; do not keep the stays-open behavior or its comment):

```ts
const submitNew = async () => {
  const title = newTitle.value.trim();
  if (!title) return;
  const notes = newNotes.value.trim();
  const created = await addTodo({
    title,
    notes: notes || undefined,
    dueAt: newDue.value ? new Date(newDue.value).toISOString() : null,
    assignedTo: newAssignee.value,
  });
  if (!created) {
    say("Couldn't add that to-do. Try again?");
    return;
  }
  closeCreate();
};
```

4. Replace the create `<Sheet>` block with (primer, `openCreate`, `closeCreate`, and the focus-handoff effect stay EXACTLY as they are — the body is still gated on `createOpen.value`, so the title field still mounts fresh on open):

```tsx
<FullScreenDialog
  open={createOpen.value}
  onClose={closeCreate}
  title="New to-do"
  action={<Button variant="text" onClick={submitNew}>Add</Button>}
>
  {createOpen.value && (
    <div class="flex flex-col gap-3 pt-2">
      {/* title input, notes textarea, datetime-local input: unchanged from
          the sheet version — same refs, handlers, classes */}
      <AssigneePicker
        members={members}
        value={newAssignee.value}
        onChange={(id) => (newAssignee.value = id)}
      />
    </div>
  )}
</FullScreenDialog>
```

(The sheet's body-level "Add"/"Close" buttons are gone: Add lives in the header `action`; the dialog's own X closes.)

- [ ] **Step 2: Migrate the edit surface**

Replace the edit `<Sheet>` with:

```tsx
<FullScreenDialog
  open={editingId.value !== null}
  onClose={closeEditor}
  title="Edit to-do"
  action={<Button variant="text" onClick={closeEditor}>Done</Button>}
>
  {(() => {
    const t = editing();
    if (!t) return null;
    return (
      <div class="flex flex-col gap-3 pt-2">
        {/* title input, notes textarea, datetime-local input: unchanged */}
        <AssigneePicker
          members={members}
          value={t.assignedTo}
          onChange={async (id) => {
            const ok = await assign(t.id, id);
            if (!ok) say("Couldn't save that. Try again?");
          }}
        />
        {canDelete && (
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
        )}
      </div>
    );
  })()}
</FullScreenDialog>
```

Destructure `assign` from the `useTodos` result. The delete-confirmation `Sheet` and the due-picker `Sheet` stay exactly as they are (close-then-confirm sequencing unchanged; confirmations are always Sheets).

- [ ] **Step 3: Append SSR tests**

The dialog (like the Sheet) renders its shell even when closed, but both bodies are gated on their open signals — so cold SSR shows titles but no fields. Assert the structural change:

```ts
Deno.test("TodoBacklog — create and edit surfaces are dialogs, not sheets", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [],
    members: [],
    actingMemberId: null,
    canDelete: true,
  }));
  // FullScreenDialog renders role="dialog" with an aria-label per title.
  assertStringIncludes(html, 'aria-label="New to-do"');
  assertStringIncludes(html, 'aria-label="Edit to-do"');
  // Rapid capture is retired: no body-level Close button in the create flow.
  assertFalse(html.includes(">Close<"));
});
```

- [ ] **Step 4: Run everything, commit**

Run: `deno task check && deno task test` — green (update any older test that asserted sheet-specific markup if one exists; never weaken a behavioral assertion).

```bash
git add islands/todos/
git commit -m "feat(todos): editor dialogs with inline assignee picker, rapid capture retired"
```

---

### Task 7: Row avatars + All/Mine filter

**Files:**
- Modify: `islands/todos/TodoBacklog.tsx`
- Test: `islands/todos/TodoBacklog.test.tsx` (append; add a `member()` fixture factory)

**Interfaces:**
- Consumes: `MemberAvatar`, `Segmented` (`components/md3/Segmented.tsx`, props `{options: [key, IconName, label][], value, onChange}`), Task 5's props.
- Produces: assignee avatar on open rows, `completedBy` avatar on done rows (~20 px, nothing when unset/unresolvable); an All/Mine `Segmented` above the groups; Mine = `assignedTo === actingMemberId` across open AND done; warm Mine empty state.

- [ ] **Step 1: Implement**

In `islands/todos/TodoBacklog.tsx`:

1. Imports: `MemberAvatar`, `Segmented`.
2. Member lookup + filter state near the other signals:

```ts
const filter = useSignal<"all" | "mine">("all");
const memberById = new Map(members.map((m) => [m.id, m]));
```

3. Filtering — Mine means intent (`assignedTo`), everywhere including Done (docs/adr/0007); replace the `groups`/done-window derivations:

```ts
const mineOnly = filter.value === "mine";
const mine = (t: TodoInterface) =>
  t.assignedTo !== null && t.assignedTo === actingMemberId;
const visibleOpen = mineOnly ? open.filter(mine) : open;
const filteredDone = mineOnly ? done.filter(mine) : done;

const groups = groupOpenTodos(visibleOpen, now);
const doneCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
const recentDone = filteredDone.filter((t) =>
  new Date(t.completedAt!).getTime() >= doneCutoff
);
const earlierDoneCount = filteredDone.length - recentDone.length;
const visibleDone = showEarlierDone.value ? filteredDone : recentDone;
```

(The Done section's `done.length > 0` render guard becomes `filteredDone.length > 0`.)

4. Row avatar — in the `row(t, isDone)` JSX, wrap the `DueChip` line so the avatar sits beside it:

```tsx
<div class="flex items-center gap-2">
  <DueChip
    dueAt={t.dueAt}
    now={now}
    onClick={() => openDuePicker(t.id, t.dueAt)}
  />
  {(() => {
    const who = memberById.get(
      (isDone ? t.completedBy : t.assignedTo) ?? "",
    );
    return who
      ? <MemberAvatar color={who.color} emoji={who.emoji} size={20} />
      : null;
  })()}
</div>
```

(Unresolvable or unset ids render nothing — graceful dangle.)

5. Toggle + Mine empty state — inside the non-empty branch of the backlog, ABOVE the push nudge:

```tsx
<Segmented
  options={[["all", "people", "All"], ["mine", "user", "Mine"]]}
  value={filter.value}
  onChange={(k) => (filter.value = k as "all" | "mine")}
/>
{mineOnly && visibleOpen.length === 0 && filteredDone.length === 0 && (
  <div class="md-body-medium text-on-surface-variant text-center pt-8">
    Nothing on your plate.
  </div>
)}
```

(The outer `open.length === 0 && done.length === 0` global empty state keeps using the UNFILTERED lists, so a truly empty backlog still shows "Nothing to do" and no toggle.)

- [ ] **Step 2: Append SSR tests**

```ts
const member = (
  id: string,
  name: string,
  emoji = "🐸",
): MemberInterface => ({
  id,
  householdId: "h1",
  name,
  color: "meadow",
  emoji,
  isManager: false,
});

Deno.test("TodoBacklog — open rows show the assignee's avatar, done rows the completer's", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", title: "Bins", assignedTo: "m-bo" }),
      todo({
        id: "t2",
        title: "Dishes",
        completedAt: "2026-08-10T10:00:00.000Z",
        completedBy: "m-pip",
      }),
    ],
    members: [member("m-bo", "Bo", "🐸"), member("m-pip", "Pip", "🦄")],
    actingMemberId: "m-bo",
    canDelete: true,
  }));
  assertStringIncludes(html, "🐸");
  assertStringIncludes(html, "🦄");
});

Deno.test("TodoBacklog — renders the All/Mine toggle when the backlog is non-empty", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", title: "Bins" })],
    members: [member("m-bo", "Bo")],
    actingMemberId: "m-bo",
    canDelete: true,
  }));
  assertStringIncludes(html, ">All<");
  assertStringIncludes(html, ">Mine<");
});
```

(Client-side Mine *switching* is signal-driven and not exercisable in render-to-string — it gets live browser verification in Task 8. The SSR default is "all", so filtering-hides-others can't be asserted cold; don't write a vacuous test for it.)

- [ ] **Step 3: Run everything, commit**

Run: `deno task check && deno task test` — green.

```bash
git add islands/todos/
git commit -m "feat(todos): row avatars and All/Mine filter"
```

---

### Task 8: Docs, verification, finish

**Files:**
- Create: `docs/adr/0007-assignment-is-intent-completion-is-fact.md`
- Modify: `CONTEXT.md` (To-dos section)
- Modify: `docs/ui-ux-patterns.md` (§13)
- Verify: everything, live

- [ ] **Step 1: ADR 0007**

`docs/adr/0007-assignment-is-intent-completion-is-fact.md`:

```md
# Assignment is intent; completion is fact

A to-do has at most **one** assignee (`assignedTo`, a member id or null =
up for grabs), and remembers who ticked it off (`completedBy`, stamped
server-side from the acting member together with `completedAt`, cleared
together with it). The two fields never mutate each other: "assigned to Bo,
done by Mom" stays visible. "Mine" in the UI always means assignment
(intent), never completion, including in the Done section.

## Why

Multiple assignees would force answers the household doesn't ask (done when
one finishes? all?) and whatever we pick here the future Chores module
inherits — a genuinely shared job is evidence for that module (ADR 0003),
not for widening this field. `completedBy` ships now because ADR 0002
deliberately parked it until members existed: stamping it costs a few lines
in the PATCH handler today, while deferring it would leave every done row
written in the meantime permanently blank. Assignment is deliberately NOT
manager-gated (ADR 0006's gate covers destruction): a parent handing out
work and a kid claiming it are the same one-tap gesture.

## Consequences

Removing a member clears `assignedTo` on their **open** to-dos (up for
grabs again); done rows keep dangling ids under the ADR 0006 graceful-dangle
contract — renderers show nothing rather than assume resolution. Clients
never send `completedBy`; the server ignores it. Assignee-aware reminders
remain household-wide for now (member→device targeting is its own design,
entangled with issue #68).
```

- [ ] **Step 2: CONTEXT.md**

Add to the To-dos section, after the **Overdue** entry:

```md
**Assigned**: A to-do that is *for* a particular member — at most one. An
unassigned to-do is **up for grabs**: anyone may claim it or hand it to
someone, and neither is a special permission. Being assigned says who is
*meant* to do it; who actually did it is remembered separately when it is
done. _Avoid_: owner, responsible, delegated
```

- [ ] **Step 3: ui-ux-patterns §13**

Replace §13's body (keep the heading number) with a short retirement note in the house style — the rule inverts:

```md
## 13. Create surfaces close on save

**Rule:** A create sheet/dialog **closes when the entry is saved**. Do not
build stays-open "rapid capture" create flows.

**Why:** The to-dos create sheet originally stayed open between saves to
remove taps for batch entry. Real-world use (tested on device, Aug 2026)
showed people add one to-do and move on — the open surface read as "did my
tap work?" rather than an invitation to add more. Retired with the to-do
assignment iteration; the keyboard primer (§12) is unaffected and still
applies to dynamically mounted create fields.

**See:** `islands/todos/TodoBacklog.tsx` (`submitNew` closes via
`closeCreate()`).
```

Check the "Review checklist" and §12's cross-references for stale mentions of the stays-open behavior and update them.

- [ ] **Step 4: Full verification**

```bash
deno task check && deno task test
```

Then live, per the browser-e2e recipe (`.env` with `SEED_USERNAME`/`SEED_PASSWORD`/`KV_PATH=data/kv.db`, `deno task db:seed`, `dev-wt` launch config on port 5178, curl-login + cookie):

- Create dialog: FAB → full-screen dialog, keyboard raises on the title field (primer hand-off), assign to Bo via chip row, Add in the header → dialog **closes**, row shows Bo's 🐸.
- Edit dialog: change assignee → persists across reload; "No one" clears it.
- Tick off a to-do while acting as Demo → done row shows Demo's 🦊 (completedBy), while the assignee was Bo — both facts visible in the editor.
- All/Mine as Bo: Mine shows only Bo's to-dos, urgency groups intact; empty Mine shows "Nothing on your plate."
- Remove Bo from `/members` → Bo's open to-dos lose their avatar and appear under All as unassigned; done rows keep rendering (no crash, no avatar).
- On-device (or emulated mobile viewport): dialog occupies the full screen; on desktop width it renders centered.

- [ ] **Step 5: Commit docs, then finish the branch**

```bash
git add docs/adr/0007-assignment-is-intent-completion-is-fact.md CONTEXT.md docs/ui-ux-patterns.md
git commit -m "docs: ADR 0007, Assigned glossary entry, create-closes-on-save pattern"
```

Use the finishing-a-development-branch skill: push `feature/todo-assignment`, PR against `main` with `Closes #88`.

---

## Self-Review (done at planning time)

- **Spec coverage:** model fields + normalise (Task 1), validation + stamping (Task 2), sweep (Tasks 1+3), anyone-assigns-anyone (no permission code anywhere — verified by absence), dialogs + inline picker + rapid-capture retirement (Task 6), row avatars + All/Mine + empty state (Task 7), ADR/CONTEXT/§13 (Task 8), assignee-aware notifications correctly ABSENT.
- **Type consistency:** `assignedTo`/`completedBy: string | null` used identically across model, repo, handlers, hook, and fixtures; `assign(id, memberId|null): Promise<boolean>`; `unassignMember(householdId, memberId): Promise<number>`; island props `members`/`actingMemberId` named identically in route, island, and tests.
- **Known judgment points for implementers:** exact positions of the Segmented/nudge/groups in the JSX tree may differ by a few lines from the plan's anchors — the anchors given (signal names, existing comments) are stable; `hooks/useTodos.test.ts`'s existing factory name may differ from `todo()` — adapt names, keep assertions.
