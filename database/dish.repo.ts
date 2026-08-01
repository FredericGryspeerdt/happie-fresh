import { CreateDishDto, DishInterface, UpdateDishDto } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

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
    };
    const ok = await kv.atomic().set(["dishes", householdId, id], record)
      .commit();
    if (!ok) throw new Error("Failed to create dish.");
    return record;
  }

  static async getAll(householdId: string): Promise<DishInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishInterface>({ prefix: ["dishes", householdId] });
    const dishes: DishInterface[] = [];
    for await (const entry of entries) dishes.push(entry.value);
    return dishes;
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishInterface>(["dishes", householdId, id]);
    return res.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateDishDto,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<DishInterface>(existing, patch);
    await kv.set(["dishes", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["dishes", householdId, id]);
  }
}
