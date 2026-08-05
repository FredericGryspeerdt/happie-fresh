import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/push/subscriptions.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
}

function ctx(req: Request, state: State = {}): Context<State> {
  return { req, state } as unknown as Context<State>;
}

async function clearSubs() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["push_subscriptions"] })) {
    await kv.delete(e.key);
  }
}

const AUTH: State = { userId: "u1", householdId: "h1" };
const valid = {
  endpoint: "https://push.example/abc",
  p256dh: "p256dh-value",
  auth: "auth-value",
};

const post = (body: unknown) =>
  new Request("http://x/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const del = (body: unknown) =>
  new Request("http://x/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST stores a subscription (201) with server-derived fields",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    const res = await handler.POST(ctx(post(valid), AUTH));
    assertEquals(res.status, 201);
    const stored = await res.json();

    assertEquals(stored.householdId, "h1");
    assertEquals(stored.userId, "u1");
    assertEquals(stored.endpoint, valid.endpoint);
    assertEquals(stored.id.length, 64);
  },
});

Deno.test({
  name: "POST twice for the same endpoint does not duplicate",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));
    await handler.POST(ctx(post(valid), AUTH));

    assertEquals((await PushSubscriptionRepo.getAll("h1")).length, 1);
  },
});

Deno.test({
  name: "POST rejects a malformed body (400)",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    for (
      const bad of [
        {},
        { endpoint: "https://x/y" },
        { endpoint: "https://x/y", p256dh: "p" },
        { endpoint: 7, p256dh: "p", auth: "a" },
      ]
    ) {
      assertEquals((await handler.POST(ctx(post(bad), AUTH))).status, 400);
    }
  },
});

Deno.test({
  name: "DELETE removes it (204); an unknown endpoint is 404",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));

    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), AUTH)))
        .status,
      204,
    );
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), AUTH)))
        .status,
      404,
    );
  },
});

Deno.test({
  name: "another household cannot delete your subscription",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));

    const theirs: State = { userId: "u2", householdId: "h2" };
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), theirs)))
        .status,
      404,
    );
    assertEquals((await PushSubscriptionRepo.getAll("h1")).length, 1);
  },
});

Deno.test({
  name: "POST and DELETE require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    assertEquals((await handler.POST(ctx(post(valid)))).status, 401);
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint })))).status,
      401,
    );
  },
});
