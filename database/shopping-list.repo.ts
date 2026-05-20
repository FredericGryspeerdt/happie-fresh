import { CreateShoppingListDto, ShoppingListInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

export class ShoppingListRepo {
  static async create(
    data: CreateShoppingListDto,
  ): Promise<ShoppingListInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const list: ShoppingListInterface = { ...data, id };
    await kv.set(["shopping_lists", data.householdId, id], list);
    return list;
  }

  static async getAll(householdId: string): Promise<ShoppingListInterface[]> {
    const kv = await getKv();
    const iter = kv.list<ShoppingListInterface>({
      prefix: ["shopping_lists", householdId],
    });
    const lists: ShoppingListInterface[] = [];
    for await (const { value } of iter) lists.push(value);
    return lists;
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<ShoppingListInterface | null> {
    const kv = await getKv();
    const result = await kv.get<ShoppingListInterface>([
      "shopping_lists",
      householdId,
      id,
    ]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: Partial<ShoppingListInterface>,
  ): Promise<ShoppingListInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await kv.set(["shopping_lists", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["shopping_lists", householdId, id]);
  }
}
