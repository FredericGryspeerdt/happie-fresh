import type { Signal } from "@preact/signals";
import type { BarcodeFormat } from "@/models/index.ts";
import {
  detectFormat,
  formatLabel,
  SUPPORTED_FORMATS,
  validateBarcode,
} from "@/utils/barcode.ts";
import { Barcode } from "@/components/md3/Barcode.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { CARD_COLORS } from "./palette.ts";

export interface CardFormSignals {
  label: Signal<string>;
  value: Signal<string>;
  format: Signal<BarcodeFormat>;
  color: Signal<string>;
  /** True once the user overrides the auto-detected format by hand. */
  manualFormat: Signal<boolean>;
}

interface CardFormProps {
  form: CardFormSignals;
  scannerAvailable: boolean;
  saving: boolean;
  submitLabel?: string;
  submitIcon?: IconName;
  onScan: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const NUMERIC: BarcodeFormat[] = ["ean13", "ean8", "upca"];

const fieldLabel =
  "md-label-medium uppercase tracking-wide text-on-surface-variant px-1 mb-1";

export function CardForm(
  {
    form,
    scannerAvailable,
    saving,
    submitLabel = "Save card",
    submitIcon = "plus",
    onScan,
    onSubmit,
    onCancel,
  }: CardFormProps,
) {
  const value = form.value.value;
  const format = form.format.value;
  const trimmed = value.trim();
  const check = validateBarcode(value, format);
  const canSave = form.label.value.trim().length > 0 && check.ok;
  const isAuto = !form.manualFormat.value;

  const onValueInput = (next: string) => {
    form.value.value = next;
    // Keep the format in sync with the value until the user picks one by hand.
    if (!form.manualFormat.value) form.format.value = detectFormat(next);
  };

  const pickAuto = () => {
    form.manualFormat.value = false;
    form.format.value = detectFormat(form.value.value);
  };

  const pickFormat = (f: BarcodeFormat) => {
    form.manualFormat.value = true;
    form.format.value = f;
  };

  return (
    <div class="flex flex-col gap-5 pt-1">
      {/* Label */}
      <div class="flex flex-col">
        <label class={fieldLabel}>Card name</label>
        <div class="flex items-center bg-surface-chighest rounded-[var(--md-shape-sm)] h-12 px-4">
          <input
            value={form.label.value}
            onInput={(e) => (form.label.value = e.currentTarget.value)}
            placeholder="e.g. Delhaize"
            aria-label="Card name"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
        </div>
      </div>

      {/* Value + scan */}
      <div class="flex flex-col">
        <label class={fieldLabel}>Barcode number</label>
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-sm)] h-12 pl-4 pr-1.5">
          <input
            value={value}
            onInput={(e) => onValueInput(e.currentTarget.value)}
            placeholder="Type or scan the number"
            aria-label="Barcode number"
            inputMode={NUMERIC.includes(format) ? "numeric" : "text"}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {scannerAvailable && (
            <Pressable
              onClick={onScan}
              aria-label="Scan barcode with camera"
              class="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--md-shape-full)] bg-secondary-container text-on-secondary-container shrink-0"
            >
              <Icon name="expand" size={18} />
              <span class="md-label-large">Scan</span>
            </Pressable>
          )}
        </div>
        {trimmed.length > 0 && !check.ok && (
          <span class="md-body-small text-error px-1 mt-1">
            {check.message}
          </span>
        )}
      </div>

      {/* Format */}
      <div class="flex flex-col">
        <label class={fieldLabel}>Barcode type</label>
        <div class="flex gap-2 overflow-x-auto pr-1 pb-1">
          <Chip
            selected={isAuto}
            leadingCheck={false}
            onClick={pickAuto}
          >
            {isAuto && trimmed.length > 0
              ? `Auto · ${formatLabel(format)}`
              : "Auto"}
          </Chip>
          {SUPPORTED_FORMATS.map((f) => (
            <Chip
              key={f.format}
              selected={!isAuto && format === f.format}
              leadingCheck={false}
              onClick={() => pickFormat(f.format)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Colour */}
      <div class="flex flex-col">
        <label class={fieldLabel}>Colour</label>
        <div class="flex gap-3 pl-1">
          {CARD_COLORS.map((c) => {
            const on = form.color.value === c.key;
            return (
              <Pressable
                key={c.key}
                onClick={() => (form.color.value = c.key)}
                aria-label={`Colour ${c.key}`}
                aria-pressed={on ? "true" : "false"}
                class="grid place-items-center rounded-full shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: c.bg,
                  outline: on ? "2px solid var(--md-on-surface)" : "none",
                  outlineOffset: 2,
                }}
              >
                {on && (
                  <span style={{ color: c.fg }}>
                    <Icon name="check" size={18} stroke={2.6} />
                  </span>
                )}
              </Pressable>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div class="flex flex-col">
        <label class={fieldLabel}>Preview</label>
        <div class="grid place-items-center bg-white rounded-[var(--md-shape-md)] border border-outline-variant min-h-24 p-3">
          {check.ok
            ? (
              <div
                class="w-full grid place-items-center"
                style={{ maxWidth: format === "qrcode" ? 140 : 280 }}
              >
                <Barcode
                  value={trimmed}
                  format={format}
                  includeText={false}
                  class="w-full"
                />
              </div>
            )
            : (
              <span class="md-body-small text-on-surface-variant">
                Enter a valid number to preview the barcode.
              </span>
            )}
        </div>
      </div>

      {/* Actions */}
      <div class="flex gap-3 pt-1">
        <Button variant="text" full onClick={onCancel}>Cancel</Button>
        <Button
          variant="filled"
          full
          icon={submitIcon}
          disabled={!canSave}
          loading={saving}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
