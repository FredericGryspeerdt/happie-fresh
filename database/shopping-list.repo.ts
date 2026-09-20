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
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch(existing, patch);
    await setKvValue(["shopping_lists", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    await deleteKvValue(["shopping_lists", householdId, id]);
  }
}
