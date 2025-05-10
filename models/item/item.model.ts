import { ItemInterface } from "./item.interface.ts";

export class Item implements ItemInterface {
    id?: string;
    name?: string;
    constructor(name: string) {
        this.name = name;
    }
}
