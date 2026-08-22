import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/_middleware.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

const DAY_MS = 1000 * 60 * 60 * 24;

// The middleware only touches ctx.req, ctx.state, and ctx.next().
function fakeCtx(req: Request) {
  return {
    req,
    state: {},
    next: () => Promise.resolve(new Response("ok")),
  } as unknown as Parameters<typeof handler>[0];
}

function pageRequest(sessionId: string) {
  return new Request("http://localhost:8000/shopping", {
    headers: { cookie: `sessionId=${sessionId}` },
  });
}

Deno.test({
  name: "middleware — re-issues the cookie when the session is renewed",
  sanitizeResources: false,
  async fn() {
    const session = await SessionRepo.create("user-1");
    // Age the session so touch() has more than a day to gain.
    const kv = await getKv();
    const aged = { ...session, expiresAt: new Date(Date.now() + 28 * DAY_MS) };
    await kv.set(["sessions", session.id], aged);

    const response = await handler(fakeCtx(pageRequest(session.id)));

    assertEquals(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assertMatch(cookie, new RegExp(`^sessionId=${session.id};`));
    assertMatch(cookie, /HttpOnly/i);
    // Max-Age slid back out to ~30 days.
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)![1]);
    assertEquals(maxAge > 29 * 24 * 60 * 60, true);
    assertEquals(maxAge <= 30 * 24 * 60 * 60, true);
  },
});

Deno.test({
  name:
    "middleware — renewal capped by absoluteExpiresAt reaches the browser as a shorter Max-Age",
  sanitizeResources: false,
  async fn() {
    const session = await SessionRepo.create("user-1");
    // Near end of life: cap 10d away, sliding expiry down to 5d — touch()
    // should renew to the cap (~10d), not the full 30d idle window.
    const kv = await getKv();
    const capped = {
      ...session,
      expiresAt: new Date(Date.now() + 5 * DAY_MS),
      absoluteExpiresAt: new Date(Date.now() + 10 * DAY_MS),
    };
    await kv.set(["sessions", session.id], capped);

    const response = await handler(fakeCtx(pageRequest(session.id)));

    assertEquals(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)![1]);
    assertEquals(maxAge > 9 * 24 * 60 * 60, true);
    assertEquals(maxAge <= 10 * 24 * 60 * 60, true);
  },
});

Deno.test({
  name: "middleware — no Set-Cookie when renewal is throttled",
  sanitizeResources: false,
  async fn() {
    // Fresh session: expiry already at now + 30d, touch() returns null.
    const session = await SessionRepo.create("user-1");

    const response = await handler(fakeCtx(pageRequest(session.id)));

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("set-cookie"), null);
  },
});

Deno.test({
  name: "middleware — unknown session still redirects pages to /login",
  sanitizeResources: false,
  async fn() {
    const response = await handler(fakeCtx(pageRequest("no-such-session")));

    assertEquals(response.status, 303);
    assertEquals(response.headers.get("location"), "/login");
  },
});

Deno.test({
  name:
    "middleware — invalid session cookie gets cleared on the /login redirect",
  sanitizeResources: false,
  async fn() {
    const response = await handler(fakeCtx(pageRequest("no-such-session")));

    assertEquals(response.status, 303);
    // Without this, a dead 30-day cookie causes a KV miss on every request.
    const cookie = response.headers.get("set-cookie")!;
    assertMatch(cookie, /^sessionId=;/);
    assertMatch(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  },
});

Deno.test({
  name:
    "middleware — no Set-Cookie on the /login redirect without a session cookie",
  sanitizeResources: false,
  async fn() {
    const response = await handler(
      fakeCtx(new Request("http://localhost:8000/shopping")),
    );

    assertEquals(response.status, 303);
    assertEquals(response.headers.get("set-cookie"), null);
  },
});

Deno.test({
  name:
    "middleware — resolves actingMember to the login's own member when unclaimed",
  sanitizeResources: false,
  async fn() {
    const user = await UserRepo.create({
      username: "morgan",
      passwordHash: "x",
    });
    const session = await SessionRepo.create(user.id);
    const ctx = fakeCtx(pageRequest(session.id));

    const response = await handler(ctx);

    assertEquals(response.status, 200);
    assertEquals(ctx.state.actingClaimed, false);
    assertEquals(ctx.state.actingMember?.id, user.memberId);
  },
});

Deno.test({
  name: "middleware — unknown session still gets 401 on /api",
  sanitizeResources: false,
  async fn() {
    const req = new Request("http://localhost:8000/api/items", {
      headers: { cookie: "sessionId=no-such-session" },
    });

    const response = await handler(fakeCtx(req));

    assertEquals(response.status, 401);
  },
});
