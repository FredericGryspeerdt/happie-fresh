import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  unsubscribeThisDevice,
  usePushNotifications,
} from "./usePushNotifications.ts";

let order: string[] = [];
let sentBody = "";
let sentMethod = "";

// Deno defines `navigator` but not `navigator.serviceWorker`, so these stubs
// install one and restore whatever was there afterwards.
function withServiceWorker(
  impl: unknown,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const had = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    Object.defineProperty(navigator, "serviceWorker", {
      value: impl,
      configurable: true,
      writable: true,
    });
    try {
      await fn();
    } finally {
      if (had) Object.defineProperty(navigator, "serviceWorker", had);
      else {delete (navigator as unknown as Record<string, unknown>)
          .serviceWorker;}
    }
  };
}

Deno.test(
  "unsubscribeThisDevice — reports false when the browser has no service worker support",
  async () => {
    // No stub installed at all: the guard must short-circuit rather than throw
    // on `navigator.serviceWorker.getRegistration`.
    assertEquals(await unsubscribeThisDevice(), false);
  },
);

Deno.test(
  "unsubscribeThisDevice — reports false when this device was never subscribed",
  withServiceWorker(
    { getRegistration: () => Promise.resolve(undefined) },
    async () => {
      assertEquals(await unsubscribeThisDevice(), false);
    },
  ),
);

Deno.test(
  "unsubscribeThisDevice — deletes server-side with the endpoint, then unsubscribes locally",
  withServiceWorker({
    getRegistration: () =>
      Promise.resolve({
        pushManager: {
          getSubscription: () =>
            Promise.resolve({
              endpoint: "https://push.example/abc",
              unsubscribe: () => {
                order.push("unsubscribe");
                return Promise.resolve(true);
              },
            }),
        },
      }),
  }, async () => {
    order = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
      order.push("delete");
      sentBody = String(init?.body ?? "");
      sentMethod = init?.method ?? "";
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    try {
      assertEquals(await unsubscribeThisDevice(), true);
      assertEquals(sentMethod, "DELETE");
      assertEquals(JSON.parse(sentBody).endpoint, "https://push.example/abc");
      // Server first: unsubscribing locally before the DELETE lands would lose
      // the endpoint the server needs to identify the row.
      assertEquals(order, ["delete", "unsubscribe"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }),
);

Deno.test(
  "unsubscribeThisDevice — swallows a failing DELETE so logging out is never blocked",
  withServiceWorker({
    getRegistration: () =>
      Promise.resolve({
        pushManager: {
          getSubscription: () =>
            Promise.resolve({
              endpoint: "https://push.example/abc",
              unsubscribe: () => Promise.resolve(true),
            }),
        },
      }),
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("offline"));
    try {
      // The member is offline: they must still be able to log out.
      assertEquals(await unsubscribeThisDevice(), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }),
);

/**
 * Stands in for a browser whose notification permission is already granted but
 * which holds no push subscription — the state a restored phone lands in: the
 * permission travels with the backup, the device-bound push endpoint does not.
 */
function withGrantedBrowser(run: (calls: string[]) => Promise<void>) {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document,
    PushManager: g.PushManager,
    Notification: g.Notification,
    fetch: globalThis.fetch,
    serviceWorker: Object.getOwnPropertyDescriptor(navigator, "serviceWorker"),
  };

  const calls: string[] = [];
  const subscription = {
    endpoint: "https://push.example/new-device",
    toJSON: () => ({ keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
  };
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(null),
      subscribe: () => Promise.resolve(subscription),
    },
  };

  g.document = {};
  g.PushManager = class {};
  g.Notification = { permission: "granted" };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: () => Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration),
    },
  });
  globalThis.fetch = (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let body = "";
    if (url === "/api/push/subscriptions" && init?.body) {
      body = " " + JSON.parse(String(init.body)).endpoint;
    }
    calls.push(`${method} ${url}${body}`);

    if (url === "/api/push/vapid-key") {
      return Promise.resolve(Response.json({ publicKey: "AAAA" }));
    }
    if (url === "/api/push/test") {
      return Promise.resolve(Response.json({ sent: 1, failed: 0 }));
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  };

  return run(calls).finally(() => {
    if (saved.document === undefined) delete g.document;
    else g.document = saved.document;
    if (saved.PushManager === undefined) delete g.PushManager;
    else g.PushManager = saved.PushManager;
    if (saved.Notification === undefined) delete g.Notification;
    else g.Notification = saved.Notification;
    globalThis.fetch = saved.fetch;
    if (saved.serviceWorker) {
      Object.defineProperty(navigator, "serviceWorker", saved.serviceWorker);
    } else {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });
}

Deno.test("sendTest — registers this device before asking the server to send", async () => {
  await withGrantedBrowser(async (calls) => {
    const { sendTest } = usePushNotifications();

    const actual = await sendTest();

    const expected = { sent: 1, failed: 0 };
    assertEquals(actual, expected);
    assertEquals(calls, [
      "GET /api/push/vapid-key",
      "POST /api/push/subscriptions https://push.example/new-device",
      "POST /api/push/test",
    ]);
  });
});

Deno.test("sendTest — reports failure when this device cannot be registered", async () => {
  await withGrantedBrowser(async (calls) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      if (String(input) === "/api/push/subscriptions") {
        calls.push("POST /api/push/subscriptions (rejected)");
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return realFetch(input, init);
    };

    const { sendTest } = usePushNotifications();

    const actual = await sendTest();

    assertEquals(actual, null);
    assertEquals(calls.includes("POST /api/push/test"), false);
  });
});
