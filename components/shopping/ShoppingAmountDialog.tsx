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
  onClear?: () => void;
  onClose: () => void;
}

export function ShoppingAmountDialog(
  {
    name,
    amount,
    onClear,
    busy = false,
    additional = false,
    existingAmount,
    onSave,
    onClose,
  }: Props,
) {
  const text = useSignal(formatShoppingAmount(amount.quantity));
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
            Annuleren
          </Button>
          <Button
            variant="text"
            disabled={!valid || busy}
            loading={busy}
            onClick={save}
          >
            Opslaan
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
            ? "Hoeveel wil je toevoegen voor deze gerechten?"
            : "Hoeveel heb je nodig?"}
        </p>
        {existingAmount && (
          <p>
            Staat al op je lijst:{" "}
            {formatShoppingAmount(existingAmount.quantity, existingAmount.unit)}
          </p>
        )}
        <TextField
          disabled={busy}
          id="shopping-amount"
          label={additional ? "Toevoegen voor deze gerechten" : "Hoeveelheid"}
          inputMode="decimal"
          value={text.value}
          onInput={(v) => text.value = v}
          supporting="Kommagetallen zijn ook mogelijk, bv. 0,5"
          error={!value
            ? "Vul een hoeveelheid groter dan 0 en maximaal 99999 in (max. 3 cijfers na de komma)."
            : undefined}
        />
        <fieldset disabled={busy}>
          <legend class="md-label-large mb-2">Eenheid</legend>
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
                {u === "pieces" ? "stuks" : u === "packs" ? "pakken" : u}
              </label>
            ))}
          </div>
        </fieldset>
        {onClear && (
          <Button variant="text" disabled={busy} onClick={onClear}>
            Hoeveelheid wissen
          </Button>
        )}
        {existingAmount && (
          <p
            aria-live="polite"
            class={!total ? "text-error" : "text-on-surface"}
          >
            {total
              ? `Totaal na toevoegen: ${
                formatShoppingAmount(total.quantity, total.unit)
              }`
              : "Kies een passende eenheid en een totaal van maximaal 99999."}
          </p>
        )}
        <button type="submit" class="hidden" tabindex={-1}>Opslaan</button>
      </form>
    </Dialog>
  );
}
