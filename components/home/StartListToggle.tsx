import { useSignal } from "@preact/signals";
import { api } from "@/services/api.ts";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function StartListToggle(
  { id, initial, onError, onSaved }: {
    id: string;
    initial: boolean;
    onError: () => void;
    onSaved?: (value: boolean) => void;
  },
) {
  const selected = useSignal(initial);
  const saving = useSignal(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected.value}
      disabled={saving.value}
      class="flex items-center gap-4 w-full text-left rounded-xl px-4 py-3 min-h-12 disabled:opacity-60"
      onClick={async () => {
        const before = selected.value;
        selected.value = !before;
        saving.value = true;
        beginBusy();
        try {
          const result = await api.shoppingLists.setShowOnHome(
            id,
            selected.value,
          );
          if (!result) {
            selected.value = before;
            onError();
          } else onSaved?.(selected.value);
        } finally {
          saving.value = false;
          endBusy();
        }
      }}
    >
      <RoundCheck checked={selected.value} />
      <span>
        <span class="block md-body-large">Toon op Start</span>
        <span class="block md-body-small text-on-surface-variant">
          Voor het hele huishouden
        </span>
      </span>
    </button>
  );
}
