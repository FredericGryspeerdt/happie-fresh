import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import WeeklyMenu from "./WeeklyMenu.tsx";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";

const dishes: DishInterface[] = [
  {
    id: "d1",
    name: "Pasta Bolognese",
    ingredientIds: [],
    tagValueIds: ["meat"],
  },
];
const tagGroups: DishTagGroupInterface[] = [
  {
    id: "type",
    label: "Type",
    order: 0,
    values: [{ id: "meat", label: "Meat" }],
  },
];

Deno.test("WeeklyMenu — empty state prompts adding dishes", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: { householdId: "h1", entries: [] },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
  }));
  assertStringIncludes(html, "This week");
  assertStringIncludes(html, "No dishes yet");
  assertStringIncludes(html, "Add dishes");
});

Deno.test("WeeklyMenu — renders an entry with its dish name, tag, and day chip", () => {
  const html = render(h(WeeklyMenu, {
    initialMenu: {
      householdId: "h1",
      entries: [{ id: "e1", dishId: "d1", day: null }],
    },
    initialDishes: dishes,
    initialTagGroups: tagGroups,
  }));
  assertStringIncludes(html, "Pasta Bolognese");
  assertStringIncludes(html, "Meat"); // resolved tag label
  assertStringIncludes(html, "Any"); // unpinned day chip
  assertStringIncludes(html, "1 dish planned");
});
