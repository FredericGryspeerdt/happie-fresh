import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/todos/[id].ts";
import { TodoRepo } from "@/database/todo.repo.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
  actingMember?: MemberInterface;
}

function ctx(req: Request, id: string, state: State = {}): Context<State> {
  return { req, state, params: { id } } as unknown as Context<State>;
}

async function clearTodos() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["todos"] })) {
    await kv.delete(e.key);
  }
}

const MANAGER: MemberInterface = {
  id: "m-mgr",
  householdId: "h1",
  name: "Alex",
  color: "sky",
  emoji: "⭐",
  isManager: true,
};
const KID: MemberInterface = {
  id: "m-kid",
  householdId: "h1",
  name: "Bo",
  color: "meadow",
  emoji: "🐸",
  isManager: false,
};

// PATCH now requires an acting member, so the general-purpose auth fixture
// carries one — every existing PATCH test exercises that guard implicitly.
const AUTH: State = {
  userId: "u1",
  householdId: "h1",
  actingMember: MANAGER,
};
const AUTH_MANAGER: State = {
  userId: "u1",
  householdId: "h1",
  actingMember: MANAGER,
};
const AUTH_KID: State = { userId: "u1", householdId: "h1", actingMember: KID };

const patch = (body: unknown) =>
  new Request("http://x/api/todos/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = () => new Request("http://x/api/todos/x", { method: "DELETE" });

function seed(householdId = "h1", title = "Take out the bins") {
  return TodoRepo.create({
    householdId,
    title,
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
    completedAt: null,
    dueAt: null,
    assignedTo: null,
    completedBy: null,
  });
}

Deno.test({
  name: "PATCH updates the title",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ title: "  Take out the recycling  " }), todo.id, AUTH),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).title, "Take out the recycling");
  },
});

Deno.test({
  name: "PATCH ticks off and un-ticks via completedAt",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();

    const ticked = await (await handler.PATCH(
      ctx(patch({ completedAt: "2026-08-03T12:00:00.000Z" }), todo.id, AUTH),
    )).json();
    assertEquals(ticked.completedAt, "2026-08-03T12:00:00.000Z");

    const reopened = await (await handler.PATCH(
      ctx(patch({ completedAt: null }), todo.id, AUTH),
    )).json();
    assertEquals(reopened.completedAt, null);
  },
});

Deno.test({
  name: "PATCH can clear notes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await TodoRepo.create({
      householdId: "h1",
      title: "Call the dentist",
      notes: "09 123 45 67",
      createdBy: "u1",
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: null,
      dueAt: null,
      assignedTo: null,
      completedBy: null,
    });

    const cleared = await (await handler.PATCH(
      ctx(patch({ notes: "" }), todo.id, AUTH),
    )).json();
    assertEquals(cleared.notes, "");
  },
});

Deno.test({
  name: "PATCH rejects a blank title (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "  " }), todo.id, AUTH))).status,
      400,
    );
    const still = await TodoRepo.getById("h1", todo.id);
    assertEquals(still?.title, "Take out the bins");
  },
});

Deno.test({
  name: "PATCH rejects a non-string title (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: null }), todo.id, AUTH))).status,
      400,
    );
    const still = await TodoRepo.getById("h1", todo.id);
    assertEquals(still?.title, "Take out the bins");
  },
});

Deno.test({
  name:
    "PATCH rejects a non-string completedAt (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ completedAt: 123 }), todo.id, AUTH)))
        .status,
      400,
    );
    const still = await TodoRepo.getById("h1", todo.id);
    assertEquals(still?.completedAt, null);
  },
});

Deno.test({
  name: "PATCH ignores client-supplied createdBy and createdAt",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const updated = await (await handler.PATCH(
      ctx(
        patch({ createdBy: "hacker", createdAt: "1999-01-01T00:00:00.000Z" }),
        todo.id,
        AUTH,
      ),
    )).json();
    assertEquals(updated.createdBy, "u1");
    assertEquals(updated.createdAt, "2026-08-03T10:00:00.000Z");
  },
});

Deno.test({
  name: "PATCH on an unknown id is 404",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), "nope", AUTH))).status,
      404,
    );
  },
});

Deno.test({
  name: "DELETE removes the to-do (204), then 404",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    assertEquals(
      (await handler.DELETE(ctx(del(), todo.id, AUTH_MANAGER))).status,
      204,
    );
    assertEquals(
      (await handler.DELETE(ctx(del(), todo.id, AUTH_MANAGER))).status,
      404,
    );
    assertEquals(await TodoRepo.getById("h1", todo.id), null);
  },
});

