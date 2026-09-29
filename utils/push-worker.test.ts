import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { runInNewContext } from "node:vm";

const source = await Deno.readTextFile(
  new URL("../static/push-sw.js", import.meta.url),
);

function worker(response: () => Promise<Response>, supported = true) {
  const handlers = new Map<string, (event: unknown) => void>();
  const badges: number[] = [];
  const notifications: unknown[] = [];
  const requests: string[] = [];
  const navigator = supported
    ? {
      setAppBadge: (n: number) => {
        badges.push(n);
        return Promise.resolve();
      },
      clearAppBadge: () => {
        badges.push(0);
        return Promise.resolve();
      },
    }
    : {};
  runInNewContext(source, {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      navigator,
      registration: {
        showNotification: (...args: unknown[]) => {
          notifications.push(args);
          return Promise.resolve();
        },
      },
    },
    navigator,
    URLSearchParams,
    fetch: (url: string) => {
      requests.push(url);
      return response();
    },
  });
  async function push() {
    let done = Promise.resolve();
    handlers.get("push")!({
      data: { json: () => ({ title: "Test", tag: "todo-1" }) },
      waitUntil: (promise: Promise<void>) => {
        done = promise;
      },
    });
    await done;
  }
  return { push, badges, notifications, requests, handlers };
}

Deno.test("push updates the app badge and still displays the notification", async () => {
  const sw = worker(() => Promise.resolve(Response.json({ count: 3 })));
  await sw.push();
  assertEquals(sw.badges, [3]);
  assertEquals(sw.notifications.length, 1);
  const before = new Date(
    new URL(sw.requests[0], "https://happie.test").searchParams.get("before")!,
  );
  assertEquals(before.getHours(), 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assertEquals(before.getDate(), tomorrow.getDate());
});

Deno.test("push clears a zero badge and preserves it on failed refresh", async () => {
  const zero = worker(() => Promise.resolve(Response.json({ count: 0 })));
  await zero.push();
  assertEquals(zero.badges, [0]);
  for (
    const response of [
      () => Promise.resolve(new Response(null, { status: 500 })),
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve(Response.json({ count: -1 })),
    ]
  ) {
    const sw = worker(response);
    await sw.push();
    assertEquals(sw.badges, []);
    assertEquals(sw.notifications.length, 1);
  }
});

Deno.test("push without Badging API still displays a notification without fetching", async () => {
  const sw = worker(() => Promise.reject(new Error("should not fetch")), false);
  await sw.push();
  assertEquals(sw.requests, []);
  assertEquals(sw.notifications.length, 1);
});

Deno.test("logout cancels a pending worker badge read", async () => {
  let resolve!: (response: Response) => void;
  const sw = worker(() =>
    new Promise<Response>((r) => {
      resolve = r;
    })
  );
  const push = sw.push();
  let cleared = Promise.resolve();
  sw.handlers.get("message")!({
    data: { type: "clear-app-badge" },
    waitUntil: (promise: Promise<void>) => {
      cleared = promise;
    },
  });
  await cleared;
  resolve(Response.json({ count: 8 }));
  await push;
  assertEquals(sw.badges, [0]);
  assertEquals(sw.notifications.length, 1);
});

Deno.test("concurrent pushes cannot replace a newer count with an older response", async () => {
  const resolve: Array<(response: Response) => void> = [];
  const sw = worker(() =>
    new Promise<Response>((r) => {
      resolve.push(r);
    })
  );
  const first = sw.push();
  const second = sw.push();
  resolve[1](Response.json({ count: 2 }));
  await second;
  resolve[0](Response.json({ count: 9 }));
  await first;
  assertEquals(sw.badges, [2]);
});

Deno.test("a foreground refresh supersedes a pending push count", async () => {
  const resolve: Array<(response: Response) => void> = [];
  const sw = worker(() =>
    new Promise<Response>((r) => {
      resolve.push(r);
    })
  );
  const push = sw.push();
  let refresh = Promise.resolve();
  const replies: string[] = [];
  sw.handlers.get("message")!({
    data: { type: "refresh-app-badge" },
    ports: [{ postMessage: (reply: string) => replies.push(reply) }],
    waitUntil: (promise: Promise<void>) => {
      refresh = promise;
    },
  });
  assertEquals(replies, ["app-badge-ready"]);
  resolve[1](Response.json({ count: 0 }));
  await refresh;
  resolve[0](Response.json({ count: 1 }));
  await push;
  assertEquals(sw.badges, [0]);
});
