import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { useWeeklyMenu as createWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { DishPicker } from "./DishPicker.tsx";

Deno.test("DishPicker — summary excludes unplanned dishes and counts overflow", () => {
  const dishes = [
    "Lasagne",
    "Tacos",
    "Tomato soup",
    "Vegetable curry",
    "Pizza",
    "Roast chicken",
  ].map((name, i) => ({
    id: String(i),
    name,
    ingredientIds: [],
    tagValueIds: [],
  }));
  const menu = createWeeklyMenu({
    householdId: "h1",
    entries: dishes.slice(0, 5).map((d) => ({
      id: `e${d.id}`,
      dishId: d.id,
      day: null,
    })),
  });
  const html = render(h(DishPicker, { dishes, menu, onClose: () => {} }));
  const footer = html.slice(html.indexOf("<footer"));
  assertStringIncludes(footer, "5 dishes planned");
  assertStringIncludes(footer, "Lasagne · Pizza · Tacos · Tomato soup");
  assertStringIncludes(footer, "+1 more");
  assert(!footer.includes("Roast chicken"));
  assertStringIncludes(footer, "View all");
  assertStringIncludes(html, "Remove from this week?");
});
