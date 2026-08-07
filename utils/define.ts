import { createDefine } from "fresh";
import {
  ItemInterface,
  MemberInterface,
  ShoppingListItemInterface,
} from "../models/index.ts";

export interface AppBarDetail {
  mode: "detail";
  title: string;
  backUrl: string;
}

/** The route owns the whole viewport — the shell renders no top bar and no
 *  bottom navigation (e.g. the full-screen add-items search). */
export interface AppBarNone {
  mode: "none";
}

export type AppBar = AppBarDetail | AppBarNone;

export interface StateInterface {
  userId?: string;
  householdId?: string;
  /** The member this request acts as (cookie claim, else the login's member). */
  actingMember?: MemberInterface;
  /** True only when a valid actingMemberId cookie made the claim. */
  actingClaimed?: boolean;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
  appBar?: AppBar;
}

// Setup, do this once in a file and import it everywhere else.
export const define = createDefine<StateInterface>();
