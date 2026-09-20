import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { submitListRename } from "./list-rename.ts";

Deno.test("submitListRename keeps the draft open and reports a failed rename", async () => {
  const pending = { value: false };
  const events: string[] = [];

  const saved = await submitListRename({
    name: "  Weekly shop  ",
    pending,
    rename: (name) => {
      events.push(`rename:${name}`);
      return Promise.resolve(null);
    },
    beginBusy: () => events.push("busy:start"),
    endBusy: () => events.push("busy:end"),
    onFailure: () => events.push("failure"),
  });

  assertEquals(saved, false);
  assertEquals(pending.value, false);
  assertEquals(events, [
    "busy:start",
    "rename:Weekly shop",
    "failure",
    "busy:end",
  ]);
});

Deno.test("submitListRename blocks a repeated submission while saving", async () => {
  const pending = { value: false };
  let finish!: (value: { id: string; name: string }) => void;
  const response = new Promise<{ id: string; name: string }>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  let busy = 0;

  const first = submitListRename({
    name: "Weekly shop",
    pending,
    rename: () => {
      calls++;
      return response;
    },
    beginBusy: () => busy++,
    endBusy: () => busy--,
  });
  const repeated = await submitListRename({
    name: "Weekly shop",
    pending,
    rename: () => {
      calls++;
      return response;
    },
    beginBusy: () => busy++,
    endBusy: () => busy--,
  });

  assertEquals(repeated, false);
  assertEquals(calls, 1);
  assertEquals(busy, 1);
  finish({ id: "l1", name: "Weekly shop" });
  assertEquals(await first, true);
  assertEquals(pending.value, false);
  assertEquals(busy, 0);
});
