# Weekly Menu Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a household manually assemble a persisted weekly menu ("This week") by adding/removing dishes from the existing catalogue and optionally pinning each to a weekday.

**Architecture:** A household-scoped KV singleton (`["weekly_menu", householdId]`) behind a new `WeeklyMenuRepo` → `/api/menu/plan` route → `api.weeklyMenu` client → `useWeeklyMenu` optimistic-signals hook. `/menu` is reframed as a planner with two sub-tabs: **This week** (new `WeeklyMenu` island, default) and **Dishes** (the existing `DishCatalogue`, moved to `/menu/dishes`, gaining an Add/Added toggle).

**Tech Stack:** Deno + Fresh 2 (SSR + islands) + Preact + `@preact/signals` + Deno KV + Tailwind v4. Tests: `deno test --unstable-kv -A` with `jsr:@std/assert`, `jsr:@std/testing/mock`, `npm:preact-render-to-string`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-31-weekly-menu-assembly-design.md` (authoritative).
- **Scope:** Manual assembly only. NO suggestion engine / variety balancing (#14). NO "add ingredients to groceries". NO multi-select batch-add. NO drag-reorder. A dish is in the week **at most once** (dedup by `dishId`).
- **Household scoping:** every API handler reads `ctx.state.householdId` (populated by `routes/_middleware.ts`) and returns **401** when absent. KV key is `["weekly_menu", householdId]`.
- **Conventions:** `@/` import alias; Tailwind `class` (not `className`); JSX `jsx: "precompile"`; strict types; DTO/interface types live in `models/`. Islands use `useSignal` for local state; data hooks use module `signal()`/`computed()` and are created once via `useMemo(() => useX(...), [])` in the island (mirror `useDishes`/`DishCatalogue`).
- **Research (per CLAUDE.md):** before writing the repo/route, confirm Fresh 2 `define.handlers` signatures and Deno KV APIs via Context7 (`mcp__plugin_context7_context7__*`).
- **Commits:** Conventional Commits, scope `menu`. Every commit ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (shown via a second `-m` in each commit step). Commit after each task.
- **Weekday vocabulary:** `Weekday = "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun"`, ordered Monday-first (`WEEKDAY_ORDER`).

## File Structure

- **Create** `models/menu/weekly-menu.interface.ts` — `Weekday`, `WEEKDAY_ORDER`, `MenuEntryInterface`, `WeeklyMenuInterface`.
- **Create** `models/menu/index.ts` — barrel.
- **Modify** `models/index.ts` — export the new module.
- **Create** `database/weekly-menu.repo.ts` — `WeeklyMenuRepo` (KV singleton, RMW actions).
- **Modify** `database/index.ts` — export the repo.
- **Create** `routes/api/menu/plan.ts` — GET/POST/PATCH/DELETE handlers.
- **Modify** `services/api.ts` — `api.weeklyMenu`.
- **Create** `hooks/useWeeklyMenu.ts` — optimistic hook.
- **Create** `islands/menu/MenuSubNav.tsx` — two-tab chip bar.
- **Create** `islands/menu/WeeklyMenu.tsx` — the plan view.
- **Modify** `islands/dishes/DishCatalogue.tsx` — `initialMenu` prop + Add/Added toggle.
- **Modify** `routes/menu/index.tsx` — catalogue → This-week plan.
- **Create** `routes/menu/dishes.tsx` — catalogue at its own route.
- **Tests:** `models/menu/weekly-menu.test.ts`, `database/weekly-menu.repo.test.ts`, `routes/api/menu/plan.test.ts`, `hooks/useWeeklyMenu.test.ts`, `islands/menu/MenuSubNav.test.tsx`, `islands/menu/WeeklyMenu.test.tsx`, and edits to `islands/dishes/DishCatalogue.test.tsx`.

---

### Task 1: Weekly-menu data model

**Files:**
- Create: `models/menu/weekly-menu.interface.ts`
- Create: `models/menu/index.ts`
- Modify: `models/index.ts`
- Test: `models/menu/weekly-menu.test.ts`

**Interfaces:**
- Produces: `type Weekday`; `const WEEKDAY_ORDER: Weekday[]`; `interface MenuEntryInterface { id: string; dishId: string; day: Weekday | null }`; `interface WeeklyMenuInterface { householdId: string; entries: MenuEntryInterface[]; updatedAt?: string }` — all re-exported from `@/models/index.ts`.

- [ ] **Step 1: Write the failing test**

`models/menu/weekly-menu.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { WEEKDAY_ORDER } from "@/models/index.ts";

