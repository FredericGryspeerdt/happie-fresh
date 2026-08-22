import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/shopping/lists/[id]/index.ts";
import { ShoppingListRepo } from "@/database/index.ts";
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

async function clearLists() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["shopping_lists"] })) {
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

const AUTH_MANAGER: State = {
  userId: "u1",
  householdId: "h1",
  actingMember: MANAGER,
};
const AUTH_KID: State = { userId: "u1", householdId: "h1", actingMember: KID };

const del = () =>
  new Request("http://x/api/shopping/lists/x", { method: "DELETE" });

function seed() {
  return ShoppingListRepo.create({
    householdId: "h1",
    name: "Weekly groceries",
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
  });
}

Deno.test({
  name: "DELETE — a non-manager acting member gets 403",
  sanitizeResources: false,
  async fn() {
    await clearLists();
    const list = await seed();
    const res = await handler.DELETE(ctx(del(), list.id, AUTH_KID));
    assertEquals(res.status, 403);
    // Still there — nothing was deleted.
    assertEquals((await ShoppingListRepo.getById("h1", list.id))?.id, list.id);
  },
});

Deno.test({
  name: "DELETE — a manager acting member deletes",
  sanitizeResources: false,
  async fn() {
    await clearLists();
    const list = await seed();
    const res = await handler.DELETE(ctx(del(), list.id, AUTH_MANAGER));
    assertEquals(res.status, 204);
  },
});
