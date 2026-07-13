// components/md3/CatalogueAddRow.tsx
import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";

interface CatalogueAddRowProps {
  name: string;
  categoryLabel?: string;
  added: boolean;
  onAdd: () => void;
}

/**
 * A catalogue item row in the add flows: name + category, with an add / Added
 * state. Shared by the quick-add sheet (islands/items.tsx) and the full-screen
 * add page (islands/add-items.tsx). Tapping an un-added row calls onAdd
 * (optimistic); an added row is inert.
 */
export function CatalogueAddRow(
  { name, categoryLabel, added, onAdd }: CatalogueAddRowProps,
) {
  return (
    <ListItem
      headline={name}
      supporting={categoryLabel ?? ""}
      onClick={added ? undefined : onAdd}
      trailing={added
        ? (
          <span class="inline-flex items-center gap-1 text-primary md-label-medium">
            <Icon name="check" size={18} /> Added
          </span>
        )
        : (
          <span class="text-primary">
            <Icon name="plus" size={22} />
          </span>
        )}
    />
  );
}
