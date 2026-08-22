import { ItemInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
export class ItemRepo {
  constructor() {}

  static async create(householdId: string, item: Partial<ItemInterface>) {
    const kv = await getKv();

    const id = crypto.randomUUID();
    const itemWithId = { ...item, id };
    const itemKey = ["items", householdId, itemWithId.id];
    const ok = await kv.atomic().set(itemKey, itemWithId).commit();
    if (!ok) throw new Error("Something went wrong.");
    return itemWithId;
  }

  static async readAll(householdId: string) {
    const kv = await getKv();

    const entries = kv.list<Required<ItemInterface>>({
      prefix: ["items", householdId],
    });
    const items = [];
    for await (const entry of entries) {
      const item = entry.value;
      items.push(item);
    }
    return items;
  }

  static async getById(householdId: string, id: string) {
    const kv = await getKv();
    const item = await kv.get<ItemInterface>(["items", householdId, id]);
    return item.value;
  }

  static async update(householdId: string, id: string, item: ItemInterface) {
    const kv = await getKv();

    return kv.set(["items", householdId, id], item);
  }
  static async delete(householdId: string, id: string) {
    const kv = await getKv();

    return kv.delete(["items", householdId, id]);
  }
}
