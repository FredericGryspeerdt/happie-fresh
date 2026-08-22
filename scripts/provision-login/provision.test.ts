import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  databaseIdFrom,
  guard,
  isRemote,
  validateCredentials,
} from "./provision.ts";

const REMOTE = "https://api.deno.com/v2/databases/abc-123/connect";

Deno.test("isRemote — only https KV paths are remote", () => {
  assertEquals(isRemote(REMOTE), true);
  assertEquals(isRemote("data/kv.db"), false);
  assertEquals(isRemote(undefined), false);
});

Deno.test("guard — refuses to run inside a deployment", () => {
  const res = guard({
    deploymentId: "deployment-1",
    kvPath: undefined,
    confirmedRemote: false,
  });
  assertEquals(res.ok, false);
});

Deno.test("guard — a remote target needs --confirm-remote", () => {
  assertEquals(
    guard({ deploymentId: undefined, kvPath: REMOTE, confirmedRemote: false })
      .ok,
    false,
  );
  assertEquals(
    guard({ deploymentId: undefined, kvPath: REMOTE, confirmedRemote: true })
      .ok,
    true,
  );
});

Deno.test("guard — a local target needs no confirmation", () => {
  assertEquals(
    guard({
      deploymentId: undefined,
      kvPath: "data/kv.db",
      confirmedRemote: false,
    }).ok,
    true,
  );
});

Deno.test("guard — a deployment is refused even when remote is confirmed", () => {
  // The deployment check must not be bypassable by the flag that exists for a
  // different risk.
  assertEquals(
    guard({ deploymentId: "d1", kvPath: REMOTE, confirmedRemote: true }).ok,
    false,
  );
});

Deno.test("databaseIdFrom — pulls the id out for the confirmation echo", () => {
  assertEquals(databaseIdFrom(REMOTE), "abc-123");
  assertEquals(databaseIdFrom("data/kv.db"), "(unrecognised)");
});

Deno.test("validateCredentials — rejects an empty username and short password", () => {
  assertEquals(validateCredentials("", "longenough").ok, false);
  assertEquals(validateCredentials("tester", "short").ok, false);
  assertEquals(validateCredentials("tester", "longenough").ok, true);
});
