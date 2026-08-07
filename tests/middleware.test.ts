import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/_middleware.ts";
import { SessionRepo } from "@/database/session.repo.ts";
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
