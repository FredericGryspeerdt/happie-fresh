import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { unsubscribeThisDevice } from "./usePushNotifications.ts";

/**
 * Only `unsubscribeThisDevice` is covered here, and only its contract rather
 * than its happy path: the rest of the hook is permission prompts and
 * PushManager calls that this repo has no DOM harness for, so stubbing them
 * would test the stubs (see docs/ui-ux-patterns.md §14).
 *
 * This one function is different because **logging out depends on it never
 * throwing**. A rejection here would leave a member stuck on the More sheet,
 * which is worse than the subscription it was trying to remove.
 */

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
