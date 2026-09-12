import {
  SHOPPING_UNITS,
  type ShoppingAmount,
  type ShoppingUnit,
} from "@/models/index.ts";

export function isShoppingUnit(value: unknown): value is ShoppingUnit {
  return SHOPPING_UNITS.some((unit) => unit === value);
}

export function parseShoppingAmount(
  text: string,
  unit: ShoppingUnit,
): ShoppingAmount | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99999) {
    return null;
  }
  return { quantity, unit };
}

export function formatShoppingAmount(
  quantity: number,
  unit?: ShoppingUnit,
): string {
  if (!unit || unit === "pieces") return String(quantity);
  return `${quantity} ${unit === "packs" && quantity === 1 ? "pack" : unit}`;
}

export type { ShoppingAmount, ShoppingUnit } from "@/models/index.ts";

export function compatibleShoppingUnits(
  unit: ShoppingUnit,
): readonly ShoppingUnit[] {
  if (unit === "g" || unit === "kg") return ["g", "kg"];
  if (unit === "ml" || unit === "L") return ["ml", "L"];
  return [unit];
}

// Integer thousandths of the smallest unit avoid floating-point accumulation.
// Keep the stored unit unless it would discard precision or exceed the limit.
export function addShoppingAmounts(
  existing: ShoppingAmount,
  additional: ShoppingAmount,
): ShoppingAmount | null {
  if (!compatibleShoppingUnits(existing.unit).includes(additional.unit)) {
    return null;
  }
  if (
    !parseShoppingAmount(String(existing.quantity), existing.unit) ||
    !parseShoppingAmount(String(additional.quantity), additional.unit)
  ) return null;
  const scale = (unit: ShoppingUnit) =>
    unit === "kg" || unit === "L" ? 1000 : 1;
  const total = Math.round(existing.quantity * 1000) * scale(existing.unit) +
    Math.round(additional.quantity * 1000) * scale(additional.unit);
  for (
    const unit of [existing.unit, ...compatibleShoppingUnits(existing.unit)]
  ) {
    if (total % scale(unit) !== 0) continue;
    const amount = parseShoppingAmount(
      String(total / scale(unit) / 1000),
      unit,
    );
    if (amount) return amount;
  }
  return null;
}
