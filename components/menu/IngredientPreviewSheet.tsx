import type { DishInterface } from "@/models/index.ts";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { ListSubheader } from "@/components/md3/ListSubheader.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";

interface Props {
  open: boolean;
  listName: string;
  rows: IngredientRow[];
  isSelected: (row: IngredientRow) => boolean;
  emptyDishes: DishInterface[];
  selectedCount: number;
  adding: boolean;
  onToggle: (itemId: string) => void;
  onConfirm: () => void;
  onOpenDish: (dish: DishInterface) => void;
  onClose: () => void;
}

function supportingFor(row: IngredientRow): string {
  const dishes = row.dishNames.join(", ");
  if (row.state === "on-list") return "Already on the list";
  if (row.state === "bought") return `Will be put back · ${dishes}`;
  return dishes;
}

// Review step before the bulk write: every ingredient this week needs, flat
// and alphabetical, ticked by default. Rows already on the list are shown but
// locked so nobody wonders where their pasta went.
export function IngredientPreviewSheet(
  {
    open,
    listName,
    rows,
    isSelected,
    emptyDishes,
    selectedCount,
    adding,
    onToggle,
    onConfirm,
    onOpenDish,
    onClose,
  }: Props,
) {
  const label = selectedCount === 1
    ? "Add 1 item"
    : `Add ${selectedCount} items`;
  const nothing = rows.length === 0 && emptyDishes.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title={listName} size="large">
      <div class="-mx-6">
        {nothing && (
          <p class="md-body-medium text-on-surface-variant px-6 py-6 text-center">
            Nothing to add — the planned dishes have no ingredients yet.
          </p>
        )}
        {rows.map((row) => {
          const locked = row.state === "on-list";
          return (
            <ListItem
              key={row.itemId}
              class={locked ? "opacity-50" : undefined}
              leading={<RoundCheck checked={locked || isSelected(row)} />}
              headline={row.name}
              supporting={supportingFor(row)}
              onClick={locked ? undefined : () => onToggle(row.itemId)}
            />
          );
        })}
        {emptyDishes.length > 0 && (
          <>
            <ListSubheader>No ingredients yet</ListSubheader>
            {emptyDishes.map((d) => (
              <ListItem
                key={d.id}
                headline={d.name}
                supporting="Add ingredients to this dish"
                trailing={<Icon name="chevron" size={20} />}
                onClick={() => onOpenDish(d)}
              />
            ))}
          </>
        )}
      </div>
      {/* Sticky so the confirm stays reachable on a long week. */}
      <div class="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-surface-clow">
        <Button
          full
          icon="cart"
          loading={adding}
          disabled={selectedCount === 0}
          onClick={onConfirm}
        >
          {label}
        </Button>
      </div>
    </Sheet>
  );
}
