import { assertEquals, assertNotEquals } from "$std/assert/mod.ts";
import { hashPassword, ITERATIONS, verifyPassword } from "@/utils/security.ts";

Deno.test("hashPassword produces PHC-style prefix", async () => {
  const hash = await hashPassword("hunter2");
  assertEquals(hash.startsWith(`$pbkdf2-sha256$${ITERATIONS}$`), true);
});

Deno.test("hashPassword produces different hashes for same input (salt randomness)", async () => {
  const h1 = await hashPassword("hunter2");
  const h2 = await hashPassword("hunter2");
  assertNotEquals(h1, h2);
});

Deno.test("verifyPassword returns true for correct password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  const result = await verifyPassword("correct-horse-battery-staple", hash);
  assertEquals(result, true);
});

Deno.test("verifyPassword returns false for wrong password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  const result = await verifyPassword("wrong-password", hash);
  assertEquals(result, false);
});

Deno.test("verifyPassword returns false for legacy SHA-256 hex string", async () => {
  const legacySha256 =
    "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
  const result = await verifyPassword("admin", legacySha256);
  assertEquals(result, false);
});
