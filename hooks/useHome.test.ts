import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useHome } from "@/hooks/useHome.ts";
import type { HomeData } from "@/services/home.ts";

export const initial: HomeData = {
  todos: [{
    id: "t",
    householdId: "h",
    title: "Book dentist",
    dueAt: "2026-09-30T08:00:00Z",
    createdAt: "2026-09-01T08:00:00Z",
    createdBy: "m",
    assignedTo: null,
    completedBy: null,
    completedAt: null,
  }],
  members: [],
  menu: { householdId: "h", entries: [] },
  dishes: [],
  items: [],
  categories: [],
  lists: [{
    id: "l",
    householdId: "h",
    name: "Weekly",
    createdAt: "2026-09-01",
    createdBy: "m",
    entries: [],
  }],
};
Deno.test("Start — failed selection restores the list and transport failure restores a completed to-do", async () => {
  const home = useHome(initial);
  using _select = stub(
    api.shoppingLists,
    "setShowOnHome",
    () => Promise.resolve(null),
  );
  assertEquals(await home.selectList("l", true), false);
  assertEquals(home.data.value.lists[0].showOnHome, undefined);
  using _tick = stub(
    api.todos,
    "update",
    () => Promise.reject(new TypeError("offline")),
  );
  assertEquals(await home.complete("t"), false);
  assertEquals(home.todos.openTodos.value.map((t) => t.id), ["t"]);
});
Deno.test("Start — failed refresh preserves content; stale refresh cannot overwrite a newer selection", async () => {
  const home = useHome(initial);
  const _read = stub(api.home, "get", () => Promise.resolve(null));
  assertEquals(await home.refresh(), false);
  assertEquals(home.data.value.lists.length, 1);
  _read.restore();
  let finish!: (data: HomeData) => void;
  using _late = stub(api.home, "get", () =>
    new Promise((resolve) => {
      finish = resolve;
    }));
  const pending = home.refresh();
  using _save = stub(
    api.shoppingLists,
    "setShowOnHome",
    () => Promise.resolve({ ...initial.lists[0], showOnHome: true }),
  );
  await home.selectList("l", true);
  finish(initial);
  await pending;
  assertEquals(home.data.value.lists[0].showOnHome, true);
});
