import { getKv } from "./db.ts";
import {
  CreateShoppingListDto,
  ShoppingListInterface,
} from "@/models/index.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";
import { deleteKvValue, getKvValue, listKvValues, setKvValue } from "./kv.ts";

export class ShoppingListRepo {
  static async create(
    data: CreateShoppingListDto,
  ): Promise<ShoppingListInterface> {
    const id = crypto.randomUUID();
    const list: ShoppingListInterface = { ...data, id };
    await setKvValue(["shopping_lists", data.householdId, id], list);
    return list;
  }

  static async getAll(householdId: string): Promise<ShoppingListInterface[]> {
    return await listKvValues<ShoppingListInterface>([
      "shopping_lists",
      householdId,
    ]);
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<ShoppingListInterface | null> {
    return await getKvValue<ShoppingListInterface>([
      "shopping_lists",
      householdId,
      id,
    ]);
  }

  static async update(
    householdId: string,
    id: string,
    patch: Partial<ShoppingListInterface>,
  ): Promise<ShoppingListInterface | null> {
    const kv = await getKv();
    const key = ["shopping_lists", householdId, id];
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await kv.get<ShoppingListInterface>(key);
      if (!current.value) return null;
      const updated = mergeDefinedPatch(current.value, patch);
      const result = await kv.atomic().check(current).set(key, updated)
        .commit();
      if (result.ok) return updated;
    }
    throw new Error("Shopping list update conflict");
  }

  static async delete(householdId: string, id: string): Promise<void> {
    await deleteKvValue(["shopping_lists", householdId, id]);
  }
}
