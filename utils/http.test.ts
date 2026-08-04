import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { badRequest, json, noContent, notFound } from "./http.ts";

Deno.test("json — serialises the body with a JSON content type and default 200", async () => {
  const res = json({ ok: true });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("json — honours an explicit status", async () => {
  const res = json({ id: "a" }, 201);
  assertEquals(res.status, 201);
  assertEquals(await res.json(), { id: "a" });
});

Deno.test("noContent — 204 with an empty body", async () => {
  const res = noContent();
  assertEquals(res.status, 204);
  assertEquals(await res.text(), "");
});

Deno.test("badRequest — 400 carrying the message", async () => {
  const res = badRequest("title required");
  assertEquals(res.status, 400);
  assertEquals(await res.text(), "title required");
});

Deno.test("notFound — 404, with a default message", async () => {
  assertEquals(notFound().status, 404);
  assertEquals(await notFound().text(), "Not found");
  assertEquals(await notFound("no such to-do").text(), "no such to-do");
});
