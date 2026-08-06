import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import webpush from "web-push";
import { isPushConfigured, sendToHousehold } from "./push-send.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";

Deno.env.set("KV_PATH", ":memory:");

// Generated per run rather than hardcoded: web-push validates the key format in
// setVapidDetails, so placeholder strings would throw before any send is
// attempted — and a real keypair in the repo would be a committed private key
// even if it is a throwaway.
const keys = webpush.generateVAPIDKeys();
const VAPID = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:dev@example.com",
};
function withVapid() {
  for (const [k, v] of Object.entries(VAPID)) Deno.env.set(k, v);
}
function withoutVapid() {
  for (const k of Object.keys(VAPID)) Deno.env.delete(k);
}

const payload = {
  title: "Book the venue",
  body: "Due now",
  tag: "todo-1",
  url: "/todos",
};

async function seedSub(householdId: string, endpoint: string) {
  await PushSubscriptionRepo.upsert({
    householdId,
    userId: "u1",
    endpoint,
    p256dh: "p",
    auth: "a",
    createdAt: "2026-08-05T10:00:00.000Z",
  });
}

Deno.test({
  name: "isPushConfigured — false without env, true with it",
  sanitizeResources: false,
  fn() {
    withoutVapid();
    assertEquals(isPushConfigured(), false);
    withVapid();
    assertEquals(isPushConfigured(), true);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — no-ops without VAPID env rather than throwing",
  sanitizeResources: false,
  async fn() {
    withoutVapid();
    await seedSub("hh-noenv", "https://push.example/a");

    const res = await sendToHousehold("hh-noenv", payload);

    assertEquals(res, { sent: 0, failed: 0 });
  },
});

Deno.test({
  name:
    "sendToHousehold — no-ops on a malformed VAPID key rather than throwing",
  sanitizeResources: false,
  async fn() {
    withVapid();
    Deno.env.set("VAPID_PUBLIC_KEY", "not-a-real-key");
    await seedSub("hh-badkey", "https://push.example/b");

    // A bad key must fail like a missing one: the sweep has already claimed the
    // fire-point, and a throw here would error every cron tick.
    const res = await sendToHousehold("hh-badkey", payload);

    assertEquals(res, { sent: 0, failed: 0 });
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — sends to every subscription in the household",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-send";
    await seedSub(hh, "https://push.example/one");
    await seedSub(hh, "https://push.example/two");
    using _s = stub(
      webpush,
      "sendNotification",
      () => Promise.resolve({ statusCode: 201 } as never),
    );

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 2, failed: 0 });
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — a 410 deletes that subscription",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-gone";
    await seedSub(hh, "https://push.example/dead");
    using _s = stub(webpush, "sendNotification", () => {
      const err = new Error("gone") as Error & { statusCode: number };
      err.statusCode = 410;
      return Promise.reject(err);
    });

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 0, failed: 1 });
    assertEquals(await PushSubscriptionRepo.getAll(hh), []);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — a 500 counts as failed but keeps the subscription",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-transient";
    await seedSub(hh, "https://push.example/flaky");
    using _s = stub(webpush, "sendNotification", () => {
      const err = new Error("server error") as Error & { statusCode: number };
      err.statusCode = 500;
      return Promise.reject(err);
    });

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 0, failed: 1 });
    assertEquals((await PushSubscriptionRepo.getAll(hh)).length, 1);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — uses supplied subscriptions instead of re-reading",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-supplied";
    await seedSub(hh, "https://push.example/stored");
    using _s = stub(
      webpush,
      "sendNotification",
      () => Promise.resolve({ statusCode: 201 } as never),
    );

    const res = await sendToHousehold(hh, payload, []);

    assertEquals(res, { sent: 0, failed: 0 });
    withoutVapid();
  },
});
