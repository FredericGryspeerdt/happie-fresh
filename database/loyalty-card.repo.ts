import {
  CreateLoyaltyCardDto,
  LoyaltyCardInterface,
  UpdateLoyaltyCardDto,
} from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

/**
 * Loyalty cards are shared within a household. Keys are scoped by household so a
 * member only ever reads or writes their own household's cards
 * (`["loyalty_cards", householdId, id]`), mirroring `ShoppingListRepo`.
 */
export class LoyaltyCardRepo {
  static async create(
    data: CreateLoyaltyCardDto,
  ): Promise<LoyaltyCardInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const card: LoyaltyCardInterface = {
      ...data,
      id,
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
    await kv.set(["loyalty_cards", data.householdId, id], card);
    return card;
  }

  static async getAll(householdId: string): Promise<LoyaltyCardInterface[]> {
    const kv = await getKv();
    const iter = kv.list<LoyaltyCardInterface>({
      prefix: ["loyalty_cards", householdId],
    });
    const cards: LoyaltyCardInterface[] = [];
    for await (const { value } of iter) cards.push(value);
    return cards;
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<LoyaltyCardInterface | null> {
    const kv = await getKv();
    const result = await kv.get<LoyaltyCardInterface>([
      "loyalty_cards",
      householdId,
      id,
    ]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateLoyaltyCardDto,
  ): Promise<LoyaltyCardInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<LoyaltyCardInterface>(existing, patch);
    await kv.set(["loyalty_cards", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["loyalty_cards", householdId, id]);
  }
}
