import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { resolveActiveTab } from "@/config/navigation.ts";

Deno.test("resolveActiveTab — /shopping matches shopping", () => {
  assertEquals(resolveActiveTab("/shopping")?.id, "shopping");
});

Deno.test("resolveActiveTab — /shopping/catalogue matches shopping", () => {
  assertEquals(resolveActiveTab("/shopping/catalogue")?.id, "shopping");
});

Deno.test("resolveActiveTab — /shopping/categories matches shopping", () => {
  assertEquals(resolveActiveTab("/shopping/categories")?.id, "shopping");
});

Deno.test("resolveActiveTab — /shopping/some-id matches shopping via prefix", () => {
  assertEquals(resolveActiveTab("/shopping/some-id")?.id, "shopping");
});

Deno.test("resolveActiveTab — /shopping/catalogue/new matches shopping via deep prefix", () => {
  assertEquals(resolveActiveTab("/shopping/catalogue/new")?.id, "shopping");
});

Deno.test("resolveActiveTab — /login matches no tab", () => {
  assertEquals(resolveActiveTab("/login"), undefined);
});

Deno.test("resolveActiveTab — /shoppingExtra does not match (false-positive guard)", () => {
  assertEquals(resolveActiveTab("/shoppingExtra"), undefined);
});