Deno.test("WEEKDAY_ORDER — Monday-first, seven days", () => {
  assertEquals(WEEKDAY_ORDER, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A models/menu/weekly-menu.test.ts`
Expected: FAIL — module `@/models/menu/...` not found / `WEEKDAY_ORDER` is undefined.

- [ ] **Step 3: Write the model**

`models/menu/weekly-menu.interface.ts`:
```ts
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const WEEKDAY_ORDER: Weekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export interface MenuEntryInterface {
  id: string; // stable entry id (crypto.randomUUID)
  dishId: string; // → ["dishes", dishId]
  day: Weekday | null; // optional weekday pin; null = "Any day"
}

export interface WeeklyMenuInterface {
  householdId: string;
  entries: MenuEntryInterface[];
  updatedAt?: string; // ISO string, stamped on each mutation
}
```

`models/menu/index.ts`:
```ts
export * from "./weekly-menu.interface.ts";
```

- [ ] **Step 4: Export from the models barrel**

In `models/index.ts`, add this line after the `./dish/index.ts` export:
```ts
export * from "./menu/index.ts";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --unstable-kv -A models/menu/weekly-menu.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add models/menu/ models/index.ts
git commit -m "feat(menu): add weekly-menu data model" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: WeeklyMenuRepo (KV singleton)

**Files:**
- Create: `database/weekly-menu.repo.ts`
- Modify: `database/index.ts`
- Test: `database/weekly-menu.repo.test.ts`

**Interfaces:**
- Consumes: `WeeklyMenuInterface`, `MenuEntryInterface`, `Weekday` from `@/models/index.ts`; `getKv` from `./db.ts`.
- Produces: `class WeeklyMenuRepo` with static methods, each keyed by `householdId`, each returning a `Promise<WeeklyMenuInterface>`:
  - `get(householdId)` — stored menu, or `{ householdId, entries: [] }` (unpersisted) if none.
  - `addDish(householdId, dishId)` — append `{ id, dishId, day: null }`; dedup by `dishId` (no write if present).
  - `setDay(householdId, entryId, day: Weekday | null)` — set an entry's `day`; no-op if `entryId` missing.
  - `removeEntry(householdId, entryId)` — drop the entry.
  - `clear(householdId)` — empty `entries`.

- [ ] **Step 1: Write the failing test**

`database/weekly-menu.repo.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { WeeklyMenuRepo } from "@/database/weekly-menu.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see dish.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearMenus() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["weekly_menu"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "get — returns an empty menu for a household with no data",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    assertEquals(await WeeklyMenuRepo.get("h1"), {
      householdId: "h1",
      entries: [],
    });
  },
});

Deno.test({
  name: "addDish — appends an entry (id + day:null) and dedups by dishId",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const a = await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals(a.entries.length, 1);
    assertEquals(a.entries[0].dishId, "d1");
    assertEquals(a.entries[0].day, null);
    assertEquals(typeof a.entries[0].id, "string");
    const b = await WeeklyMenuRepo.addDish("h1", "d1"); // dedup
    assertEquals(b.entries.length, 1);
    const c = await WeeklyMenuRepo.addDish("h1", "d2");
    assertEquals(c.entries.map((e) => e.dishId), ["d1", "d2"]);
  },
});

Deno.test({
  name: "setDay — pins and clears a weekday on an entry",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const m = await WeeklyMenuRepo.addDish("h1", "d1");
    const id = m.entries[0].id;
    assertEquals((await WeeklyMenuRepo.setDay("h1", id, "Wed")).entries[0].day, "Wed");
    assertEquals((await WeeklyMenuRepo.setDay("h1", id, null)).entries[0].day, null);
  },
});

Deno.test({
  name: "removeEntry — drops the matching entry",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    const m = await WeeklyMenuRepo.addDish("h1", "d2");
    const id = m.entries[0].id;
    const after = await WeeklyMenuRepo.removeEntry("h1", id);
    assertEquals(after.entries.map((e) => e.dishId), ["d2"]);
  },
});

Deno.test({
  name: "clear — empties the menu",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals((await WeeklyMenuRepo.clear("h1")).entries, []);
  },
});

Deno.test({
  name: "scoping — a mutation on one household does not affect another",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals((await WeeklyMenuRepo.get("h2")).entries, []);
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A database/weekly-menu.repo.test.ts`
Expected: FAIL — cannot resolve `@/database/weekly-menu.repo.ts`.

- [ ] **Step 3: Write the repo**

`database/weekly-menu.repo.ts`:
```ts
import type {
  MenuEntryInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { getKv } from "./db.ts";

export class WeeklyMenuRepo {
  private static key(householdId: string) {
    return ["weekly_menu", householdId] as const;
  }

  static async get(householdId: string): Promise<WeeklyMenuInterface> {
    const kv = await getKv();
    const res = await kv.get<WeeklyMenuInterface>(this.key(householdId));
    return res.value ?? { householdId, entries: [] };
  }

  // Read-modify-write so a single racing action loses at most itself, never the
  // whole menu. Stamps updatedAt on every persisted change.
  private static async save(
    menu: WeeklyMenuInterface,
  ): Promise<WeeklyMenuInterface> {
    const kv = await getKv();
    const next: WeeklyMenuInterface = {
      ...menu,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(this.key(menu.householdId), next);
    return next;
  }

  static async addDish(
    householdId: string,
    dishId: string,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    if (menu.entries.some((e) => e.dishId === dishId)) return menu; // dedup
    const entry: MenuEntryInterface = {
      id: crypto.randomUUID(),
      dishId,
      day: null,
    };
    return await this.save({ ...menu, entries: [...menu.entries, entry] });
  }

  static async setDay(
    householdId: string,
    entryId: string,
    day: Weekday | null,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    if (!menu.entries.some((e) => e.id === entryId)) return menu;
    return await this.save({
      ...menu,
      entries: menu.entries.map((e) => (e.id === entryId ? { ...e, day } : e)),
    });
  }

  static async removeEntry(
    householdId: string,
    entryId: string,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    return await this.save({
      ...menu,
      entries: menu.entries.filter((e) => e.id !== entryId),
    });
  }

  static async clear(householdId: string): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    return await this.save({ ...menu, entries: [] });
  }
}
```

- [ ] **Step 4: Export from the database barrel**

In `database/index.ts`, add after the `./dish-tag-group.repo.ts` export:
```ts
export * from "./weekly-menu.repo.ts";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --unstable-kv -A database/weekly-menu.repo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add database/weekly-menu.repo.ts database/weekly-menu.repo.test.ts database/index.ts
git commit -m "feat(menu): add WeeklyMenuRepo household-scoped KV singleton" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `/api/menu/plan` route

**Files:**
- Create: `routes/api/menu/plan.ts`
- Test: `routes/api/menu/plan.test.ts`

**Interfaces:**
- Consumes: `WeeklyMenuRepo` from `@/database/index.ts`; `Weekday` from `@/models/index.ts`; `define` from `@/utils/index.ts` (typed with `StateInterface`, so `ctx.state.householdId` is available).
- Produces: `export const handler` with `GET`, `POST`, `PATCH`, `DELETE`. Mutations return the updated `WeeklyMenuInterface` as JSON (200). `POST {dishId}`; `PATCH {entryId, day}`; `DELETE {entryId}` or `DELETE {clear:true}`.

- [ ] **Step 1: Write the failing test**

`routes/api/menu/plan.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/menu/plan.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  householdId: string | undefined = "h1",
): Context<unknown> {
  return { req, state: { householdId } } as unknown as Context<unknown>;
}
async function clearMenus() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["weekly_menu"] })) {
    await kv.delete(e.key);
  }
}
const req = (method: string, body?: unknown) =>
  new Request("http://x/api/menu/plan", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

Deno.test({
  name: "GET — 401 without a household",
  sanitizeResources: false,
  async fn() {
    assertEquals((await handler.GET(ctx(req("GET"), undefined))).status, 401);
  },
});

Deno.test({
  name: "POST adds; GET lists; PATCH pins a day; DELETE removes",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const addRes = await handler.POST(ctx(req("POST", { dishId: "d1" })));
    assertEquals(addRes.status, 200);
    const added = await addRes.json();
    assertEquals(added.entries.map((e: { dishId: string }) => e.dishId), ["d1"]);
    const entryId = added.entries[0].id;

    const getRes = await handler.GET(ctx(req("GET")));
    assertEquals((await getRes.json()).entries.length, 1);

    const patchRes = await handler.PATCH(ctx(req("PATCH", { entryId, day: "Wed" })));
    assertEquals((await patchRes.json()).entries[0].day, "Wed");

    const delRes = await handler.DELETE(ctx(req("DELETE", { entryId })));
    assertEquals((await delRes.json()).entries, []);
  },
});

