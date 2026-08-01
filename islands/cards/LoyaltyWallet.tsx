import { useMemo } from "preact/hooks";
import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { BarcodeFormat, LoyaltyCardInterface } from "@/models/index.ts";
import { useLoyaltyCards } from "@/hooks/useLoyaltyCards.ts";
import { formatLabel } from "@/utils/barcode.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Button } from "@/components/md3/Button.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import { CardForm } from "@/components/cards/CardForm.tsx";
import { CardPresent } from "@/components/cards/CardPresent.tsx";
import {
  ScannerOverlay,
  scannerSupported,
} from "@/components/cards/ScannerOverlay.tsx";
import {
  DEFAULT_CARD_COLOR,
  nextColor,
  resolveColor,
} from "@/components/cards/palette.ts";

interface Props {
  initialCards: LoyaltyCardInterface[];
}

/** `•••• 1234` for longer numbers; the raw value for short ones. */
function maskValue(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return v;
  return `•••• ${v.slice(-4)}`;
}

export default function LoyaltyWallet({ initialCards }: Props) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const { sorted, cards, addCard, removeCard, refresh } = useMemo(
    () => useLoyaltyCards(initialCards),
    [],
  );

  const addOpen = useSignal(false);
  const scannerOpen = useSignal(false);
  const present = useSignal<LoyaltyCardInterface | null>(null);
  const saving = useSignal(false);
  const scannerAvailable = useSignal(false);
  const snack = useSignal<{ msg: string } | null>(null);

  const form = {
    label: useSignal(""),
    value: useSignal(""),
    format: useSignal<BarcodeFormat>("code128"),
    color: useSignal(DEFAULT_CARD_COLOR),
    manualFormat: useSignal(false),
  };

  // Feature-detect the camera scanner on the client only (avoids SSR mismatch).
  useEffect(() => {
    if (scannerSupported()) scannerAvailable.value = true;
  }, []);

  const toast = (msg: string) => {
    snack.value = { msg };
    setTimeout(() => (snack.value = null), 2400);
  };

  const openAdd = () => {
    form.label.value = "";
    form.value.value = "";
    form.format.value = "code128";
    form.color.value = nextColor(cards.value.length);
    form.manualFormat.value = false;
    addOpen.value = true;
  };

  const onScanDetect = (value: string, format: BarcodeFormat) => {
    form.value.value = value;
    form.format.value = format;
    form.manualFormat.value = true;
    scannerOpen.value = false;
  };

  const handleSave = async () => {
    saving.value = true;
    const created = await addCard({
      label: form.label.value.trim(),
      value: form.value.value.trim(),
      format: form.format.value,
      color: form.color.value,
    });
    saving.value = false;
    if (!created) {
      toast("Couldn't save that card — try again.");
      return;
    }
    addOpen.value = false;
  };

  const handleDelete = (id: string) => {
    present.value = null;
    removeCard(id);
    toast("Card removed.");
  };

  const list = sorted.value;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="md-title-large text-on-surface">Loyalty cards</h1>
          <p class="md-body-medium text-on-surface-variant">
            Your household's cards, ready to scan at the till.
          </p>
        </div>

        {list.length === 0
          ? (
            <div class="px-2 pt-8 text-center flex flex-col items-center gap-4">
              <span
                class="grid place-items-center bg-primary-container text-on-primary-container rounded-full"
                style={{ width: 64, height: 64 }}
              >
                <Icon name="card" size={30} />
              </span>
              <div class="md-title-medium text-on-surface">No cards yet</div>
              <p class="md-body-medium text-on-surface-variant max-w-xs">
                Add your first loyalty card and Happie will show its barcode
                whenever you shop.
              </p>
              <Button variant="tonal" icon="plus" onClick={openAdd}>
                Add a card
              </Button>
            </div>
          )
          : (
            <div class="flex flex-col gap-3">
              {list.map((c) => {
                const color = resolveColor(c.color);
                return (
                  <Pressable
                    key={c.id}
                    onClick={() => (present.value = c)}
                    aria-label={`Show ${c.label} barcode`}
                    class="flex flex-col justify-between text-left rounded-[var(--md-shape-lg)] px-5 py-4 md-elevation-1"
                    style={{
                      background: color.bg,
                      color: color.fg,
                      minHeight: 96,
                    }}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <span class="md-title-medium truncate">{c.label}</span>
                      <Icon name="card" size={22} />
                    </div>
                    <span class="md-body-small" style={{ opacity: 0.85 }}>
                      {formatLabel(c.format)} · {maskValue(c.value)}
                    </span>
                  </Pressable>
                );
              })}
            </div>
          )}
      </div>

      {/* Add-card FAB — shared component, fixed below the nav chrome */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="Add card"
          aria-label="Add card"
          onClick={openAdd}
        />
      </div>

      <Sheet
        open={addOpen.value}
        onClose={() => (addOpen.value = false)}
        title="Add a card"
      >
        <CardForm
          form={form}
          scannerAvailable={scannerAvailable.value}
          saving={saving.value}
          onScan={() => (scannerOpen.value = true)}
          onSubmit={handleSave}
          onCancel={() => (addOpen.value = false)}
        />
      </Sheet>

      {scannerOpen.value && (
        <ScannerOverlay
          onDetect={onScanDetect}
          onClose={() => (scannerOpen.value = false)}
          onError={(msg) => toast(msg)}
        />
      )}

      {present.value && (
        <CardPresent
          card={present.value}
          onClose={() => (present.value = null)}
          onDelete={handleDelete}
        />
      )}

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
