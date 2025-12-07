import { createDefine } from "fresh";
import { ItemInterface } from "../models/index.ts";
interface Data {
  items: ItemInterface[];
}
// Setup, do this once in a file and import it everywhere else.
export const homePage = createDefine<Data>();