Deno.test({
  name: "DELETE { clear: true } empties the menu",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await handler.POST(ctx(req("POST", { dishId: "d1" })));
    await handler.POST(ctx(req("POST", { dishId: "d2" })));
    assertEquals((await handler.DELETE(ctx(req("DELETE", { clear: true })))).status, 200);
    assertEquals(
      (await (await handler.GET(ctx(req("GET")))).json()).entries,
      [],
    );
  },
});

Deno.test({
  name: "POST without dishId is 400; PATCH with a bad day is 400",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    assertEquals((await handler.POST(ctx(req("POST", {})))).status, 400);
    assertEquals(
      (await handler.PATCH(ctx(req("PATCH", { entryId: "x", day: "Funday" })))).status,
      400,
    );
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A routes/api/menu/plan.test.ts`
Expected: FAIL — cannot resolve `@/routes/api/menu/plan.ts`.

- [ ] **Step 3: Write the route**

`routes/api/menu/plan.ts`:
```ts
import { WeeklyMenuRepo } from "@/database/index.ts";
import type { Weekday } from "@/models/index.ts";
import { define } from "@/utils/index.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await WeeklyMenuRepo.get(householdId));
  },

  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { dishId } = await ctx.req.json();
    if (!dishId) return new Response("dishId required", { status: 400 });
    return json(await WeeklyMenuRepo.addDish(householdId, dishId));
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { entryId, day } = await ctx.req.json();
    if (!entryId) return new Response("entryId required", { status: 400 });
    if (day !== null && !WEEKDAYS.includes(day)) {
      return new Response("invalid day", { status: 400 });
    }
    return json(await WeeklyMenuRepo.setDay(householdId, entryId, day));
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { entryId, clear } = await ctx.req.json();
    if (clear === true) return json(await WeeklyMenuRepo.clear(householdId));
    if (!entryId) {
      return new Response("entryId or clear required", { status: 400 });
    }
    return json(await WeeklyMenuRepo.removeEntry(householdId, entryId));
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A routes/api/menu/plan.test.ts`
Expected: PASS (4 tests). If `handler.GET` is not directly callable (it should be — `define.handlers` is an identity/typing helper, same as `routes/api/shopping/lists.ts`), stop and confirm the Fresh 2 API via Context7 before proceeding.

- [ ] **Step 5: Commit**

```bash
git add routes/api/menu/plan.ts routes/api/menu/plan.test.ts
git commit -m "feat(menu): add /api/menu/plan weekly-menu endpoints" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `api.weeklyMenu` client service

**Files:**
- Modify: `services/api.ts`

**Interfaces:**
- Consumes: `WeeklyMenuInterface`, `Weekday` from `@/models/index.ts`.
- Produces: `api.weeklyMenu` with `get()`, `addDish(dishId)`, `setDay(entryId, day)`, `removeEntry(entryId)`, `clear()`, each `Promise<WeeklyMenuInterface | null>` (`null` on a non-ok response).

- [ ] **Step 1: Add the model imports**

In `services/api.ts`, extend the existing `@/models/index.ts` import that already brings in `ShoppingListInterface` etc. — add `Weekday` and `WeeklyMenuInterface` to that import list.

- [ ] **Step 2: Add the client surface**

In `services/api.ts`, inside the `export const api = { ... }` object, add this property (place it after the `dishTagGroups` block, before the closing `};`):
```ts
  weeklyMenu: {
    get: async (): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan");
      if (!res.ok) return null;
      return res.json();
    },
    addDish: async (dishId: string): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    setDay: async (
      entryId: string,
      day: Weekday | null,
    ): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, day }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    removeEntry: async (
      entryId: string,
    ): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    clear: async (): Promise<WeeklyMenuInterface | null> => {
      const res = await fetch("/api/menu/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) return null;
      return res.json();
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `deno check services/api.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/api.ts
git commit -m "feat(menu): add api.weeklyMenu client methods" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `useWeeklyMenu` hook

**Files:**
- Create: `hooks/useWeeklyMenu.ts`
- Test: `hooks/useWeeklyMenu.test.ts`

**Interfaces:**
- Consumes: `api.weeklyMenu` (Task 4); `WEEKDAY_ORDER`, `MenuEntryInterface`, `Weekday`, `WeeklyMenuInterface` from `@/models/index.ts`; `beginBusy`/`endBusy` from `@/utils/loading.ts`.
- Produces: `useWeeklyMenu(initialMenu: WeeklyMenuInterface)` returning `{ menu, pendingCount, plannedDishIds, sortedEntries, addDish, removeEntry, removeDishFromPlan, setDay, clear, refresh }`.
  - `menu: Signal<WeeklyMenuInterface>`; `plannedDishIds: ReadonlySignal<Set<string>>`; `sortedEntries: ReadonlySignal<MenuEntryInterface[]>` (weekday-pinned first in `WEEKDAY_ORDER`, then unpinned in insertion order).
  - `addDish(dishId)` / `removeEntry(entryId)` / `removeDishFromPlan(dishId)` / `setDay(entryId, day)` / `clear()` — optimistic + reconcile-or-rollback, each `Promise<void>`. `addDish` dedups client-side (no API call if the dish is already planned). `refresh()` re-pulls from the server.

- [ ] **Step 1: Write the failing test**

`hooks/useWeeklyMenu.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import type { MenuEntryInterface, WeeklyMenuInterface } from "@/models/index.ts";

const menu = (entries: MenuEntryInterface[] = []): WeeklyMenuInterface => ({
  householdId: "h1",
  entries,
});

Deno.test("addDish — optimistic add, reconciles with the server menu", async () => {
  const server = menu([{ id: "e1", dishId: "d1", day: null }]);
  const add = stub(api.weeklyMenu, "addDish", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu());
  try {
    await hook.addDish("d1");
    assertEquals(hook.menu.value.entries.map((e) => e.id), ["e1"]);
    assertEquals(add.calls.length, 1);
    assertEquals([...hook.plannedDishIds.value], ["d1"]);
  } finally {
    add.restore();
  }
});

Deno.test("addDish — dedups a dish already in the plan (no API call)", async () => {
  const add = stub(api.weeklyMenu, "addDish", () => Promise.resolve(menu()));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.addDish("d1");
    assertEquals(add.calls.length, 0);
    assertEquals(hook.menu.value.entries.length, 1);
  } finally {
    add.restore();
  }
});

Deno.test("removeDishFromPlan — removes the entry matching the dish", async () => {
  const server = menu([{ id: "e2", dishId: "d2", day: null }]);
  const rm = stub(api.weeklyMenu, "removeEntry", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu([
    { id: "e1", dishId: "d1", day: null },
    { id: "e2", dishId: "d2", day: null },
  ]));
  try {
    await hook.removeDishFromPlan("d1");
    assertEquals(rm.calls[0].args, ["e1"]);
    assertEquals(hook.menu.value.entries.map((e) => e.dishId), ["d2"]);
  } finally {
    rm.restore();
  }
});

Deno.test("setDay — pins a weekday", async () => {
  const server = menu([{ id: "e1", dishId: "d1", day: "Wed" }]);
  const sd = stub(api.weeklyMenu, "setDay", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.setDay("e1", "Wed");
    assertEquals(hook.menu.value.entries[0].day, "Wed");
  } finally {
    sd.restore();
  }
});

Deno.test("sortedEntries — pinned Mon→Sun first, then Any-day in insertion order", () => {
  const hook = useWeeklyMenu(menu([
    { id: "e1", dishId: "d1", day: null },
    { id: "e2", dishId: "d2", day: "Fri" },
    { id: "e3", dishId: "d3", day: "Mon" },
    { id: "e4", dishId: "d4", day: null },
  ]));
  assertEquals(hook.sortedEntries.value.map((e) => e.id), ["e3", "e2", "e1", "e4"]);
});

Deno.test("clear — rolls back when the API returns null", async () => {
  const cl = stub(api.weeklyMenu, "clear", () => Promise.resolve(null));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.clear();
    assertEquals(hook.menu.value.entries.map((e) => e.id), ["e1"]); // restored
  } finally {
    cl.restore();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A hooks/useWeeklyMenu.test.ts`
Expected: FAIL — cannot resolve `@/hooks/useWeeklyMenu.ts`.

- [ ] **Step 3: Write the hook**

`hooks/useWeeklyMenu.ts`:
```ts
import { computed, signal } from "@preact/signals";
import type {
  MenuEntryInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useWeeklyMenu(initialMenu: WeeklyMenuInterface) {
  const menu = signal<WeeklyMenuInterface>(initialMenu);
  const pendingCount = signal(0);

  const plannedDishIds = computed<Set<string>>(
    () => new Set(menu.value.entries.map((e) => e.dishId)),
  );

  const sortedEntries = computed<MenuEntryInterface[]>(() => {
    const rank = (d: Weekday | null) =>
      d === null ? WEEKDAY_ORDER.length : WEEKDAY_ORDER.indexOf(d);
    return menu.value.entries
      .map((e, i) => ({ e, i }))
      .sort((a, b) => rank(a.e.day) - rank(b.e.day) || a.i - b.i)
      .map(({ e }) => e);
  });

  // apply an optimistic value, call the API, reconcile with the result, or roll
  // back to the previous value on null/throw.
  const run = async (
    optimistic: WeeklyMenuInterface,
    call: () => Promise<WeeklyMenuInterface | null>,
  ): Promise<void> => {
    const prev = menu.value;
    menu.value = optimistic;
    pendingCount.value++;
    beginBusy();
    try {
      const result = await call();
      menu.value = result ?? prev;
    } catch {
      menu.value = prev;
    } finally {
      pendingCount.value--;
      endBusy();
    }
  };

  const addDish = async (dishId: string): Promise<void> => {
    if (menu.value.entries.some((e) => e.dishId === dishId)) return; // dedup
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: [...menu.value.entries, { id: `tmp-${dishId}`, dishId, day: null }],
    };
    await run(optimistic, () => api.weeklyMenu.addDish(dishId));
  };

  const removeEntry = async (entryId: string): Promise<void> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.filter((e) => e.id !== entryId),
    };
    await run(optimistic, () => api.weeklyMenu.removeEntry(entryId));
  };

  const removeDishFromPlan = async (dishId: string): Promise<void> => {
    const entry = menu.value.entries.find((e) => e.dishId === dishId);
    if (entry) await removeEntry(entry.id);
  };

  const setDay = async (entryId: string, day: Weekday | null): Promise<void> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.map((e) => (e.id === entryId ? { ...e, day } : e)),
    };
    await run(optimistic, () => api.weeklyMenu.setDay(entryId, day));
  };

  const clear = async (): Promise<void> => {
    await run({ ...menu.value, entries: [] }, () => api.weeklyMenu.clear());
  };

  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const result = await api.weeklyMenu.get();
      if (result) menu.value = result;
    } finally {
      pendingCount.value--;
    }
  };

  return {
    menu,
    pendingCount,
    plannedDishIds,
    sortedEntries,
    addDish,
    removeEntry,
    removeDishFromPlan,
    setDay,
    clear,
    refresh,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A hooks/useWeeklyMenu.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useWeeklyMenu.ts hooks/useWeeklyMenu.test.ts
git commit -m "feat(menu): add useWeeklyMenu optimistic hook" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `MenuSubNav` sub-tab island

**Files:**
- Create: `islands/menu/MenuSubNav.tsx`
- Test: `islands/menu/MenuSubNav.test.tsx`

**Interfaces:**
- Consumes: `Chip` from `@/components/md3/Chip.tsx`; `navigateTo` from `@/utils/loading.ts`.
- Produces: `default function MenuSubNav({ active }: { active: "plan" | "dishes" })` — two chips linking to `/menu` and `/menu/dishes`.

- [ ] **Step 1: Write the failing test**

`islands/menu/MenuSubNav.test.tsx`:
```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import MenuSubNav from "./MenuSubNav.tsx";

Deno.test("MenuSubNav — renders both tab labels", () => {
  const html = render(h(MenuSubNav, { active: "plan" }));
  assertStringIncludes(html, "This week");
  assertStringIncludes(html, "Dishes");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/menu/MenuSubNav.test.tsx`
Expected: FAIL — cannot resolve `./MenuSubNav.tsx`.

- [ ] **Step 3: Write the island**

`islands/menu/MenuSubNav.tsx`:
```tsx
import { Chip } from "@/components/md3/Chip.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  active: "plan" | "dishes";
}

export default function MenuSubNav({ active }: Props) {
  return (
    <div class="flex gap-2 px-4 pt-4">
      <Chip
        selected={active === "plan"}
        leadingCheck={false}
        onClick={() => active !== "plan" && navigateTo("/menu")}
      >
        This week
      </Chip>
      <Chip
        selected={active === "dishes"}
        leadingCheck={false}
        onClick={() => active !== "dishes" && navigateTo("/menu/dishes")}
      >
        Dishes
      </Chip>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/menu/MenuSubNav.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add islands/menu/MenuSubNav.tsx islands/menu/MenuSubNav.test.tsx
git commit -m "feat(menu): add MenuSubNav sub-tab bar" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `WeeklyMenu` plan-view island

**Files:**
- Create: `islands/menu/WeeklyMenu.tsx`
- Test: `islands/menu/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `useWeeklyMenu` (Task 5); `WEEKDAY_ORDER`, `DishInterface`, `DishTagGroupInterface`, `MenuEntryInterface`, `Weekday`, `WeeklyMenuInterface` from `@/models/index.ts`; MD3 `PullToRefresh`, `Card`, `Chip`, `Button`, `Icon`, `IconButton`, `Pressable`, `Sheet`, `Snackbar`; `navigateTo` from `@/utils/loading.ts`.
- Produces: `default function WeeklyMenu({ initialMenu, initialDishes, initialTagGroups })`.

- [ ] **Step 1: Write the failing test**

`islands/menu/WeeklyMenu.test.tsx`:
```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import WeeklyMenu from "./WeeklyMenu.tsx";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";

const dishes: DishInterface[] = [
  { id: "d1", name: "Pasta Bolognese", ingredientIds: [], tagValueIds: ["meat"] },
];
const tagGroups: DishTagGroupInterface[] = [
  { id: "type", label: "Type", order: 0, values: [{ id: "meat", label: "Meat" }] },
];

Deno.test("WeeklyMenu — empty state prompts adding dishes", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: { householdId: "h1", entries: [] },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
  }));
  assertStringIncludes(html, "This week");
  assertStringIncludes(html, "No dishes yet");
  assertStringIncludes(html, "Add dishes");
});

