import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/cards/index.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
  actingMember?: MemberInterface;
}

function ctx(req: Request, state: State = {}): Context<State> {
  return { req, state } as unknown as Context<State>;
}

async function clearCards() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["loyalty_cards"] })) {
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

const AUTH: State = { userId: "u1", householdId: "h1", actingMember: MANAGER };
const AUTH_MANAGER: State = {
  userId: "u1",
  householdId: "h1",
  actingMember: MANAGER,
};
const AUTH_KID: State = { userId: "u1", householdId: "h1", actingMember: KID };

const post = (body: unknown) =>
  new Request("http://x/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = (body: unknown) =>
  new Request("http://x/api/cards", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const patch = (body: unknown) =>
  new Request("http://x/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const validCard = {
  label: "Delhaize",
  value: "9520123456788",
  format: "ean13",
  color: "teal",
};

Deno.test({
  name: "POST creates (201), GET lists it for the household",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const createRes = await handler.POST(ctx(post(validCard), AUTH));
    assertEquals(createRes.status, 201);
    const created = await createRes.json();
    assertEquals(created.label, "Delhaize");
    assertEquals(created.householdId, "h1");
    assertEquals(created.createdBy, "m-mgr");

    const listRes = await handler.GET(
      ctx(new Request("http://x/api/cards"), AUTH),
    );
    assertEquals(listRes.status, 200);
    const list = await listRes.json();
    assertEquals(list.map((c: { label: string }) => c.label), ["Delhaize"]);
  },
});

Deno.test({
  name: "POST — stamps createdBy with the acting member",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const res = await handler.POST(
      ctx(post(validCard), {
        userId: "u1",
        householdId: "h-attr",
        actingMember: { ...MANAGER, householdId: "h-attr" },
      }),
    );
    assertEquals(res.status, 201);
    assertEquals((await res.json()).createdBy, "m-mgr");
  },
});

Deno.test({
  name: "GET / POST / DELETE require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    assertEquals(
      (await handler.GET(ctx(new Request("http://x/api/cards")))).status,
      401,
    );
    assertEquals((await handler.POST(ctx(post(validCard)))).status, 401);
    assertEquals(
      (await handler.DELETE(ctx(del({ id: "x" })))).status,
      401,
    );
  },
});

Deno.test({
  name: "GET does not leak other households' cards",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    await handler.POST(
      ctx(post(validCard), {
        userId: "u2",
        householdId: "h2",
        actingMember: MANAGER,
      }),
    );
    const listRes = await handler.GET(
      ctx(new Request("http://x/api/cards"), AUTH),
    );
    assertEquals(await listRes.json(), []);
  },
});

Deno.test({
  name: "POST rejects missing label (400)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const res = await handler.POST(
      ctx(post({ ...validCard, label: "  " }), AUTH),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "POST rejects an unknown format (400)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const res = await handler.POST(
      ctx(post({ ...validCard, format: "bogus" }), AUTH),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "POST rejects a value that fails its symbology's validation (400)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    // Wrong EAN-13 check digit.
    const res = await handler.POST(
      ctx(post({ ...validCard, value: "9520123456789" }), AUTH),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "DELETE removes a card (204); missing id is 400",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await (await handler.POST(ctx(post(validCard), AUTH)))
      .json();
    assertEquals(
      (await handler.DELETE(ctx(del({ id: created.id }), AUTH_MANAGER)))
        .status,
      204,
    );
    assertEquals(
      (await handler.DELETE(ctx(del({}), AUTH_MANAGER))).status,
      400,
    );
    const list = await (await handler.GET(
      ctx(new Request("http://x/api/cards"), AUTH),
    )).json();
    assertEquals(list, []);
  },
});

Deno.test({
  name: "DELETE — a non-manager acting member gets 403",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await (await handler.POST(ctx(post(validCard), AUTH)))
      .json();
    const res = await handler.DELETE(
      ctx(del({ id: created.id }), AUTH_KID),
    );
    assertEquals(res.status, 403);
    // Still there — nothing was deleted.
    const list = await (await handler.GET(
      ctx(new Request("http://x/api/cards"), AUTH),
    )).json();
    assertEquals(list.map((c: { id: string }) => c.id), [created.id]);
  },
});

Deno.test({
  name: "DELETE — a manager acting member deletes",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await (await handler.POST(ctx(post(validCard), AUTH)))
      .json();
    const res = await handler.DELETE(
      ctx(del({ id: created.id }), AUTH_MANAGER),
    );
    assertEquals(res.status, 204);
  },
});

Deno.test({
  name: "PATCH updates a card's fields (200) and persists them",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await (await handler.POST(ctx(post(validCard), AUTH)))
      .json();
    const res = await handler.PATCH(
      ctx(
        patch({
          id: created.id,
          label: "Delhaize Plus",
          value: "4006381333931",
          format: "ean13",
          color: "rose",
        }),
        AUTH,
      ),
    );
    assertEquals(res.status, 200);
    const updated = await res.json();
    assertEquals(updated.label, "Delhaize Plus");
    assertEquals(updated.value, "4006381333931");
    assertEquals(updated.color, "rose");
    // id/householdId are untouched.
    assertEquals(updated.id, created.id);
    assertEquals(updated.householdId, "h1");

    const list = await (await handler.GET(
      ctx(new Request("http://x/api/cards"), AUTH),
    )).json();
    assertEquals(list.length, 1);
    assertEquals(list[0].label, "Delhaize Plus");
  },
});

Deno.test({
  name: "PATCH requires a household (401) and an id (400)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    assertEquals(
      (await handler.PATCH(ctx(patch({ ...validCard, id: "x" })))).status,
      401,
    );
    assertEquals(
      (await handler.PATCH(ctx(patch({ ...validCard }), AUTH))).status,
      400,
    );
  },
});

Deno.test({
  name: "PATCH rejects an invalid value (400)",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await (await handler.POST(ctx(post(validCard), AUTH)))
      .json();
    const res = await handler.PATCH(
      ctx(
        patch({ ...validCard, id: created.id, value: "9520123456789" }),
        AUTH,
      ),
    );
    assertEquals(res.status, 400);
  },
});

Deno.test({
  name: "PATCH returns 404 for an unknown id and never crosses households",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    // Unknown id.
    assertEquals(
      (await handler.PATCH(ctx(patch({ ...validCard, id: "nope" }), AUTH)))
        .status,
      404,
    );
    // A card owned by another household must be invisible to this one.
    const theirs = await (await handler.POST(
      ctx(post(validCard), {
        userId: "u2",
        householdId: "h2",
        actingMember: MANAGER,
      }),
    )).json();
    assertEquals(
      (await handler.PATCH(
        ctx(patch({ ...validCard, id: theirs.id, label: "Hijacked" }), AUTH),
      )).status,
      404,
    );
  },
});