Deno.test({
  name: "another household cannot patch or delete your to-do",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    // A manager acting member — otherwise the DELETE would 403 before the
    // household check ever ran, which isn't what this test is about.
    const theirs: State = {
      userId: "u2",
      householdId: "h2",
      actingMember: MANAGER,
    };

    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), todo.id, theirs))).status,
      404,
    );
    assertEquals(
      (await handler.DELETE(ctx(del(), todo.id, theirs))).status,
      404,
    );
    assertEquals(
      (await TodoRepo.getById("h1", todo.id))?.title,
      "Take out the bins",
    );
  },
});

Deno.test({
  name: "DELETE — a non-manager acting member gets 403",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.DELETE(ctx(del(), todo.id, AUTH_KID));
    assertEquals(res.status, 403);
    // Still there — nothing was deleted.
    assertEquals((await TodoRepo.getById("h1", todo.id))?.id, todo.id);
  },
});

Deno.test({
  name: "DELETE — a manager acting member deletes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.DELETE(ctx(del(), todo.id, AUTH_MANAGER));
    assertEquals(res.status, 204);
  },
});

Deno.test({
  name: "PATCH and DELETE require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.PATCH(ctx(patch({ title: "x" }), "any"))).status,
      401,
    );
    assertEquals((await handler.DELETE(ctx(del(), "any"))).status, 401);
  },
});

Deno.test({
  name: "PATCH sets dueAt, canonicalising to UTC",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await seed();
    const updated = await (await handler.PATCH(
      ctx(patch({ dueAt: "2026-08-05T18:00:00+02:00" }), t.id, AUTH),
    )).json();

    assertEquals(updated.dueAt, "2026-08-05T16:00:00.000Z");
  },
});

Deno.test({
  name: "PATCH clears dueAt with null",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await TodoRepo.create({
      householdId: "h1",
      title: "Book the venue",
      createdBy: "u1",
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: null,
      dueAt: "2026-08-10T09:00:00.000Z",
      assignedTo: null,
      completedBy: null,
    });

    const updated = await (await handler.PATCH(
      ctx(patch({ dueAt: null }), t.id, AUTH),
    )).json();

    assertEquals(updated.dueAt, null);
  },
});

Deno.test({
  name: "PATCH rejects an invalid dueAt (400) and leaves the to-do alone",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const t = await seed();
    assertEquals(
      (await handler.PATCH(ctx(patch({ dueAt: "nope" }), t.id, AUTH))).status,
      400,
    );
    assertEquals(
      (await handler.PATCH(ctx(patch({ dueAt: 7 }), t.id, AUTH))).status,
      400,
    );
    assertEquals((await TodoRepo.getById("h1", t.id))?.dueAt, null);
  },
});

Deno.test({
  name: "PATCH — assigns and unassigns a household member",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const member = await MemberRepo.create({
      householdId: "h1",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ assignedTo: member.id }), todo.id, AUTH_MANAGER),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).assignedTo, member.id);

    const cleared = await handler.PATCH(
      ctx(patch({ assignedTo: null }), todo.id, AUTH_MANAGER),
    );
    assertEquals((await cleared.json()).assignedTo, null);
  },
});

Deno.test({
  name: "PATCH — rejects a non-member assignee with 400",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ assignedTo: "not-a-member" }), todo.id, AUTH_MANAGER),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "PATCH — rejects an assignee from another household with 400",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    // A real member, but in a DIFFERENT household than the request.
    const stranger = await MemberRepo.create({
      householdId: "h-other",
      name: "Stranger",
      color: "slate",
      emoji: "🐼",
      isManager: false,
    });
    const todo = await seed();
    const res = await handler.PATCH(
      ctx(patch({ assignedTo: stranger.id }), todo.id, AUTH_MANAGER),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name:
    "PATCH — ticking off stamps completedBy with the acting member; un-ticking clears it",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const ticked = await (await handler.PATCH(
      ctx(
        patch({ completedAt: "2026-08-10T12:00:00.000Z" }),
        todo.id,
        AUTH_MANAGER,
      ),
    )).json();
    assertEquals(ticked.completedBy, MANAGER.id);

    const reopened = await (await handler.PATCH(
      ctx(patch({ completedAt: null }), todo.id, AUTH_MANAGER),
    )).json();
    assertEquals(reopened.completedBy, null);
  },
});

Deno.test({
  name: "PATCH — a client-sent completedBy is ignored",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await (await handler.PATCH(
      ctx(patch({ completedBy: "m-spoofed" }), todo.id, AUTH_MANAGER),
    )).json();
    assertEquals(res.completedBy, null);
  },
});

Deno.test({
  name:
    "PATCH — completedBy is stamped from the acting member even when a spoofed value rides along",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await (await handler.PATCH(
      ctx(
        patch({
          completedAt: "2026-08-10T12:00:00.000Z",
          completedBy: "m-spoofed",
        }),
        todo.id,
        AUTH_MANAGER,
      ),
    )).json();
    assertEquals(res.completedBy, MANAGER.id);
    assertEquals(res.completedAt, "2026-08-10T12:00:00.000Z");
  },
});
