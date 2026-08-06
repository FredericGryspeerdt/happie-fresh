import { assertEquals, assertNotEquals } from "jsr:@std/assert@^1.0.19";
import { pushEndpointId } from "./push-endpoint.ts";

Deno.test("pushEndpointId — the same endpoint always yields the same id", async () => {
  const e = "https://fcm.googleapis.com/fcm/send/abc123";
  assertEquals(await pushEndpointId(e), await pushEndpointId(e));
});

Deno.test("pushEndpointId — different endpoints yield different ids", async () => {
  assertNotEquals(
    await pushEndpointId("https://fcm.googleapis.com/fcm/send/abc"),
    await pushEndpointId("https://fcm.googleapis.com/fcm/send/xyz"),
  );
});

Deno.test("pushEndpointId — is lowercase hex of a fixed length", async () => {
  const id = await pushEndpointId("https://example.com/push/1");
  assertEquals(id.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(id), true);
});
