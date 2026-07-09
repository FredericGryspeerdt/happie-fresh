import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { NAV_CONFIG, resolveActiveTab } from "@/config/navigation.ts";

// Config shape

Deno.test("NAV_CONFIG has 5 tabs", () => {
  assertEquals(NAV_CONFIG.length, 5);
});

Deno.test("NAV_CONFIG tab ids are home, shopping, todos, menu, more", () => {
  assertEquals(
    NAV_CONFIG.map((t) => t.id),
    ["home", "shopping", "todos", "menu", "more"],
  );
});

Deno.test("each NavItem has an iconName", () => {
  for (const item of NAV_CONFIG) {
    assertEquals(typeof item.iconName, "string");
  }
});

Deno.test("shopping tab has label 'Shop' and iconName 'cart'", () => {
  const shopping = NAV_CONFIG.find((t) => t.id === "shopping");
  assertEquals(shopping?.label, "Shop");
  assertEquals(shopping?.iconName, "cart");
});

// resolveActiveTab — exact matches

Deno.test("resolveActiveTab — /home matches home", () => {
  assertEquals(resolveActiveTab("/home")?.id, "home");
});

Deno.test("resolveActiveTab — /shopping matches shopping", () => {
  assertEquals(resolveActiveTab("/shopping")?.id, "shopping");
});

Deno.test("resolveActiveTab — /todos matches todos", () => {
  assertEquals(resolveActiveTab("/todos")?.id, "todos");
});

Deno.test("resolveActiveTab — /menu matches menu", () => {
  assertEquals(resolveActiveTab("/menu")?.id, "menu");
});

Deno.test("resolveActiveTab — /more matches more", () => {
  assertEquals(resolveActiveTab("/more")?.id, "more");
});

// resolveActiveTab — prefix matching

Deno.test("resolveActiveTab — /shopping/some-id matches shopping via prefix", () => {
  assertEquals(resolveActiveTab("/shopping/some-id")?.id, "shopping");
});

Deno.test("resolveActiveTab — /shopping/catalogue/new matches shopping via deep prefix", () => {
  assertEquals(resolveActiveTab("/shopping/catalogue/new")?.id, "shopping");
});

Deno.test("resolveActiveTab — /todos/123 matches todos via prefix", () => {
  assertEquals(resolveActiveTab("/todos/123")?.id, "todos");
});

// resolveActiveTab — no match / false-positive guards

Deno.test("resolveActiveTab — /login matches no tab", () => {
  assertEquals(resolveActiveTab("/login"), undefined);
});

Deno.test("resolveActiveTab — /shoppingExtra does not match (false-positive guard)", () => {
  assertEquals(resolveActiveTab("/shoppingExtra"), undefined);
});

Deno.test("resolveActiveTab — /homestead does not match home (false-positive guard)", () => {
  assertEquals(resolveActiveTab("/homestead"), undefined);
});
