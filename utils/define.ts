import { createDefine } from "fresh";
import { ItemInterface, ShoppingListItemInterface } from "../models/index.ts";
interface StateInterface {
  userId?: string;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
}
// Setup, do this once in a file and import it everywhere else.
export const define = createDefine<StateInterface>();
