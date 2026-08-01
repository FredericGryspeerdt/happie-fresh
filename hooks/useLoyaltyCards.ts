import { computed, signal } from "@preact/signals";
import type { LoyaltyCardInput, LoyaltyCardInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

/**
 * Reactive store for a household's loyalty cards. Follows the app's mutation
 * conventions: creates are **pessimistic** (server mints the id, so we wait for
 * the returned card), deletes are **optimistic** (removed locally immediately).
 * The `api` boundary never throws — `addCard` returns `null` on failure so the
 * island can surface a snackbar.
 */
export function useLoyaltyCards(initialCards: LoyaltyCardInterface[]) {
  const cards = signal<LoyaltyCardInterface[]>(initialCards ?? []);
  const pendingCount = signal(0);

  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const sorted = computed<LoyaltyCardInterface[]>(() =>
    [...cards.value].sort((a, b) =>
      a.label.toLowerCase().localeCompare(b.label.toLowerCase())
    )
  );

  const addCard = async (
    input: LoyaltyCardInput,
  ): Promise<LoyaltyCardInterface | null> => {
    startPending();
    try {
      const created = await api.cards.create(input);
      if (created) cards.value = [...cards.value, created];
      return created;
    } finally {
      endPending();
    }
  };

  const removeCard = async (id: string): Promise<void> => {
    cards.value = cards.value.filter((c) => c.id !== id);
    startPending();
    try {
      await api.cards.delete(id);
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    // Pull-to-refresh renders its own spinner, so this intentionally tracks
    // pendingCount without driving the global loading bar (beginBusy/endBusy).
    pendingCount.value++;
    try {
      cards.value = await api.cards.getAll();
    } finally {
      pendingCount.value--;
    }
  };

  return { cards, pendingCount, sorted, addCard, removeCard, refresh };
}
