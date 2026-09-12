import type { ShoppingListItemInterface } from "@/models/index.ts";

export function SelectionRow(
  { item, name, selected, disabled, exiting, onToggle }: {
    item: ShoppingListItemInterface;
    name: string;
    selected: boolean;
    disabled?: boolean;
    exiting?: boolean;
    onToggle: () => void;
  },
) {
  return (
    <label
      class={`flex items-center gap-4 px-4 py-3 min-h-14 cursor-pointer transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`Select ${name}`}
        class="w-5 h-5 shrink-0 accent-primary"
      />
      <span class="flex-1 min-w-0">
        <span class="block md-body-large text-on-surface truncate">{name}</span>
        {item.note && (
          <span class="block md-body-small text-on-surface-variant truncate">
            {item.note}
          </span>
        )}
      </span>
      <span
        class="md-body-large text-on-surface"
        aria-label={`Quantity: ${item.quantity}`}
      >
        {item.quantity}
      </span>
    </label>
  );
}
