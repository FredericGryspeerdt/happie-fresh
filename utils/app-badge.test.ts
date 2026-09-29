import { api } from "@/services/api.ts";
import { useTodos } from "@/hooks/useTodos.ts";
import type { TodoInterface } from "@/models/index.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import {
  clearAppBadgeOnLogout,
  startAppBadgeSync,
  todoBadgeRevision,
} from "./app-badge.ts";

function browser(supported = true) {
  const badges: number[] = [];
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const window = new EventTarget();
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (
    const [key, value] of Object.entries({
      document,
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
      navigator: supported
        ? {
          setAppBadge: (count: number) => {
            badges.push(count);
            return Promise.resolve();
          },
          clearAppBadge: () => {
            badges.push(0);
            return Promise.resolve();
          },
        }
        : {},
    })
  ) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  return {
    badges,
    document,
    window,
    [Symbol.dispose]() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

Deno.test("app badge refreshes on mount, persisted changes, resume and local midnight; stops on cleanup", async () => {
  using env = browser();
  using time = new FakeTime(new Date(2026, 8, 29, 23, 59, 59));
  let count = 3;
  const boundaries: string[] = [];
  using _fetch = stub(globalThis, "fetch", (input) => {
    boundaries.push(
      new URL(String(input), "https://happie.test").searchParams.get("before")!,
    );
    return Promise.resolve(Response.json({ count }));
  });
  const stop = startAppBadgeSync();
  try {
    await time.tickAsync(0);
    assertEquals(env.badges, [3]);
    assertEquals(boundaries[0], new Date(2026, 8, 30).toISOString());
    count = 0;
    todoBadgeRevision.value++;
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 0);
    count = 2;
    await time.tickAsync(1000);
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 2);
    assertEquals(boundaries.at(-1), new Date(2026, 9, 1).toISOString());
    count = 4;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 4);
  } finally {
    stop();
  }
  const reads = boundaries.length;
  todoBadgeRevision.value++;
  env.window.dispatchEvent(new Event("focus"));
  await time.tickAsync(86_400_000);
  assertEquals(boundaries.length, reads);
});

Deno.test("failed badge reads preserve the previous count; unsupported browsers do no work", async () => {
  using time = new FakeTime();
  let status = 200;
  let reads = 0;
  using _fetch = stub(globalThis, "fetch", () => {
    reads++;
    return Promise.resolve(
      status === 200
        ? Response.json({ count: 3 })
        : new Response(null, { status }),
    );
  });
  {
    using env = browser();
    const stop = startAppBadgeSync();
    try {
      await time.tickAsync(0);
      status = 500;
      todoBadgeRevision.value++;
      await time.tickAsync(0);
      assertEquals(env.badges, [3]);
    } finally {
      stop();
    }
  }
  {
    using env = browser(false);
    const before = reads;
    const stop = startAppBadgeSync();
    await time.tickAsync(0);
    stop();
    assertEquals(reads, before);
    assertEquals(env.badges, []);
  }
});

Deno.test("logout clears the badge and ignores an older in-flight response", async () => {
  using env = browser();
  using time = new FakeTime();
  let resolve!: (response: Response) => void;
  using _fetch = stub(globalThis, "fetch", () =>
    new Promise<Response>((r) => {
      resolve = r;
    }));
  const stop = startAppBadgeSync();
  try {
    await clearAppBadgeOnLogout();
    resolve(Response.json({ count: 9 }));
    await time.tickAsync(0);
    assertEquals(env.badges, [0]);
    env.window.dispatchEvent(new Event("focus"));
    todoBadgeRevision.value++;
    await time.tickAsync(0);
    assertEquals(env.badges, [0]);
  } finally {
    stop();
  }
});

