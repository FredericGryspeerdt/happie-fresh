import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { usePushNotifications } from "./usePushNotifications.ts";

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
