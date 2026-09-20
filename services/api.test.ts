import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "./api.ts";

Deno.test("composed API — catalogue create preserves its request contract", async () => {
  using _fetch = stub(globalThis, "fetch", (url, init) => {
    assertEquals(url, "/api/shopping/catalogue");
    assertEquals(init?.method, "POST");
    assertEquals(JSON.parse(String(init?.body)), { name: "Milk" });
    return Promise.resolve(Response.json({ id: "i1", name: "Milk" }));
  });

  assertEquals(await api.items.create({ name: "Milk" }), {
    id: "i1",
    name: "Milk",
  });
});

Deno.test("composed API — member claim preserves its request contract", async () => {
  using _fetch = stub(globalThis, "fetch", (url, init) => {
    assertEquals(url, "/api/members/acting");
    assertEquals(init?.method, "PUT");
    assertEquals(JSON.parse(String(init?.body)), { memberId: "m1" });
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  assertEquals(await api.members.claim("m1"), true);
});

Deno.test("composed API — weekly menu day update preserves its request contract", async () => {
  using _fetch = stub(globalThis, "fetch", (url, init) => {
    assertEquals(url, "/api/menu/plan");
    assertEquals(init?.method, "PATCH");
    assertEquals(JSON.parse(String(init?.body)), {
      entryId: "e1",
      day: "Mon",
    });
    return Promise.resolve(Response.json({ householdId: "h1", entries: [] }));
  });

  assertEquals(await api.weeklyMenu.setDay("e1", "Mon"), {
    householdId: "h1",
    entries: [],
  });
});

Deno.test("composed API — card update preserves failure values", async () => {
  using _fetch = stub(globalThis, "fetch", (url, init) => {
    assertEquals(url, "/api/cards");
    assertEquals(init?.method, "PATCH");
    assertEquals(JSON.parse(String(init?.body)), {
      id: "c1",
      label: "Library",
      value: "123",
      format: "code128",
    });
    return Promise.resolve(new Response(null, { status: 400 }));
  });

  assertEquals(
    await api.cards.update("c1", {
      label: "Library",
      value: "123",
      format: "code128",
    }),
    null,
  );
});
