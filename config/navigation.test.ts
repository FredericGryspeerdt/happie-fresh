import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { resolveActiveTab } from "@/config/navigation.ts";

Deno.test("resolveActiveTab — /lists matches shopping-lists", () => {
  assertEquals(resolveActiveTab("/lists")?.id, "shopping-lists");
});

Deno.test("resolveActiveTab — /items matches shopping-lists", () => {
  assertEquals(resolveActiveTab("/items")?.id, "shopping-lists");
});

Deno.test("resolveActiveTab — /categories/manage matches shopping-lists", () => {
  assertEquals(resolveActiveTab("/categories/manage")?.id, "shopping-lists");
});

Deno.test("resolveActiveTab — /lists/some-id matches shopping-lists via prefix", () => {
  assertEquals(resolveActiveTab("/lists/some-id")?.id, "shopping-lists");
});

Deno.test("resolveActiveTab — /login matches no tab", () => {
  assertEquals(resolveActiveTab("/login"), undefined);
});
