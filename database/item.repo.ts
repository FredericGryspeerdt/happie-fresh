import { ItemInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { deleteKvValue, getKvValue, listKvValues, setKvValue } from "./kv.ts";
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
    return await listKvValues<Required<ItemInterface>>(["items", householdId]);
  }

  static async getById(householdId: string, id: string) {
    return await getKvValue<ItemInterface>(["items", householdId, id]);
  }

  static async update(householdId: string, id: string, item: ItemInterface) {
    return await setKvValue(["items", householdId, id], item);
  }
  static async delete(householdId: string, id: string) {
    return await deleteKvValue(["items", householdId, id]);
  }
}
