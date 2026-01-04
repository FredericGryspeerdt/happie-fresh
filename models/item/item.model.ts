import { ItemInterface } from "./item.interface.ts";

export class Item implements ItemInterface {
  id?: string;
  name?: string;
  categoryId?: string;
  constructor(name: string, categoryId?: string) {
    this.name = name;
    this.categoryId = categoryId;
  }
}
