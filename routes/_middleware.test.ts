import { assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV. getKv() reads KV_PATH lazily on first use (inside a
// repo method), so setting it here at module load is early enough. Each test
// creates its own users with distinct usernames because the process-wide KV
// singleton is shared. sanitizeResources is disabled for the same reason as the
// repo tests — the getKv() singleton is intentionally never closed.
Deno.env.set("KV_PATH", ":memory:");

import { handler } from "./_middleware.ts";
import { SessionRepo, UserRepo } from "@/database/index.ts";

type Ctx = Parameters<typeof handler>[0];

interface TestState {
  userId?: string;
  householdId?: string;
}

function makeCtx(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  const req = new Request(`http://localhost${path}`, { headers });
  const state: TestState = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
    return Promise.resolve(new Response("NEXT", { status: 200 }));
  };
  const ctx = { req, state, next } as unknown as Ctx;
  return { ctx, state, nextCalled: () => nextCalled };
}

/** Set env vars for the duration of fn, restoring previous values afterwards. */
async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void>,
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) prev[key] = Deno.env.get(key);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

const DEV = { DENO_DEPLOYMENT_ID: undefined };

Deno.test({
  name: "middleware — dev auto-login populates state and proceeds (no cookie)",
  sanitizeResources: false,
  async fn() {
    const user = await UserRepo.create({
      username: "mw-auto",
      passwordHash: "x",
    });
    await withEnv(
      { ...DEV, DEV_AUTOLOGIN: undefined, SEED_USERNAME: "mw-auto" },
      async () => {
        const { ctx, state, nextCalled } = makeCtx("/shopping");
        const res = await handler(ctx);
        assertEquals(nextCalled(), true);
        assertEquals(state.userId, user.id);
        assertEquals(state.householdId, user.householdId);
        assertEquals(res.status, 200);
      },
    );
  },
});

Deno.test({
  name: "middleware — dev auto-login redirects /login to /shopping",
  sanitizeResources: false,
  async fn() {
    await UserRepo.create({ username: "mw-login", passwordHash: "x" });
    await withEnv(
      { ...DEV, DEV_AUTOLOGIN: undefined, SEED_USERNAME: "mw-login" },
      async () => {
        const { ctx, nextCalled } = makeCtx("/login");
        const res = await handler(ctx);
        assertEquals(res.status, 303);
        assertEquals(res.headers.get("location"), "/shopping");
        assertEquals(nextCalled(), false);
      },
    );
  },
});

Deno.test({
  name: "middleware — no auto-login in production (redirects to /login)",
  sanitizeResources: false,
  async fn() {
    await withEnv(
      {
        DENO_DEPLOYMENT_ID: "deploy-1",
        DEV_AUTOLOGIN: undefined,
        SEED_USERNAME: "demo",
      },
      async () => {
        const { ctx, state, nextCalled } = makeCtx("/shopping");
        const res = await handler(ctx);
        assertEquals(res.status, 303);
        assertEquals(res.headers.get("location"), "/login");
        assertEquals(state.userId, undefined);
        assertEquals(nextCalled(), false);
      },
    );
  },
});

Deno.test({
  name: "middleware — DEV_AUTOLOGIN=false disables auto-login",
  sanitizeResources: false,
  async fn() {
    await withEnv(
      { ...DEV, DEV_AUTOLOGIN: "false", SEED_USERNAME: "demo" },
      async () => {
        const { ctx, state } = makeCtx("/shopping");
        const res = await handler(ctx);
        assertEquals(res.status, 303);
        assertEquals(res.headers.get("location"), "/login");
        assertEquals(state.userId, undefined);
      },
    );
  },
});

Deno.test({
  name: "middleware — dev auto-login falls through when user not seeded",
  sanitizeResources: false,
  async fn() {
    await withEnv(
      { ...DEV, DEV_AUTOLOGIN: undefined, SEED_USERNAME: "nobody-xyz" },
      async () => {
        const { ctx } = makeCtx("/shopping");
        const res = await handler(ctx);
        assertEquals(res.status, 303);
        assertEquals(res.headers.get("location"), "/login");
      },
    );
  },
});

Deno.test({
  name: "middleware — a real session still authenticates when auto-login off",
  sanitizeResources: false,
  async fn() {
    const user = await UserRepo.create({
      username: "mw-session",
      passwordHash: "x",
    });
    const session = await SessionRepo.create(user.id);
    await withEnv(
      { ...DEV, DEV_AUTOLOGIN: "false", SEED_USERNAME: undefined },
      async () => {
        const { ctx, state, nextCalled } = makeCtx(
          "/shopping",
          `sessionId=${session.id}`,
        );
        const res = await handler(ctx);
        assertEquals(nextCalled(), true);
        assertEquals(state.userId, user.id);
        assertEquals(state.householdId, user.householdId);
        assertEquals(res.status, 200);
      },
    );
  },
});

Deno.test({
  name: "middleware — API stays 401 in production without a session",
  sanitizeResources: false,
  async fn() {
    await withEnv(
      {
        DENO_DEPLOYMENT_ID: "deploy-1",
        DEV_AUTOLOGIN: undefined,
        SEED_USERNAME: undefined,
      },
      async () => {
        const { ctx } = makeCtx("/api/shopping/items");
        const res = await handler(ctx);
        assertEquals(res.status, 401);
      },
    );
  },
});
