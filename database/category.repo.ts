import { CategoryInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";
import { deleteKvValue, getKvValue, listKvValues, setKvValue } from "./kv.ts";

export class CategoryRepo {
  constructor() {}

  static async create(householdId: string, label: string, userId: string) {
    const kv = await getKv();

    const id = crypto.randomUUID();

    // Get current max order to append new category at the end
    const categories = await this.getAll(householdId);
    const maxOrder = categories.reduce(
      (max, cat) =>
        cat.order !== undefined && cat.order > max ? cat.order : max,
      -1,
    );

    const category: CategoryInterface = {
      id,
      label,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const categoryKey = ["categories", householdId, id];
    const ok = await kv.atomic().set(categoryKey, category).commit();
    if (!ok) throw new Error("Something went wrong.");
    return category;
  }

  static async getAll(householdId: string) {
    const categories = await listKvValues<CategoryInterface>([
      "categories",
      householdId,
    ]);

    // Sort by order field
    return categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(householdId: string, id: string) {
    return await getKvValue<CategoryInterface>([
      "categories",
      householdId,
      id,
    ]);
  }

  static async update(
    householdId: string,
    id: string,
    patch: Partial<CategoryInterface>,
  ) {
    const existing = await this.getById(householdId, id);
    if (!existing) return null;

    const updated = mergeDefinedPatch(existing, patch);
    await setKvValue(["categories", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string) {
    return await deleteKvValue(["categories", householdId, id]);
  }

  static async reorder(
    householdId: string,
    updates: Array<{ id: string; order: number }>,
  ) {
    const kv = await getKv();

    // Batch update all order changes in a transaction
    let atomic = kv.atomic();

    for (const { id, order } of updates) {
      const existing = await this.getById(householdId, id);
      if (existing) {
        const updated = { ...existing, order };
        atomic = atomic.set(["categories", householdId, id], updated);
      }
    }

    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to reorder categories.");
  }
}
