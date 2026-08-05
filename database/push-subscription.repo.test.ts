import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import type { CreatePushSubscriptionDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use, and no repo method runs until a test body does — so setting it here
// at module load is early enough. Each test uses a distinct householdId because
// the KV singleton is process-wide.
Deno.env.set("KV_PATH", ":memory:");

// sanitizeResources is disabled because getKv() opens a module-level KV
// singleton lazily and never closes it (by design, as in production).

function draft(
  householdId: string,
  endpoint: string,
  overrides: Partial<CreatePushSubscriptionDto> = {},
): CreatePushSubscriptionDto {
  return {
    householdId,
    userId: "user-1",
    endpoint,
    p256dh: "p256dh-value",
    auth: "auth-value",
    createdAt: "2026-08-05T10:00:00.000Z",
    ...overrides,
  };
}

Deno.test({
  name: "upsert — stores a subscription and derives the id from the endpoint",
  sanitizeResources: false,
  async fn() {
    const sub = await PushSubscriptionRepo.upsert(
      draft("hh-up", "https://push.example/one"),
    );

    assertEquals(sub.endpoint, "https://push.example/one");
    assertEquals(sub.id.length, 64);
    assertEquals((await PushSubscriptionRepo.getAll("hh-up")).length, 1);
  },
});

Deno.test({
  name: "upsert — re-subscribing the same endpoint does not duplicate",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-dupe";
    const first = await PushSubscriptionRepo.upsert(
      draft(hh, "https://push.example/same"),
    );
    const second = await PushSubscriptionRepo.upsert(
      draft(hh, "https://push.example/same", { auth: "rotated-auth" }),
    );

    assertEquals(first.id, second.id);
    const all = await PushSubscriptionRepo.getAll(hh);
    assertEquals(all.length, 1);
    assertEquals(all[0].auth, "rotated-auth");
  },
});

Deno.test({
  name: "getAll — households are isolated",
  sanitizeResources: false,
  async fn() {
    await PushSubscriptionRepo.upsert(
      draft("hh-mine", "https://push.example/m"),
    );
    await PushSubscriptionRepo.upsert(
      draft("hh-theirs", "https://push.example/t"),
    );

    const mine = await PushSubscriptionRepo.getAll("hh-mine");
    assertEquals(mine.map((s) => s.endpoint), ["https://push.example/m"]);
  },
});

Deno.test({
  name: "deleteByEndpoint — removes it and reports whether it existed",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-del";
    await PushSubscriptionRepo.upsert(draft(hh, "https://push.example/gone"));

    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint(
        hh,
        "https://push.example/gone",
      ),
      true,
    );
    assertEquals(await PushSubscriptionRepo.getAll(hh), []);
    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint(
        hh,
        "https://push.example/gone",
      ),
      false,
    );
  },
});

Deno.test({
  name: "deleteByEndpoint — cannot delete another household's subscription",
  sanitizeResources: false,
  async fn() {
    await PushSubscriptionRepo.upsert(
      draft("hh-a", "https://push.example/shared"),
    );

    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint(
        "hh-b",
        "https://push.example/shared",
      ),
      false,
    );
    assertEquals((await PushSubscriptionRepo.getAll("hh-a")).length, 1);
  },
});
