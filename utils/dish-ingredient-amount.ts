import type { ShoppingAmount } from "@/models/index.ts";
import {
  formatShoppingAmount,
  isShoppingUnit,
  parseShoppingAmount,
} from "./shopping-amount.ts";

export function formatDishIngredientAmount(amount: ShoppingAmount): string {
  if (amount.unit === "pieces") {
    return `${amount.quantity} ${amount.quantity === 1 ? "piece" : "pieces"}`;
  }
  return formatShoppingAmount(amount.quantity, amount.unit);
}

export function hasValidIngredientAmounts(
  ingredientIds: unknown,
  ingredientAmounts: unknown,
): boolean {
  if (ingredientAmounts === undefined) return true;
  if (
    !Array.isArray(ingredientIds) ||
    ingredientIds.some((id) => typeof id !== "string") ||
    ingredientAmounts === null || typeof ingredientAmounts !== "object" ||
    Array.isArray(ingredientAmounts)
  ) return false;

  return Object.entries(ingredientAmounts).every(([itemId, value]) => {
    if (!ingredientIds.includes(itemId)) return false;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const amount = value as Record<string, unknown>;
    return typeof amount.quantity === "number" && isShoppingUnit(amount.unit) &&
      parseShoppingAmount(String(amount.quantity), amount.unit) !== null;
  });
}