Deno.test("WeeklyMenu — renders an entry with its dish name, tag, and day chip", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: {
      householdId: "h1",
      entries: [{ id: "e1", dishId: "d1", day: null }],
    },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
  }));
  assertStringIncludes(html, "Pasta Bolognese");
  assertStringIncludes(html, "Meat"); // resolved tag label
  assertStringIncludes(html, "Any"); // unpinned day chip
  assertStringIncludes(html, "1 dish planned");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/menu/WeeklyMenu.test.tsx`
Expected: FAIL — cannot resolve `./WeeklyMenu.tsx`.

- [ ] **Step 3: Write the island**

`islands/menu/WeeklyMenu.tsx`:
```tsx
import { useSignal } from "@preact/signals";
import { useMemo, useRef } from "preact/hooks";
import type {
  DishInterface,
  DishTagGroupInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  initialMenu: WeeklyMenuInterface;
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
}

interface Snack {
  msg: string;
  action?: string;
  onAction?: () => void;
}

export default function WeeklyMenu(
  { initialMenu, initialDishes, initialTagGroups }: Props,
) {
  const { menu, sortedEntries, addDish, setDay, removeEntry, clear, refresh } =
    useMemo(() => useWeeklyMenu(initialMenu), []);

  const dishById = useMemo(() => {
    const m = new Map<string, DishInterface>();
    for (const d of initialDishes) m.set(d.id, d);
    return m;
  }, []);
  const tagLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of initialTagGroups) {
      for (const v of g.values) m.set(v.id, v.label);
    }
    return m;
  }, []);

  const dayPickEntryId = useSignal<string | null>(null);
  const snack = useSignal<Snack | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSnack = (msg: string, action?: string, onAction?: () => void) => {
    snack.value = { msg, action, onAction };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 4000);
  };

  // Undo for Clear: re-add each dish, then re-apply its weekday pin.
  const undoClear = async (prev: WeeklyMenuInterface["entries"]) => {
    for (const e of prev) {
      await addDish(e.dishId);
      if (e.day) {
        const added = menu.value.entries.find((x) => x.dishId === e.dishId);
        if (added) await setDay(added.id, e.day);
      }
    }
  };
  const onClear = () => {
    const prev = menu.value.entries;
    clear();
    showSnack("Cleared this week", "Undo", () => undoClear(prev));
  };

  const tagsFor = (dish?: DishInterface) =>
    dish
      ? dish.tagValueIds
        .map((id) => tagLabelById.get(id))
        .filter((l): l is string => !!l)
      : [];

  const pickDay = (day: Weekday | null) => {
    const id = dayPickEntryId.value;
    if (id) setDay(id, day);
    dayPickEntryId.value = null;
  };

  const entries = sortedEntries.value;
  const currentDay = entries.find((e) => e.id === dayPickEntryId.value)?.day ??
    null;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="pb-[calc(96px+env(safe-area-inset-bottom))]">
        {/* header */}
        <div class="flex items-center justify-between px-4 pt-4">
          <div>
            <div class="md-title-medium text-on-surface">This week</div>
            <div class="md-body-small text-on-surface-variant">
              {entries.length === 0
                ? "Nothing planned yet"
                : `${entries.length} dish${entries.length === 1 ? "" : "es"} planned`}
            </div>
          </div>
          {entries.length > 0 && (
            <Pressable
              onClick={onClear}
              class="md-label-large text-on-surface-variant px-2 py-1 rounded-[var(--md-shape-full)]"
            >
              Clear
            </Pressable>
          )}
        </div>

        {entries.length === 0
          ? (
            <div class="px-6 pt-10 flex flex-col items-center text-center gap-4">
              <div
                class="grid place-items-center rounded-[var(--md-shape-xl)] bg-primary-container text-on-primary-container"
                style={{ width: 80, height: 80 }}
              >
                <Icon name="plate" size={40} />
              </div>
              <div>
                <div class="md-title-medium text-on-surface">No dishes yet</div>
                <div class="md-body-medium text-on-surface-variant mt-1">
                  Pick dishes from your catalogue to plan the week.
                </div>
              </div>
              <Button
                variant="filled"
                icon="plus"
                onClick={() => navigateTo("/menu/dishes")}
              >
                Add dishes
              </Button>
            </div>
          )
          : (
            <div class="px-4 pt-3 flex flex-col gap-2.5">
              {entries.map((e) => {
                const dish = dishById.get(e.dishId);
                return (
                  <Card key={e.id} variant="filled" radius={16}>
                    <div class="flex items-center gap-3">
                      <Chip
                        selected={!!e.day}
                        leadingCheck={false}
                        icon={e.day ? undefined : "calendar"}
                        onClick={() => (dayPickEntryId.value = e.id)}
                      >
                        {e.day ?? "Any"}
                      </Chip>
                      <div class="flex-1 min-w-0">
                        <div class="md-title-small text-on-surface truncate">
                          {dish?.name ?? "Unknown dish"}
                        </div>
                        {tagsFor(dish).length > 0 && (
                          <div class="flex gap-1.5 flex-wrap mt-1.5">
                            {tagsFor(dish).map((t) => (
                              <span
                                key={t}
                                class="md-label-medium inline-flex items-center rounded-[var(--md-shape-full)] bg-surface-chighest text-on-surface-variant px-2.5 py-0.5"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <IconButton
                        name="x"
                        aria-label={`Remove ${dish?.name ?? "dish"} from this week`}
                        onClick={() => {
                          removeEntry(e.id);
                          showSnack("Removed from this week");
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      {/* day picker */}
      <Sheet
        open={dayPickEntryId.value !== null}
        onClose={() => (dayPickEntryId.value = null)}
        title="Pin to a day"
      >
        <div class="flex flex-wrap gap-2 pb-2">
          <Chip selected={currentDay === null} onClick={() => pickDay(null)}>
            Any day
          </Chip>
          {WEEKDAY_ORDER.map((d) => (
            <Chip key={d} selected={currentDay === d} onClick={() => pickDay(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </Sheet>

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/menu/WeeklyMenu.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add islands/menu/WeeklyMenu.tsx islands/menu/WeeklyMenu.test.tsx
git commit -m "feat(menu): add WeeklyMenu plan-view island" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Catalogue Add/Added toggle

**Files:**
- Modify: `islands/dishes/DishCatalogue.tsx`
- Test: `islands/dishes/DishCatalogue.test.tsx`

**Interfaces:**
- Consumes: `useWeeklyMenu` (Task 5); `WeeklyMenuInterface` from `@/models/index.ts`; existing `Button`, `Pressable`.
- Produces: `DishCatalogue` gains an optional `initialMenu?: WeeklyMenuInterface` prop and renders an Add/Added toggle per dish card (driven by `plannedDishIds`).

- [ ] **Step 1: Write the failing test**

Add to `islands/dishes/DishCatalogue.test.tsx` (keep the existing two tests unchanged):
```tsx
Deno.test("DishCatalogue — shows Added for a dish already in the week", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [
      { id: "1", name: "Pasta Bolognese", ingredientIds: [], tagValueIds: [] },
      { id: "2", name: "Veggie Curry", ingredientIds: [], tagValueIds: [] },
    ],
    initialTagGroups: [],
    initialMenu: {
      householdId: "h1",
      entries: [{ id: "e1", dishId: "1", day: null }],
    },
  }));
  assertStringIncludes(html, "Added"); // dish 1 is in the week
  assertStringIncludes(html, "Add"); // dish 2 is not
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/dishes/DishCatalogue.test.tsx`
Expected: FAIL — the new test can't find "Added" (toggle not implemented). The two existing tests still pass.

- [ ] **Step 3: Add the hook, prop, and imports**

In `islands/dishes/DishCatalogue.tsx`:

Add imports near the other `@/hooks` / `@/models` imports:
```tsx
import type { WeeklyMenuInterface } from "@/models/index.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
```

Extend the `Props` interface with the optional menu:
```tsx
  initialMenu?: WeeklyMenuInterface;
```

Destructure it in the component signature (add `initialMenu` alongside `initialDishes`, `initialTagGroups`), then create the menu hook next to the existing `useDishes` `useMemo`:
```tsx
  const { plannedDishIds, addDish, removeDishFromPlan } = useMemo(
    () => useWeeklyMenu(initialMenu ?? { householdId: "", entries: [] }),
    [],
  );
  const planned = plannedDishIds.value;
```

- [ ] **Step 4: Restructure each dish card to add the toggle (no nested buttons)**

Replace the dish-grid `list.map((d) => ( ... ))` block (the `<Pressable ...>` tile that navigates to `/menu/${d.id}`) with a `<div>` wrapper holding a `Pressable as="div"` body plus a sibling toggle button:
```tsx
{list.map((d) => (
  <div
    key={d.id}
    class="flex flex-col bg-surface border border-outline-variant rounded-[var(--md-shape-md)] overflow-hidden"
  >
    <Pressable
      as="div"
      onClick={() => navigateTo(`/menu/${d.id}`)}
      class="flex flex-col gap-1 px-4 py-3.5 text-left"
    >
      <span class="md-body-large text-on-surface truncate">{d.name}</span>
      <span class="md-body-small text-on-surface-variant truncate">
        {d.ingredientIds.length} ingredient{d.ingredientIds.length === 1 ? "" : "s"}
      </span>
    </Pressable>
    <div class="px-4 pb-3">
      {planned.has(d.id)
        ? (
          <Button
            variant="tonal"
            icon="check"
            full
            onClick={() => removeDishFromPlan(d.id)}
          >
            Added
          </Button>
        )
        : (
          <Button
            variant="outlined"
            icon="plus"
            full
            onClick={() => addDish(d.id)}
          >
            Add
          </Button>
        )}
    </div>
  </div>
))}
```
(Leave the search field, tag-filter rail, count, empty state, and FAB exactly as they are.)

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/dishes/DishCatalogue.test.tsx`
Expected: PASS (3 tests — the original two plus the new one).

- [ ] **Step 6: Commit**

```bash
git add islands/dishes/DishCatalogue.tsx islands/dishes/DishCatalogue.test.tsx
git commit -m "feat(menu): add Add/Added weekly-menu toggle to the dish catalogue" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Wire the routes (planner + catalogue sub-tabs)

**Files:**
- Modify: `routes/menu/index.tsx`
- Create: `routes/menu/dishes.tsx`

**Interfaces:**
- Consumes: `WeeklyMenuRepo`, `DishRepo`, `DishTagGroupRepo` from `@/database/index.ts`; `MenuSubNav` (Task 6); `WeeklyMenu` (Task 7); `DishCatalogue` (Task 8); `define` from `@/utils/index.ts`; `page` from `fresh`.
- Produces: `/menu` renders the This-week plan (default); `/menu/dishes` renders the catalogue. Both SSR `{ menu, dishes, tagGroups }`.

- [ ] **Step 1: Rewrite `routes/menu/index.tsx` as the This-week plan**

Replace the whole file with:
```tsx
import { page } from "fresh";
import {
  DishRepo,
  DishTagGroupRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import MenuSubNav from "@/islands/menu/MenuSubNav.tsx";
import WeeklyMenu from "@/islands/menu/WeeklyMenu.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    const householdId = ctx.state.householdId ?? "";
    const [menu, dishes, tagGroups] = await Promise.all([
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(),
      DishTagGroupRepo.getAll(),
    ]);
    return page({ menu, dishes, tagGroups });
  },
});

export default define.page<typeof handler>(function MenuPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <MenuSubNav active="plan" />
      <WeeklyMenu
        initialMenu={data.menu}
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
      />
    </main>
  );
});
```

- [ ] **Step 2: Create `routes/menu/dishes.tsx` (the catalogue)**

```tsx
import { page } from "fresh";
import {
  DishRepo,
  DishTagGroupRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import MenuSubNav from "@/islands/menu/MenuSubNav.tsx";
import DishCatalogue from "@/islands/dishes/DishCatalogue.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await DishTagGroupRepo.ensureDefaults();
    const householdId = ctx.state.householdId ?? "";
    const [menu, dishes, tagGroups] = await Promise.all([
      WeeklyMenuRepo.get(householdId),
      DishRepo.getAll(),
      DishTagGroupRepo.getAll(),
    ]);
    return page({ menu, dishes, tagGroups });
  },
});

export default define.page<typeof handler>(function DishesPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <MenuSubNav active="dishes" />
      <DishCatalogue
        initialDishes={data.dishes}
        initialTagGroups={data.tagGroups}
        initialMenu={data.menu}
      />
    </main>
  );
});
```

- [ ] **Step 3: Typecheck, lint, format, build**

Run: `deno task check`
Expected: no errors.
Run: `deno task build`
Expected: Vite build succeeds (this also confirms Fresh resolves the new routes and that `/menu/dishes` doesn't collide with `/menu/[id]`).

- [ ] **Step 4: Commit**

```bash
git add routes/menu/index.tsx routes/menu/dishes.tsx
git commit -m "feat(menu): reframe /menu as planner with This week + Dishes sub-tabs" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full gates + live end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite and gates**

Run: `deno task check`
Expected: format + lint + typecheck all clean.
Run: `deno task test`
Expected: all tests pass, including the six new test files.
Run: `deno task build`
Expected: production build succeeds.

- [ ] **Step 2: Seed + start the dev server for live verification**

Per the browser-e2e-setup notes, use an isolated KV so seeding is safe, seed a demo household, and run the worktree dev server. Example:
```bash
KV_PATH=./data/kv-e2e.db deno task db:seed
KV_PATH=./data/kv-e2e.db deno task dev
```
Then open the app in the in-app browser (create `.claude/launch.json` for `deno task dev` on its port if needed) and log in as the seeded user (or rely on dev auto-login if enabled in this worktree).

- [ ] **Step 3: Manual E2E on a mobile viewport**

Verify, in order:
1. `/menu` lands on **This week**, empty state: "No dishes yet" + "Add dishes".
2. Tap **Add dishes** → routes to `/menu/dishes` (the catalogue with the **Dishes** chip active).
3. Tap **Add** on a dish → button flips to **Added**.
4. Tap the **This week** chip → the dish appears as a row with its name, tag pills, and an **Any** day chip.
5. Tap the day chip → the "Pin to a day" sheet → pick **Wed** → the chip shows **Wed** and the row sorts to weekday order.
6. Add two more dishes; confirm ordering (pinned first Mon→Sun, then Any-day).
7. Tap a row's **✕** → it's removed (snackbar "Removed from this week").
8. Tap **Clear** → all removed (snackbar with **Undo**); tap **Undo** → dishes + pins return.
9. **Reload** the page → the plan persists (KV-backed).
10. Open a dish from the catalogue (`/menu/dishes` → tap a card body) → the dish editor (`/menu/{id}`) still opens correctly (route precedence intact).
11. Take a screenshot of This week with a few planned dishes and share it as proof.

- [ ] **Step 4: Final check**

Confirm `git status` is clean (all work committed across Tasks 1–9). If any verification-driven fix was needed, commit it:
```bash
git add -A
git commit -m "fix(menu): address weekly-menu live-verification findings" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §4 data model → Task 1. §5 ordering → Task 5 (`sortedEntries`) + Task 7. §6.1 repo → Task 2. §6.2 API → Task 3. §6.3 client → Task 4. §6.4 hook → Task 5. §6.5 sub-nav/islands/routes → Tasks 6, 7, 8, 9. §7 data flow → Tasks 5+9. §8 file plan → all tasks. §9 testing → Tasks 1–3, 5–8 (unit) + Task 10 (gates + live E2E). Goals (add/remove/pin/clear, household scoping, planner sub-tabs, plan default) → covered. Non-goals (suggestions, groceries, batch-select, reorder) → none implemented. ✅ No gaps.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N"; every code + test step is complete. ✅

**Type consistency:** `WeeklyMenuInterface`/`MenuEntryInterface`/`Weekday`/`WEEKDAY_ORDER` identical across model, repo, API, hook, islands. Repo/API/client method names match hook call sites (`addDish`, `setDay`, `removeEntry`, `clear`, `get`). Hook surface (`plannedDishIds`, `sortedEntries`, `addDish`, `removeDishFromPlan`, `removeEntry`, `setDay`, `clear`, `refresh`) matches usage in Tasks 7 & 8. `DishCatalogue` `initialMenu?` optional so existing tests/callers stay valid. ✅
