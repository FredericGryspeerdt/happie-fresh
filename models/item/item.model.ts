import { CreateItemDto } from "./item.interface.ts";

export class Item implements CreateItemDto {
  name: string;
  categoryId?: string;
  constructor(name: string, categoryId?: string) {
    this.name = name;
    this.categoryId = categoryId;
  }
}
