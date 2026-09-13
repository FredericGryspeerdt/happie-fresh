import { SHOPPING_UNITS } from "@/models/index.ts";
import { useSignal } from "@preact/signals";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { TextField } from "@/components/md3/TextField.tsx";
import {
  addShoppingAmounts,
  compatibleShoppingUnits,
  formatShoppingAmount,
  parseShoppingAmount,
  type ShoppingAmount,
  type ShoppingUnit,
} from "@/utils/shopping-amount.ts";

interface Props {
  busy?: boolean;
  additional?: boolean;
  existingAmount?: ShoppingAmount;
  name: string;
  amount: ShoppingAmount;
  onSave: (amount: ShoppingAmount) => void;
  onClose: () => void;
}

export function ShoppingAmountDialog(
  {
    name,
    amount,
    busy = false,
    additional = false,
    existingAmount,
    onSave,
    onClose,
  }: Props,
) {
  const text = useSignal(String(amount.quantity));
  const unit = useSignal<ShoppingUnit>(amount.unit);
  const value = parseShoppingAmount(text.value, unit.value);
  const total = existingAmount && value
    ? addShoppingAmounts(existingAmount, value)
    : null;
  const valid = value && (!existingAmount || total);
  const units = existingAmount
    ? compatibleShoppingUnits(existingAmount.unit)
    : SHOPPING_UNITS;
  const save = () => {
    if (value && valid && !busy) onSave(value);
  };
  return (
    <Dialog
      open
      focusSurface
      onClose={() => {
        if (!busy) onClose();
      }}
      headline={name}
      actions={
        <>
          <Button variant="text" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="text"
            disabled={!valid || busy}
            loading={busy}
            onClick={save}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        class="flex flex-col gap-4"
      >
        <p>
          {additional
            ? "How much would you like to add for these dishes?"
            : "How much do you need?"}
        </p>
        {existingAmount && (
          <p>
            Already on your list:{" "}
            {formatShoppingAmount(existingAmount.quantity, existingAmount.unit)}
          </p>
        )}
        <TextField
          disabled={busy}
          id="shopping-amount"
          label={additional ? "Add for these dishes" : "Amount"}
          inputMode="decimal"
          value={text.value}
          onInput={(v) => text.value = v}
          supporting="Decimals are welcome, e.g. 0.5"
          error={!value
            ? "Enter an amount above 0, up to 99999 (max. 3 decimals)."
            : undefined}
        />
        <fieldset disabled={busy}>
          <legend class="md-label-large mb-2">Unit</legend>
          <div class="grid grid-cols-3 gap-2">
            {units.map((u) => (
              <label
                key={u}
                class={`relative min-h-12 flex items-center justify-center gap-2 rounded-[var(--md-shape-sm)] border px-2 cursor-pointer focus-within:outline-2 focus-within:outline-primary ${
                  unit.value === u
                    ? "bg-secondary-container text-on-secondary-container border-primary"
                    : "border-outline text-on-surface"
                }`}
              >
                <input
                  class="accent-[var(--md-primary)]"
                  type="radio"
                  name="shopping-unit"
                  value={u}
                  checked={unit.value === u}
                  onChange={() => unit.value = u}
                />
                {u}
              </label>
            ))}
          </div>
        </fieldset>
        {existingAmount && (
          <p
            aria-live="polite"
            class={!total ? "text-error" : "text-on-surface"}
          >
            {total
              ? `Total after adding: ${
                formatShoppingAmount(total.quantity, total.unit)
              }`
              : "Choose a compatible unit and keep the total at or below 99999."}
          </p>
        )}
        <button type="submit" class="hidden" tabindex={-1}>Save</button>
      </form>
    </Dialog>
  );
}
