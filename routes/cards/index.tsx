import { page } from "fresh";
import { LoyaltyCardRepo } from "@/database/index.ts";
import LoyaltyWallet from "@/islands/cards/LoyaltyWallet.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    const cards = householdId ? await LoyaltyCardRepo.getAll(householdId) : [];
    return page({ cards });
  },
});

export default define.page<typeof handler>(function CardsPage({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <LoyaltyWallet initialCards={data.cards} />
    </main>
  );
});
