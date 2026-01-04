import { CategoryInterface } from "../models/index.ts";
import { getKv } from "./db.ts";

export class CategoryRepo {
  constructor() {}

  static async create(label: string, userId: string) {
    const kv = await getKv();

    const id = crypto.randomUUID();
    
    // Get current max order to append new category at the end
    const categories = await this.getAll();
    const maxOrder = categories.reduce((max, cat) => 
      cat.order !== undefined && cat.order > max ? cat.order : max, -1
    );
    
    const category: CategoryInterface = {
      id,
      label,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    
    const categoryKey = ["categories", id];
    const ok = await kv.atomic().set(categoryKey, category).commit();
    if (!ok) throw new Error("Something went wrong.");
    return category;
  }

  static async getAll() {
    const kv = await getKv();

    const entries = kv.list<CategoryInterface>({ prefix: ["categories"] });
    const categories = [];
    for await (const entry of entries) {
      categories.push(entry.value);
    }
    
    // Sort by order field
    return categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  static async getById(id: string) {
    const kv = await getKv();
    const category = await kv.get<CategoryInterface>(["categories", id]);
    return category.value;
  }

  static async update(id: string, patch: Partial<CategoryInterface>) {
    const kv = await getKv();
    
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...patch };
    await kv.set(["categories", id], updated);
    return updated;
  }

  static async delete(id: string) {
    const kv = await getKv();
    return kv.delete(["categories", id]);
  }

  static async reorder(updates: Array<{ id: string; order: number }>) {
    const kv = await getKv();
    
    // Batch update all order changes in a transaction
    let atomic = kv.atomic();
    
    for (const { id, order } of updates) {
      const existing = await this.getById(id);
      if (existing) {
        const updated = { ...existing, order };
        atomic = atomic.set(["categories", id], updated);
      }
    }
    
    const ok = await atomic.commit();
    if (!ok) throw new Error("Failed to reorder categories.");
  }
}
