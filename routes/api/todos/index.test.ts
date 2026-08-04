import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/todos/index.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
}

function ctx(req: Request, state: State = {}): Context<State> {
  return { req, state } as unknown as Context<State>;
}

async function clearTodos() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["todos"] })) {
    await kv.delete(e.key);
  }
}

const AUTH: State = { userId: "u1", householdId: "h1" };

const post = (body: unknown) =>
  new Request("http://x/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST creates an open to-do (201); GET lists it for the household",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const createRes = await handler.POST(
      ctx(post({ title: "Take out the bins" }), AUTH),
    );
    assertEquals(createRes.status, 201);
    const created = await createRes.json();
    assertEquals(created.title, "Take out the bins");
    assertEquals(created.householdId, "h1");
    assertEquals(created.createdBy, "u1");
    assertEquals(created.completedAt, null);

    const listRes = await handler.GET(
      ctx(new Request("http://x/api/todos"), AUTH),
    );
    assertEquals(listRes.status, 200);
    const list = await listRes.json();
    assertEquals(list.map((t: { title: string }) => t.title), [
      "Take out the bins",
    ]);
  },
});

Deno.test({
  name: "POST trims the title and omits blank notes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const created = await (await handler.POST(
      ctx(post({ title: "  Call the dentist  ", notes: "   " }), AUTH),
    )).json();
    assertEquals(created.title, "Call the dentist");
    assertEquals(created.notes, undefined);
  },
});

Deno.test({
  name: "POST keeps notes when given",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const created = await (await handler.POST(
      ctx(post({ title: "Call the dentist", notes: "09 123 45 67" }), AUTH),
    )).json();
    assertEquals(created.notes, "09 123 45 67");
  },
});

Deno.test({
  name: "POST rejects a blank title (400)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.POST(ctx(post({ title: "   " }), AUTH))).status,
      400,
    );
    assertEquals((await handler.POST(ctx(post({}), AUTH))).status, 400);
  },
});

Deno.test({
  name: "GET and POST require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    assertEquals(
      (await handler.GET(ctx(new Request("http://x/api/todos")))).status,
      401,
    );
    assertEquals(
      (await handler.POST(ctx(post({ title: "x" })))).status,
      401,
    );
  },
});

Deno.test({
  name: "GET does not leak another household's to-dos",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    await handler.POST(
      ctx(post({ title: "Theirs" }), { userId: "u2", householdId: "h2" }),
    );
    const list = await (await handler.GET(
      ctx(new Request("http://x/api/todos"), AUTH),
    )).json();
    assertEquals(list, []);
  },
});
