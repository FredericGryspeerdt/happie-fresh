import { useSignal } from "@preact/signals";
import type { LoyaltyCardInterface } from "@/models/index.ts";
import { Barcode } from "@/components/md3/Barcode.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { formatLabel } from "@/utils/barcode.ts";

interface CardPresentProps {
  card: LoyaltyCardInterface;
  onClose: () => void;
  onEdit: (card: LoyaltyCardInterface) => void;
  onDelete: (id: string) => void;
}

/**
 * Full-screen "show at the till" view: a large, high-contrast barcode on white
 * so in-store scanners read it reliably, plus the label, number and
 * confirm-guarded edit/remove actions.
 */
export function CardPresent(
  { card, onClose, onEdit, onDelete }: CardPresentProps,
) {
  const confirming = useSignal(false);
  const isQr = card.format === "qrcode";

  return (
    <div class="fixed inset-0 z-[350] bg-white text-on-surface flex flex-col">
      <div
        class="flex items-center justify-between px-2 pt-2"
        style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}
      >
        <IconButton name="back" aria-label="Close" onClick={onClose} />
        <span class="md-title-medium truncate px-2">{card.label}</span>
        <div class="flex items-center shrink-0">
          <IconButton
            name="edit"
            aria-label="Edit card"
            onClick={() => onEdit(card)}
          />
          <IconButton
            name="trash"
            aria-label="Remove card"
            onClick={() => (confirming.value = true)}
          />
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6">
        <div class="text-center">
          <div class="md-headline-small">{card.label}</div>
          <div class="md-label-medium text-on-surface-variant uppercase tracking-wide mt-1">
            {formatLabel(card.format)}
          </div>
        </div>

        <div
          class="w-full grid place-items-center"
          style={{ maxWidth: isQr ? 260 : 360 }}
        >
          <Barcode value={card.value} format={card.format} class="w-full" />
        </div>

        {isQr && (
          <div class="md-body-large tracking-wide break-all text-center text-on-surface-variant">
            {card.value}
          </div>
        )}
      </div>

      {confirming.value && (
        <div class="px-6 pb-8 pt-2 flex flex-col gap-3 border-t border-outline-variant">
          <span class="md-body-medium text-on-surface-variant text-center">
            Remove “{card.label}” from your cards?
          </span>
          <div class="flex gap-3">
            <Button
              variant="text"
              full
              onClick={() => (confirming.value = false)}
            >
              Cancel
            </Button>
            <Button
              variant="error"
              full
              icon="trash"
              onClick={() => onDelete(card.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
