import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  addShoppingAmounts,
  formatShoppingAmount,
  isShoppingUnit,
  parseShoppingAmount,
} from "./shopping-amount.ts";

Deno.test("shopping amounts — accepts decimal comma and dot, rejects invalid or excessive amounts", () => {
  assertEquals(parseShoppingAmount("0,5", "kg"), { quantity: 0.5, unit: "kg" });
  assertEquals(parseShoppingAmount(" 1.125 ", "L"), {
    quantity: 1.125,
    unit: "L",
  });
  assertEquals(parseShoppingAmount("99999", "pieces"), {
    quantity: 99999,
    unit: "pieces",
  });
  for (
    const text of [
      "",
      "0",
      "-1",
      "100000",
      "1.1234",
      "1e3",
      "NaN",
      "Infinity",
      "1,2.3",
    ]
  ) {
    assertEquals(parseShoppingAmount(text, "g"), null, text);
  }
  assertEquals(isShoppingUnit("kg"), true);
  assertEquals(isShoppingUnit("litres"), false);
  assertEquals(formatShoppingAmount(0.5, "kg"), "0.5 kg");
  assertEquals(formatShoppingAmount(5, "pieces"), "5");
  assertEquals(formatShoppingAmount(1, "packs"), "1 pack");
  assertEquals(formatShoppingAmount(2, "packs"), "2 packs");
  assertEquals(formatShoppingAmount(3), "3");
});

Deno.test("shopping amounts — combines compatible units exactly without rounding", () => {
  assertEquals(
    addShoppingAmounts({ quantity: 1, unit: "pieces" }, {
      quantity: 3,
      unit: "pieces",
    }),
    { quantity: 4, unit: "pieces" },
  );
  assertEquals(
    addShoppingAmounts({ quantity: 1, unit: "kg" }, {
      quantity: 500,
      unit: "g",
    }),
    { quantity: 1.5, unit: "kg" },
  );
  assertEquals(
    addShoppingAmounts({ quantity: 1, unit: "kg" }, {
      quantity: 0.001,
      unit: "g",
    }),
    { quantity: 1000.001, unit: "g" },
  );
  assertEquals(
    addShoppingAmounts({ quantity: 0.1, unit: "L" }, {
      quantity: 200,
      unit: "ml",
    }),
    { quantity: 0.3, unit: "L" },
  );
  assertEquals(
    addShoppingAmounts({ quantity: 1, unit: "pieces" }, {
      quantity: 1,
      unit: "kg",
    }),
    null,
  );
  assertEquals(
    addShoppingAmounts({ quantity: 99999, unit: "pieces" }, {
      quantity: 1,
      unit: "pieces",
    }),
    null,
  );
});
