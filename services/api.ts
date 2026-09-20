import { cards } from "./api/cards.ts";
import { categories, items } from "./api/catalogue.ts";
import { dishes, dishTagGroups, weeklyMenu } from "./api/menu.ts";
import { members } from "./api/members.ts";
import { shoppingList, shoppingLists } from "./api/shopping-lists.ts";
import { todos } from "./api/todos.ts";

export const api = {
  items,
  categories,
  shoppingLists,
  shoppingList,
  dishes,
  cards,
  todos,
  dishTagGroups,
  members,
  weeklyMenu,
};
