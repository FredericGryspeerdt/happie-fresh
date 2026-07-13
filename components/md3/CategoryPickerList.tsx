// components/md3/CategoryPickerList.tsx
import { useSignal } from "@preact/signals";
import type { CategoryInterface } from "@/models/index.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";

interface CategoryPickerListProps {
  categories: CategoryInterface[];
  /** Currently selected category id; "" means Uncategorized. */
  selectedId: string;
  /** Called with the chosen id ("" for Uncategorized). */
  onSelect: (id: string) => void;
}

/**
 * Searchable single-select list of categories, rendered as a Sheet body.
 * Categories are listed alphabetically — this is a picker, so it favours
 * findability; shopping "aisle order" applies only in Shop mode, not here.
 * Owns its own search query, so it resets each time it is (re)mounted.
 * Shared by the add-item and item-editor flows in islands/items.tsx.
 */
export function CategoryPickerList(
  { categories, selectedId, onSelect }: CategoryPickerListProps,
) {
  const query = useSignal("");
  const q = query.value.trim().toLowerCase();
  const matches = [...categories]
    .sort((a, b) =>
      (a.label ?? "").toLowerCase().localeCompare((b.label ?? "").toLowerCase())
    )
    .filter((c) => !q || (c.label ?? "").toLowerCase().includes(q));

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2 bg-surface-chigh rounded-[var(--md-shape-full)] h-12 px-4 mb-1">
        <Icon name="search" size={20} class="text-on-surface-variant" />
        <input
          value={query.value}
          onInput={(e) => {
            query.value = (e.target as HTMLInputElement).value;
          }}
          placeholder="Find a category"
          class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
        />
      </div>
      {(!q || "uncategorized".includes(q)) && (
        <ListItem
          headline="Uncategorized"
          onClick={() => onSelect("")}
          trailing={!selectedId
            ? <Icon name="check" size={20} class="text-primary" />
            : undefined}
        />
      )}
      {matches.map((cat) => (
        <ListItem
          key={cat.id}
          headline={cat.label ?? ""}
          onClick={() => onSelect(cat.id ?? "")}
          trailing={selectedId === cat.id
            ? <Icon name="check" size={20} class="text-primary" />
            : undefined}
        />
      ))}
      {q && matches.length === 0 && (
        <p class="md-body-medium text-on-surface-variant px-1 py-3.5">
          No category matches "{query.value.trim()}".
        </p>
      )}
    </div>
  );
}
