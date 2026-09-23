import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  DishRepo,
  LoyaltyCardRepo,
  ShoppingListRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h, options } from "preact";
import type { Context } from "fresh";
import ItemsIsland from "@/islands/items.tsx";
import ShoppingDetailPage, { handler } from "./index.tsx";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  listId: string,
  householdId: string,
): Context<{
  householdId: string;
}> {
  return {
    req: new Request(`http://x/shopping/${listId}`),
    params: { id: listId },
    state: { householdId },
  } as unknown as Context<{ householdId: string }>;
}

Deno.test({
  name:
    "shopping detail handler supplies only current-household cards to ItemsIsland",
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
    const dish = await DishRepo.create(householdId, {
      name: "Lasagne",
      ingredientIds: [],
      tagValueIds: [],
    });
    await WeeklyMenuRepo.addDish(householdId, dish.id);

    const response = await handler.GET(ctx(list.id, householdId));
    assert(!(response instanceof Response));

    let itemProps: Record<string, unknown> | undefined;
    const previousVnode = options.vnode;
    options.vnode = (vnode) => {
      previousVnode?.(vnode);
      if (vnode.type === ItemsIsland) itemProps = vnode.props;
    };

    try {
      render(h(ShoppingDetailPage, { data: response.data } as never));
    } finally {
      options.vnode = previousVnode;
    }

    assertEquals(
      (itemProps?.loyaltyCards as { id: string }[] | undefined)?.map((card) =>
        card.id
      ),
      [currentCard.id],
    );
    assertEquals(
      (itemProps?.initialDishes as { id: string }[] | undefined)?.map((d) =>
        d.id
      ),
      [dish.id],
    );
    assertEquals(
      (itemProps?.initialMenu as { entries: { dishId: string }[] } | undefined)
        ?.entries.map((entry) => entry.dishId),
      [dish.id],
    );
  },
});
