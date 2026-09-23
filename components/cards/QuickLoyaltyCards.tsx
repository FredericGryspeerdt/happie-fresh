import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { LoyaltyCardInterface } from "@/models/index.ts";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { navigateTo } from "@/utils/loading.ts";
import { CardPresent } from "./CardPresent.tsx";

const RECENT_CARDS_KEY = "happie:recent-loyalty-cards";
const MAX_RECENT_CARDS = 10;

interface QuickLoyaltyCardsProps {
  cards: LoyaltyCardInterface[];
  open: boolean;
  onClose: () => void;
}

export function orderQuickLoyaltyCards(
  cards: LoyaltyCardInterface[],
  recentIds: string[],
): LoyaltyCardInterface[] {
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  return [...cards].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.label.localeCompare(b.label);
  });
}

export function resetPresentedQuickLoyaltyCardWhenClosed(
  open: boolean,
  presented: LoyaltyCardInterface | null,
): LoyaltyCardInterface | null {
  return open ? presented : null;
}

export function QuickLoyaltyCards(
  { cards, open, onClose }: QuickLoyaltyCardsProps,
) {
  const presented = useSignal<LoyaltyCardInterface | null>(null);
  const recentIds = useSignal<string[]>([]);

  const remember = (id: string) => {
    const updated = [
      id,
      ...recentIds.value.filter((recentId) => recentId !== id),
    ]
      .slice(0, MAX_RECENT_CARDS);
    recentIds.value = updated;
    try {
      localStorage.setItem(RECENT_CARDS_KEY, JSON.stringify(updated));
    } catch {
      // Device storage is optional; the picker still works without it.
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_CARDS_KEY) ?? "[]");
      recentIds.value = Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string").slice(
          0,
          MAX_RECENT_CARDS,
        )
        : [];
    } catch {
      recentIds.value = [];
    }
  }, []);

  useEffect(() => {
    if (open && cards.length === 1 && !presented.value) remember(cards[0].id);
  }, [open, cards]);

  useEffect(() => {
    presented.value = resetPresentedQuickLoyaltyCardWhenClosed(
      open,
      presented.value,
    );
  }, [open]);

  const presentCard = (card: LoyaltyCardInterface) => {
    remember(card.id);
    presented.value = card;
  };
  const closeAll = () => {
    presented.value = null;
    onClose();
  };
  const ordered = orderQuickLoyaltyCards(cards, recentIds.value);
  const visiblePresented = resetPresentedQuickLoyaltyCardWhenClosed(
    open,
    presented.value,
  );

  if (!open) return null;
  if (visiblePresented || cards.length === 1) {
    const card = visiblePresented ?? cards[0];
    return <CardPresent card={card} onClose={closeAll} />;
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choose a loyalty card">
      {cards.length === 0
        ? (
          <div class="flex flex-col items-center gap-4 py-6 text-center">
            <Icon name="card" size={32} />
            <div>
              <div class="md-title-medium text-on-surface">
                No loyalty cards yet
              </div>
              <p class="md-body-medium text-on-surface-variant mt-1">
                Add one once, then it will be ready here while you shop.
              </p>
            </div>
            <Button onClick={() => navigateTo("/cards")}>
              Add a loyalty card
            </Button>
          </div>
        )
        : (
          <div class="flex flex-col py-1">
            {ordered.map((card) => (
              <ListItem
                key={card.id}
                leading={<Icon name="card" size={24} />}
                headline={card.label}
                trailing={<Icon name="chevron" size={18} />}
                onClick={() => presentCard(card)}
              />
            ))}
          </div>
        )}
    </Sheet>
  );
}
