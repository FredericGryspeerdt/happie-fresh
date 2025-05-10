import { ItemInterface } from "../models/item/item.interface.ts";
import { kv } from "./db.ts";
export class ItemRepo {
  static create(item: Partial<ItemInterface>) {
    const id = crypto.randomUUID();
    return kv.set(["items", id], item);
  }
  static read(id: string) {
    return kv.get(["items", id]);
  }
  static update(id: string, item: ItemInterface) {
    return kv.set(["items", id], item);
  }
  static delete(id: string) {
    return kv.delete(["items", !id]);
  }
}
