import { CreateDishDto, DishInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

export class DishRepo {
  static async create(dish: CreateDishDto): Promise<DishInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const record: DishInterface = {
      ...dish,
      id,
      ingredientIds: dish.ingredientIds ?? [],
      tagValueIds: dish.tagValueIds ?? [],
      createdAt: dish.createdAt ?? new Date().toISOString(),
    };
    const ok = await kv.atomic().set(["dishes", id], record).commit();
    if (!ok) throw new Error("Failed to create dish.");
    return record;
  }

  static async readAll(): Promise<DishInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishInterface>({ prefix: ["dishes"] });
    const dishes: DishInterface[] = [];
    for await (const entry of entries) dishes.push(entry.value);
    return dishes;
  }

  static async getById(id: string): Promise<DishInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishInterface>(["dishes", id]);
    return res.value;
  }

  static async update(
    id: string,
    patch: Partial<DishInterface>,
  ): Promise<DishInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = mergeDefinedPatch(existing, patch);
    await kv.set(["dishes", id], updated);
    return updated;
  }

  static async delete(id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["dishes", id]);
  }
}
