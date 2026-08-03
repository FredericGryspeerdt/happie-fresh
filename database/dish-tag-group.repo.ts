import {
  DishTagGroupInterface,
  DishTagValueInterface,
} from "@/models/index.ts";
import { getKv } from "./db.ts";

const DEFAULT_GROUPS: { label: string; values: string[] }[] = [
  { label: "Type", values: ["Vegetarian", "Fish", "Meat"] },
  { label: "Meal", values: ["Main dish", "Breakfast", "Lunch", "Side dish"] },
  { label: "Side type", values: ["Rice", "Potatoes", "Pasta"] },
];

export class DishTagGroupRepo {
  static async getAll(householdId: string): Promise<DishTagGroupInterface[]> {
    const kv = await getKv();
    const entries = kv.list<DishTagGroupInterface>({
      prefix: ["dish_tag_groups", householdId],
    });
    const groups: DishTagGroupInterface[] = [];
    for await (const entry of entries) groups.push(entry.value);
    return groups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<DishTagGroupInterface | null> {
    const kv = await getKv();
    const res = await kv.get<DishTagGroupInterface>([
      "dish_tag_groups",
      householdId,
      id,
    ]);
    return res.value;
  }

  static async ensureDefaults(householdId: string): Promise<void> {
    const kv = await getKv();
    // Seed only when the household's collection is empty.
    for await (
      const _ of kv.list({ prefix: ["dish_tag_groups", householdId] })
    ) return;
    let atomic = kv.atomic();
    DEFAULT_GROUPS.forEach((g, i) => {
      const group: DishTagGroupInterface = {
        id: crypto.randomUUID(),
        label: g.label,
        order: i,
        values: g.values.map((label) => ({
          id: crypto.randomUUID(),
          label,
        })),
      };
      atomic = atomic.set(["dish_tag_groups", householdId, group.id], group);
    });
    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to seed dish tag groups.");
  }

  static async addValue(
    householdId: string,
    groupId: string,
    label: string,
  ): Promise<DishTagValueInterface | null> {
    const kv = await getKv();
    const group = await this.getById(householdId, groupId);
    if (!group) return null;
    const value: DishTagValueInterface = {
      id: crypto.randomUUID(),
      label,
    };
    const updated: DishTagGroupInterface = {
      ...group,
      values: [...group.values, value],
    };
    await kv.set(["dish_tag_groups", householdId, groupId], updated);
    return value;
  }
}
