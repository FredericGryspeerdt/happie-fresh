import type { ShoppingListItemInterface } from "@/models/index.ts";

interface DoneListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  onReAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function DoneListItem(
  { item, name, onReAdd, onRemove }: DoneListItemProps,
) {
  return (
    <li class="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <span class="font-medium text-gray-500 line-through">{name}</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100 transition-colors"
          onClick={() => onReAdd(item.id)}
        >
          Re-add
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-red-500 bg-red-50 rounded-lg active:bg-red-100 transition-colors"
          onClick={() => onRemove(item.id)}
          aria-label="Remove"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
