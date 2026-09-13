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
  "unsubscribeThisDevice — succeeds when this device was never subscribed",
  withServiceWorker(
    { getRegistration: () => Promise.resolve(undefined) },
    async () => {
      assertEquals(await unsubscribeThisDevice(), true);
    },
  ),
);

Deno.test(
  "unsubscribeThisDevice — revokes locally and deletes the captured endpoint server-side",
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
      assertEquals(order, ["unsubscribe", "delete"]);
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
    localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    sessionStorage: Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage",
    ),
    serviceWorker: Object.getOwnPropertyDescriptor(navigator, "serviceWorker"),
  };

  const calls: string[] = [];
  let subscribed = false;
  const subscription = {
    unsubscribe: () => {
      subscribed = false;
      calls.push("unsubscribe");
      return Promise.resolve(true);
    },
    endpoint: "https://push.example/new-device",
    toJSON: () => ({ keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
  };
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(subscribed ? subscription : null),
      subscribe: () => {
        subscribed = true;
        return Promise.resolve(subscription);
      },
    },
  };

  for (const key of ["localStorage", "sessionStorage"]) {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  }
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
    for (const key of ["localStorage", "sessionStorage"] as const) {
      const descriptor = saved[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete g[key];
    }
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

Deno.test("syncIfGranted — retries an HTTP failure instead of caching it", async () => {
  await withGrantedBrowser(async (calls) => {
    const push = usePushNotifications();
    const fetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response(null, { status: 500 }));
    await push.syncIfGranted();
    globalThis.fetch = fetch;
    await push.syncIfGranted();
    assertEquals(
      calls.includes(
        "POST /api/push/subscriptions https://push.example/new-device",
      ),
      true,
    );
  });
});

Deno.test("disable — automatic recovery respects explicit opt-out across page loads", async () => {
  await withGrantedBrowser(async (calls) => {
    const push = usePushNotifications();
    await push.syncIfGranted();
    await push.disable();
    calls.length = 0;
    await usePushNotifications().syncIfGranted();
    assertEquals(calls, []);
  });
});

Deno.test("logout — recovery registers again after cleanup in the same tab", async () => {
  await withGrantedBrowser(async (calls) => {
    await usePushNotifications().syncIfGranted();
    await unsubscribeThisDevice();
    calls.length = 0;
    await usePushNotifications().syncIfGranted();
    assertEquals(
      calls.includes(
        "POST /api/push/subscriptions https://push.example/new-device",
      ),
      true,
    );
  });
});

Deno.test("logout — local unsubscribe still runs when server DELETE fails", async () => {
  await withGrantedBrowser(async (calls) => {
    await usePushNotifications().syncIfGranted();
    globalThis.fetch = () => Promise.reject(new Error("offline"));
    assertEquals(await unsubscribeThisDevice(), false);
    assertEquals(calls.includes("unsubscribe"), true);
  });
});

Deno.test("logout — invalidates startup recovery waiting for the public key", async () => {
  await withGrantedBrowser(async (calls) => {
    const fetch = globalThis.fetch;
    const key = Promise.withResolvers<Response>();
    globalThis.fetch = (input, init) =>
      String(input) === "/api/push/vapid-key"
        ? key.promise
        : fetch(input, init);
    const syncing = usePushNotifications().syncIfGranted();
    const stopping = unsubscribeThisDevice();
    key.resolve(Response.json({ publicKey: "AAAA" }));
    await Promise.all([syncing, stopping]);
    assertEquals(calls.some((call) => call.startsWith("POST")), false);
  });
});

Deno.test("disable — exposes an off state and allows an explicit re-enable", async () => {
  await withGrantedBrowser(async () => {
    const push = usePushNotifications();
    await push.syncIfGranted();
    await push.disable();
    assertEquals(push.state.value, "disabled");
    Object.assign(Notification, {
      requestPermission: () => Promise.resolve("granted"),
    });
    assertEquals(await push.enable(), true);
    assertEquals(push.state.value, "granted");
  });
});

Deno.test("logout — invalidates another tab's successful recovery marker", async () => {
  await withGrantedBrowser(async (calls) => {
    await usePushNotifications().syncIfGranted();
    const otherTabMarker = sessionStorage.getItem("happie:push-synced")!;
    await unsubscribeThisDevice();
    sessionStorage.setItem("happie:push-synced", otherTabMarker);
    calls.length = 0;
    await usePushNotifications().syncIfGranted();
    assertEquals(calls.some((call) => call.startsWith("POST")), true);
  });
});

Deno.test("logout — invalidates enable waiting for notification permission", async () => {
  await withGrantedBrowser(async (calls) => {
    const permission = Promise.withResolvers<NotificationPermission>();
    Object.assign(Notification, {
      requestPermission: () => permission.promise,
    });
    const enabling = usePushNotifications().enable();
    await unsubscribeThisDevice();
    permission.resolve("granted");
    assertEquals(await enabling, false);
    assertEquals(calls.some((call) => call.startsWith("POST")), false);
  });
});
