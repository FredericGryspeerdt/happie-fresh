import { forwardRef } from "preact/compat";
import type { ShoppingListItemInterface } from "@/models/index.ts";
import QuantityStepper from "@/components/quantity-stepper.tsx";

interface ShoppingListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  isExiting: boolean;
  isPending: boolean;
  onCheck: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ShoppingListItemInterface>) => void;
}

const ShoppingListItem = forwardRef<HTMLLIElement, ShoppingListItemProps>(
  ({ item, name, isExiting, isPending, onCheck, onUpdate }, ref) => {
    return (
      <li
        ref={ref}
        class={`p-4 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all duration-300 ease-out ${
          isExiting
            ? "opacity-0 translate-x-12 scale-95"
            : "opacity-100 translate-x-0 scale-100"
        }`}
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1 pt-1">
            <span class="font-semibold text-xl text-gray-900 block mb-1">
              {name}
            </span>
            <input
              type="text"
              placeholder="Add a note..."
              aria-label={`Note for ${name}`}
              value={item.note || ""}
              onInput={(e) =>
                onUpdate(item.id, { note: e.currentTarget.value })}
              class="w-full text-sm text-gray-600 placeholder-gray-400 bg-transparent border-none p-0 focus:ring-0"
            />
          </div>
          <button
            type="button"
            class="ml-4 w-12 h-12 shrink-0 flex items-center justify-center border-2 border-gray-200 rounded-full text-gray-300 active:bg-green-50 active:border-green-500 active:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            onClick={() => onCheck(item.id)}
            aria-label={isPending ? "Saving" : "Mark as done"}
            disabled={isPending}
          >
            {isPending
              ? (
                <svg
                  class="w-5 h-5 animate-spin text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              )
              : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              )}
          </button>
        </div>

        <div class="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
          <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Quantity
          </span>
          <QuantityStepper
            value={item.quantity}
            onChange={(val) => onUpdate(item.id, { quantity: val })}
          />
        </div>
      </li>
    );
  },
);

export default ShoppingListItem;
