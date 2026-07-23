import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface CatalogueAddRowProps {
  name: string;
  categoryLabel?: string;
  added: boolean;
  onAdd: () => void;
  /** When added: inline quantity + tap-to-edit affordances. */
  quantity?: number;
  onQtyChange?: (v: number) => void;
  onEdit?: () => void;
  /** Added-section variant only: a remove-from-list control. */
  onRemove?: () => void;
}

/**
 * A catalogue item row on the full-screen add page. Un-added: the whole row
 * adds the item (optimistic). Added: the row is tappable to edit (note/qty) and
 * carries an inline quantity stepper; the Added-section variant also shows a
 * remove control. The Stepper stops event propagation, so stepping never
 * triggers the row's edit tap.
 *
 * Backward-compat: an added row with no `quantity`/`onQtyChange` falls back to a
 * static "✓ Added" label and is inert (no tap-to-edit), matching the original
 * quick-add callers that pass only `{ name, added, onAdd }`.
 */
export function CatalogueAddRow(
  {
    name,
    categoryLabel,
    added,
    onAdd,
    quantity,
    onQtyChange,
    onEdit,
    onRemove,
  }: CatalogueAddRowProps,
) {
  if (!added) {
    return (
      <ListItem
        headline={name}
        supporting={categoryLabel ?? ""}
        onClick={onAdd}
        trailing={
          <span class="text-primary">
            <Icon name="plus" size={22} />
          </span>
        }
      />
    );
  }

  const canStep = quantity != null && !!onQtyChange;
  return (
    <ListItem
      headline={name}
      supporting={categoryLabel ?? ""}
      onClick={onEdit}
      trailing={
        <div class="flex items-center gap-1.5">
          {onRemove && (
            <Pressable
              onClick={onRemove}
              stop
              aria-label={`Remove ${name}`}
              class="w-8 h-8 grid place-items-center rounded-full text-on-surface-variant"
            >
              <Icon name="x" size={18} />
            </Pressable>
          )}
          {canStep
            ? <Stepper value={quantity!} onChange={onQtyChange!} />
            : (
              <span class="inline-flex items-center gap-1 text-primary md-label-medium">
                <Icon name="check" size={18} /> Added
              </span>
            )}
        </div>
      }
    />
  );
}
