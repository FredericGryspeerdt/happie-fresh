import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { LoyaltyCardRepo } from "@/database/loyalty-card.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearCards() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["loyalty_cards"] })) {
    await kv.delete(e.key);
  }
}

const H1 = "house-1";
const H2 = "house-2";

Deno.test({
  name: "create + getById — round-trips fields and assigns id + createdAt",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const created = await LoyaltyCardRepo.create({
      householdId: H1,
      label: "Delhaize",
      value: "5400141000000",
      format: "ean13",
      color: "teal",
      createdBy: "u1",
    });
    assertEquals(typeof created.id, "string");
    assertEquals(typeof created.createdAt, "string");
    const fetched = await LoyaltyCardRepo.getById(H1, created.id);
    assertEquals(fetched?.label, "Delhaize");
    assertEquals(fetched?.value, "5400141000000");
    assertEquals(fetched?.format, "ean13");
    assertEquals(fetched?.color, "teal");
  },
});

Deno.test({
  name: "getAll — returns only the requesting household's cards",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    await LoyaltyCardRepo.create({
      householdId: H1,
      label: "Ours",
      value: "111",
      format: "code128",
    });
    await LoyaltyCardRepo.create({
      householdId: H2,
      label: "Theirs",
      value: "222",
      format: "code128",
    });
    const mine = await LoyaltyCardRepo.getAll(H1);
    assertEquals(mine.map((c) => c.label), ["Ours"]);
  },
});

Deno.test({
  name: "getById — does not leak across households",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const theirs = await LoyaltyCardRepo.create({
      householdId: H2,
      label: "Theirs",
      value: "222",
      format: "code128",
    });
    // Asking as H1 for a card owned by H2 must return null.
    assertEquals(await LoyaltyCardRepo.getById(H1, theirs.id), null);
  },
});

Deno.test({
  name: "update — partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const c = await LoyaltyCardRepo.create({
      householdId: H1,
      label: "Old",
      value: "999",
      format: "code128",
      color: "teal",
    });
    const updated = await LoyaltyCardRepo.update(H1, c.id, { label: "New" });
    assertEquals(updated?.label, "New");
    assertEquals(updated?.value, "999"); // untouched
    assertEquals(updated?.color, "teal"); // untouched
  },
});

Deno.test({
  name: "update — returns null for a missing card",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    assertEquals(
      await LoyaltyCardRepo.update(H1, "nope", { label: "x" }),
      null,
    );
  },
});

Deno.test({
  name: "delete — removes only within the owning household",
  sanitizeResources: false,
  async fn() {
    await clearCards();
    const c = await LoyaltyCardRepo.create({
      householdId: H1,
      label: "Gone",
      value: "1",
      format: "code128",
    });
    // A delete scoped to the wrong household is a no-op.
    await LoyaltyCardRepo.delete(H2, c.id);
    assertEquals((await LoyaltyCardRepo.getById(H1, c.id))?.label, "Gone");
    // The owning household can delete it.
    await LoyaltyCardRepo.delete(H1, c.id);
    assertEquals(await LoyaltyCardRepo.getById(H1, c.id), null);
    assertEquals(await LoyaltyCardRepo.getAll(H1), []);
  },
});
