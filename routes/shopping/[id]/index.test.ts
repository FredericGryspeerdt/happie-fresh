import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { LoyaltyCardRepo, ShoppingListRepo } from "@/database/index.ts";
import { loadShoppingListPageData } from "./index.tsx";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name:
    "shopping detail page data includes only the current household's loyalty cards",
  sanitizeResources: false,
  async fn() {
    const householdId = "h-shopping-detail-current";
    const otherHouseholdId = "h-shopping-detail-other";
    const list = await ShoppingListRepo.create({
      householdId,
      name: "Weekly shop",
      createdBy: "m1",
      createdAt: "2026-09-23T10:00:00.000Z",
    });
    const currentCard = await LoyaltyCardRepo.create({
      householdId,
      label: "Delhaize",
      value: "12345678",
      format: "code128",
    });
    await LoyaltyCardRepo.create({
      householdId: otherHouseholdId,
      label: "Other household card",
      value: "87654321",
      format: "code128",
    });

    const data = await loadShoppingListPageData(householdId, list.id);

    assertEquals(data.loyaltyCards.map((card) => card.id), [currentCard.id]);
  },
});
