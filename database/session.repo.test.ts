import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1.0.19";
import { SESSION_IDLE_TTL_MS, SessionRepo } from "@/database/session.repo.ts";
import { getKv } from "@/database/db.ts";
import { SessionInterface } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

const DAY_MS = 1000 * 60 * 60 * 24;
// Tolerance for "was computed from Date.now()" assertions.
const CLOCK_SLACK_MS = 5_000;

async function clearSessions() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["sessions"] })) {
    await kv.delete(e.key);
  }
}

// Overwrite a session in KV directly to simulate age/legacy shapes.
async function putSession(session: SessionInterface) {
  const kv = await getKv();
  await kv.set(["sessions", session.id], session);
}

Deno.test({
  name: "create — sets sliding expiry 30d out and absolute cap 90d out",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    assertEquals(SESSION_IDLE_TTL_MS, 30 * DAY_MS);
    assertAlmostEquals(
      new Date(session.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    assertAlmostEquals(
      new Date(session.absoluteExpiresAt!).getTime(),
      Date.now() + 90 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    const fetched = await SessionRepo.findById(session.id);
    assertEquals(fetched?.userId, "user-1");
  },
});

Deno.test({
  name: "touch — slides expiry back out to 30d and persists it",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    // Simulate a session last renewed 2 days ago: expiry sits at now + 28d.
    const aged = { ...session, expiresAt: new Date(Date.now() + 28 * DAY_MS) };
    await putSession(aged);

    const renewed = await SessionRepo.touch(aged);

    assertEquals(renewed !== null, true);
    assertAlmostEquals(
      new Date(renewed!.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    const persisted = await SessionRepo.findById(session.id);
    assertAlmostEquals(
      new Date(persisted!.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
  },
});

Deno.test({
  name: "touch — never extends past absoluteExpiresAt",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    // Near end of life: cap 10d away, sliding expiry down to 5d.
    const absolute = new Date(Date.now() + 10 * DAY_MS);
    const aged = {
      ...session,
      expiresAt: new Date(Date.now() + 5 * DAY_MS),
      absoluteExpiresAt: absolute,
    };
    await putSession(aged);

    const renewed = await SessionRepo.touch(aged);

    assertEquals(
      new Date(renewed!.expiresAt).getTime(),
      absolute.getTime(),
    );
  },
});

Deno.test({
  name: "touch — skips the write when less than a day would be gained",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    // Freshly created: expiry already at now + 30d, nothing to gain.
    const session = await SessionRepo.create("user-1");

    const renewed = await SessionRepo.touch(session);

    assertEquals(renewed, null);
    const persisted = await SessionRepo.findById(session.id);
    assertEquals(
      new Date(persisted!.expiresAt).getTime(),
      new Date(session.expiresAt).getTime(),
    );
  },
});

Deno.test({
  name: "touch — never renews legacy sessions without absoluteExpiresAt",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const legacy: SessionInterface = {
      id: crypto.randomUUID(),
      userId: "user-1",
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h left
    };
    await putSession(legacy);

    const renewed = await SessionRepo.touch(legacy);

    assertEquals(renewed, null);
    const persisted = await SessionRepo.findById(legacy.id);
    assertEquals(
      new Date(persisted!.expiresAt).getTime(),
      new Date(legacy.expiresAt).getTime(),
    );
  },
});