Deno.test("an older app refresh cannot overwrite the newer badge", async () => {
  using env = browser();
  using time = new FakeTime();
  const resolve: Array<(response: Response) => void> = [];
  using _fetch = stub(globalThis, "fetch", () =>
    new Promise<Response>((r) => {
      resolve.push(r);
    }));
  const stop = startAppBadgeSync();
  try {
    todoBadgeRevision.value++;
    resolve[1](Response.json({ count: 2 }));
    await time.tickAsync(0);
    resolve[0](Response.json({ count: 9 }));
    await time.tickAsync(0);
    assertEquals(env.badges, [2]);
  } finally {
    stop();
  }
});

Deno.test("an active badge-capable worker owns foreground refreshes too", async () => {
  using env = browser();
  using time = new FakeTime();
  const messages: string[] = [];
  Object.assign(navigator, {
    serviceWorker: {
      getRegistration: () =>
        Promise.resolve({
          active: {
            postMessage: (message: { type: string }, ports: MessagePort[]) => {
              messages.push(message.type);
              ports[0].postMessage("app-badge-ready");
              ports[0].close();
            },
          },
        }),
    },
  });
  let reads = 0;
  using _fetch = stub(globalThis, "fetch", () => {
    reads++;
    return Promise.resolve(Response.json({ count: 9 }));
  });
  const stop = startAppBadgeSync();
  try {
    await time.tickAsync(0);
    await time.tickAsync(0);
    assertEquals(messages, ["refresh-app-badge"]);
    assertEquals(reads, 0);
    assertEquals(env.badges, []);
  } finally {
    stop();
  }
});

Deno.test("an older active worker that ignores badge messages falls back to window badging", async () => {
  using env = browser();
  using time = new FakeTime();
  Object.assign(navigator, {
    serviceWorker: {
      getRegistration: () =>
        Promise.resolve({ active: { postMessage: () => {} } }),
    },
  });
  using _fetch = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(Response.json({ count: 3 })),
  );
  const stop = startAppBadgeSync();
  try {
    await time.tickAsync(0);
    await time.tickAsync(1000);
    await time.tickAsync(0);
    assertEquals(env.badges, [3]);
  } finally {
    stop();
  }
});

Deno.test("backlog actions refresh the persisted badge after completion, undo, reschedule, delete, create and reload", async () => {
  using env = browser();
  using time = new FakeTime(new Date(2026, 8, 29, 12));
  const todo: TodoInterface = {
    id: "t1",
    householdId: "h1",
    title: "Dentist",
    createdBy: "m1",
    createdAt: "2026-09-01T10:00:00Z",
    dueAt: "2026-09-28T10:00:00Z",
    completedAt: null,
    assignedTo: null,
    completedBy: null,
  };
  let serverCount = 1;
  using _fetch = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(Response.json({ count: serverCount })),
  );
  using _update = stub(
    api.todos,
    "update",
    (_id, patch) => Promise.resolve({ ...todo, ...patch }),
  );
  using _delete = stub(api.todos, "delete", () => Promise.resolve(true));
  using _create = stub(
    api.todos,
    "create",
    () => Promise.resolve({ ...todo, id: "t2" }),
  );
  using _get = stub(api.todos, "getAll", () => Promise.resolve([]));
  const backlog = useTodos([todo]);
  const stop = startAppBadgeSync();
  try {
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 1);
    serverCount = 0;
    const completing = backlog.tickOff("t1");
    await time.tickAsync(300);
    await completing;
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 0);
    serverCount = 1;
    await backlog.unTick("t1");
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 1);
    serverCount = 0;
    await backlog.setDueAt("t1", "2026-10-01T10:00:00Z");
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 0);
    serverCount = 1;
    await backlog.setDueAt("t1", "2026-09-29T18:00:00Z");
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 1);
    serverCount = 0;
    const deleting = backlog.removeTodo("t1");
    await time.tickAsync(300);
    await deleting;
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 0);
    serverCount = 1;
    await backlog.addTodo({
      title: "Dentist",
      dueAt: todo.dueAt,
      assignedTo: null,
    });
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 1);
    serverCount = 0;
    await backlog.refresh();
    await time.tickAsync(0);
    assertEquals(env.badges.at(-1), 0);
  } finally {
    stop();
  }
});
