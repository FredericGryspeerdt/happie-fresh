# Dish ingredient amounts

Status: complete design confirmed on 2026-09-26. Not implemented.

## Agreed decisions

- Each ingredient in a dish may have a quantity and unit. Leaving the amount
  unspecified remains valid.
- Amounts describe the household's usual preparation. Serving counts and
  automatic scaling are outside this feature.
- Supported units are pieces, g, kg, ml, L, and packs, matching shopping.
- Amounts serve as a reference for cooking and carry into the menu-to-shopping
  preview.
- Compatible amounts for the same catalogue item across selected dishes are
  summed, including g/kg and ml/L conversions.
- Members can adjust the suggested shopping amounts before adding them. Shopping
  amounts are independent of the amounts saved with a dish.
- When only some dishes specify an amount, suggest the known total and flag the
  dishes with missing amounts. When none specify an amount, retain the current
  shopping default.
- When dishes specify incompatible units for the same item, show the
  requirements and require the member to choose one shopping amount before
  adding that item. Do not infer conversions between pieces, packs, mass, or
  volume.
- For an unchecked shopping entry, the dish amount is an addition, not a target
  total. Show the existing amount, proposed addition, and resulting total.
- For a bought entry, reopen it with the proposed dish amount, subject to the
  member's shopping override. If no dish amount exists, retain the current
  default.

## Dish interface

- Keep ingredient selection quick: selecting an ingredient does not immediately
  prompt for an amount.
- Both creating and editing a dish use ingredient rows showing the ingredient
  name and either **Add amount** or its saved amount, such as **200 g**.
- Tapping the amount action opens an editor. **Clear amount** removes only the
  amount, preserving the ingredient.
- Ingredient amounts remain part of the dish draft and persist with the dish's
  existing create/save action.

## Existing shopping entries with incompatible units

When an unchecked entry uses a unit incompatible with the suggested dish amount,
show both requirements. Require a compatible shopping addition or let the member
skip that ingredient. Preserve the existing entry and do not guess conversions.

## Documentation impact

The glossary now defines the agreed ingredient amount concept. Update the
functional inventory and menu shopping UI patterns when implementing the
feature; they should continue to describe the currently implemented behavior
until then. No ADR is needed for these choices: the feature extends the existing
dish and shopping concepts without introducing a hard-to-reverse architectural
decision.
