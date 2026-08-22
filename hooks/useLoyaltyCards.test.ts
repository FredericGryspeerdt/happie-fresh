import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useLoyaltyCards } from "@/hooks/useLoyaltyCards.ts";
import type { LoyaltyCardInterface } from "@/models/index.ts";

const card = (
  id: string,
  label: string,
  value = "9520123456788",
): LoyaltyCardInterface => ({
  id,
  householdId: "h1",
  label,
  value,
  format: "ean13",
});

Deno.test("sorted — alphabetical by label (case-insensitive)", () => {
  const hook = useLoyaltyCards([
    card("1", "delhaize"),
    card("2", "Aldi"),
    card("3", "Carrefour"),
  ]);
  assertEquals(hook.sorted.value.map((c) => c.label), [
    "Aldi",
    "Carrefour",
    "delhaize",
  ]);
});

Deno.test("addCard — pessimistic: appends only the server-returned card", async () => {
  const created = card("new", "Colruyt");
  const create = stub(api.cards, "create", () => Promise.resolve(created));
  const hook = useLoyaltyCards([card("1", "Aldi")]);
  try {
    const result = await hook.addCard({
      label: "Colruyt",
      value: "9520123456788",
      format: "ean13",
    });
    assertEquals(result, created);
    assertEquals(hook.cards.value.map((c) => c.id), ["1", "new"]);
    assertEquals(create.calls.length, 1);
  } finally {
    create.restore();
  }
});

Deno.test("addCard — on failure, returns null and does not add", async () => {
  const create = stub(api.cards, "create", () => Promise.resolve(null));
  const hook = useLoyaltyCards([card("1", "Aldi")]);
  try {
    const result = await hook.addCard({
      label: "Broken",
      value: "bad",
      format: "ean13",
    });
    assertEquals(result, null);
    assertEquals(hook.cards.value.map((c) => c.id), ["1"]);
  } finally {
    create.restore();
  }
});

Deno.test("removeCard — optimistically removes and calls the API", async () => {
  const del = stub(api.cards, "delete", () => Promise.resolve());
  const hook = useLoyaltyCards([card("1", "Aldi"), card("2", "Lidl")]);
  try {
    await hook.removeCard("1");
    assertEquals(hook.cards.value.map((c) => c.id), ["2"]);
    assertEquals(del.calls.length, 1);
  } finally {
    del.restore();
  }
});

Deno.test("refresh — re-pulls cards from the API", async () => {
  const hook = useLoyaltyCards([card("1", "Old")]);
  const getAll = stub(
    api.cards,
    "getAll",
    () => Promise.resolve([card("2", "Fresh"), card("3", "New")]),
  );
  try {
    await hook.refresh();
  } finally {
    getAll.restore();
  }
  assertEquals(hook.cards.value.map((c) => c.label), ["Fresh", "New"]);
});

Deno.test("updateCard — optimistic: adopts the server-returned card", async () => {
  const server = { ...card("1", "Colruyt"), color: "rose" };
  const update = stub(api.cards, "update", () => Promise.resolve(server));
  const hook = useLoyaltyCards([card("1", "Aldi"), card("2", "Lidl")]);
  try {
    const result = await hook.updateCard("1", {
      label: "Colruyt",
      value: "9520123456788",
      format: "ean13",
      color: "rose",
    });
    assertEquals(result, server);
    const one = hook.cards.value.find((c) => c.id === "1");
    assertEquals(one?.label, "Colruyt");
    assertEquals(one?.color, "rose");
    assertEquals(update.calls.length, 1);
  } finally {
    update.restore();
  }
});

Deno.test("updateCard — rolls back and returns null on failure", async () => {
  const update = stub(api.cards, "update", () => Promise.resolve(null));
  const original = card("1", "Aldi");
  const hook = useLoyaltyCards([original, card("2", "Lidl")]);
  try {
    const result = await hook.updateCard("1", {
      label: "Broken",
      value: "bad",
      format: "ean13",
    });
    assertEquals(result, null);
    // Local state is restored to the pre-edit card.
    assertEquals(hook.cards.value.find((c) => c.id === "1")?.label, "Aldi");
  } finally {
    update.restore();
  }
});
