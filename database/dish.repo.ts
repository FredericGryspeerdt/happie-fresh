import { CreateDishDto, DishInterface, UpdateDishDto } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { deleteKvValue, getKvValue, listKvValues, setKvValue } from "./kv.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

function amountsForIngredients(
  ingredientIds: string[],
  amounts: DishInterface["ingredientAmounts"],
): DishInterface["ingredientAmounts"] {
  if (!amounts) return undefined;
  const ingredientIdSet = new Set(ingredientIds);
  return Object.fromEntries(
    Object.entries(amounts).filter(([itemId]) => ingredientIdSet.has(itemId)),
  );
}

export class DishRepo {
  static async create(
    householdId: string,
    dish: CreateDishDto,
  ): Promise<DishInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const record: DishInterface = {
      ...dish,
      id,
      ingredientIds: dish.ingredientIds ?? [],
      tagValueIds: dish.tagValueIds ?? [],
      createdAt: dish.createdAt ?? new Date().toISOString(),
      ...(dish.ingredientAmounts !== undefined
        ? {
          ingredientAmounts: amountsForIngredients(
            dish.ingredientIds ?? [],
            dish.ingredientAmounts,
          ),
        }
        : {}),
    };
    const ok = await kv.atomic().set(["dishes", householdId, id], record)
      .commit();
    if (!ok) throw new Error("Failed to create dish.");
    return record;
  }

  static async getAll(householdId: string): Promise<DishInterface[]> {
    return await listKvValues<DishInterface>(["dishes", householdId]);
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<DishInterface | null> {
    return await getKvValue<DishInterface>(["dishes", householdId, id]);
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateDishDto,
  ): Promise<DishInterface | null> {
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<DishInterface>(existing, patch);
    if (updated.ingredientAmounts !== undefined) {
      updated.ingredientAmounts = amountsForIngredients(
        updated.ingredientIds,
        updated.ingredientAmounts,
      );
    }
    await setKvValue(["dishes", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    await deleteKvValue(["dishes", householdId, id]);
  }
}
