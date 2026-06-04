import { createDefine } from "fresh";
import { ItemInterface, ShoppingListItemInterface } from "../models/index.ts";

export interface AppBarDetail {
  mode: "detail";
  title: string;
  backUrl: string;
}

export interface StateInterface {
  userId?: string;
  householdId?: string;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
  appBar?: AppBarDetail;
}

// Setup, do this once in a file and import it everywhere else.
export const define = createDefine<StateInterface>();
