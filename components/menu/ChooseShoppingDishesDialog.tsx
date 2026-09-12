import type { DishInterface } from "@/models/index.ts";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Button } from "@/components/md3/Button.tsx";

export function ChooseShoppingDishesDialog(
  { open, dishes, selected, busy, onToggle, onContinue, onClose }: {
    open: boolean;
    dishes: DishInterface[];
    selected: Set<string>;
    busy: boolean;
    onToggle: (id: string) => void;
    onContinue: () => void;
    onClose: () => void;
  },
) {
  return (
    <FullScreenDialog
      open={open}
      title="Choose dishes"
      onClose={onClose}
      footer={
        <Button
          full
          disabled={!selected.size}
          loading={busy}
          onClick={onContinue}
        >
          Review ingredients
        </Button>
      }
    >
      <p class="md-body-large text-on-surface mt-3">
        What are you shopping for?
      </p>
      <p class="md-body-medium text-on-surface-variant mt-1 mb-5">
        Choose from this week's menu.
      </p>
      {dishes.map((d) => (
        <label
          key={d.id}
          class="relative flex items-center gap-4 min-h-18 py-3 border-b border-outline-variant cursor-pointer"
        >
          <input
            type="checkbox"
            class="absolute opacity-0 peer"
            checked={selected.has(d.id)}
            disabled={busy}
            onChange={() => onToggle(d.id)}
          />
          <span class="peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full">
            <RoundCheck checked={selected.has(d.id)} />
          </span>
          <span class="min-w-0">
            <span class="md-title-medium block">{d.name}</span>
            <span class="md-body-medium text-on-surface-variant">
              {d.ingredientIds.length
                ? `${d.ingredientIds.length} ingredients`
                : "No ingredients yet"}
            </span>
          </span>
        </label>
      ))}
    </FullScreenDialog>
  );
}
