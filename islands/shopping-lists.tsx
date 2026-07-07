import { useSignal } from "@preact/signals";
import { ShoppingListInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Card } from "@/components/md3/Card.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";
import Fab from "@/islands/shell/Fab.tsx";

type ShoppingListWithCounts = ShoppingListInterface & {
  total: number;
  done: number;
};

interface ShoppingListsProps {
  initialLists: ShoppingListWithCounts[];
}

/** Returns a human-readable relative time string from a Unix-ms or ISO-string timestamp. */
function relativeTime(msOrString: number | string): string {
  const ms = typeof msOrString === "string"
    ? new Date(msOrString).getTime()
    : msOrString;
  if (isNaN(ms)) return "recently";
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "yesterday";
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SEGMENTED_OPTIONS: [string, "cart" | "tag", string][] = [
  ["lists", "cart", "Lists"],
  ["catalogue", "tag", "Catalogue"],
];

export default function ShoppingLists({ initialLists }: ShoppingListsProps) {
  const lists = useSignal<ShoppingListWithCounts[]>(initialLists);
  const newName = useSignal("");
  const tab = useSignal<"lists" | "catalogue">("lists");
  const newOpen = useSignal(false);
  const loading = useSignal(false);

  const createList = async () => {
    const name = newName.value.trim();
    if (!name) return;
    loading.value = true;
    try {
      const created = await api.shoppingLists.create(name);
      if (created) {
        lists.value = [...lists.value, { ...created, total: 0, done: 0 }];
        newName.value = "";
        newOpen.value = false;
      }
    } finally {
      loading.value = false;
    }
  };

  return (
    <>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
        <Segmented
          options={SEGMENTED_OPTIONS}
          value={tab.value}
          onChange={(k) => {
            tab.value = k as "lists" | "catalogue";
          }}
        />
      </div>

      {/* Catalogue tab */}
      {tab.value === "catalogue" && (
        <ComingSoon
          icon="tag"
          title="Catalogue"
          blurb="Browse and manage your household's item library — coming soon."
        />
      )}

      {/* Lists tab */}
      {tab.value === "lists" && (
        <div class="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-3 pt-2">
          {lists.value.length === 0
            ? (
              /* Empty state */
              <div class="flex flex-col items-center gap-4 text-center py-12">
                <div class="w-[72px] h-[72px] rounded-full bg-secondary-container grid place-items-center text-on-secondary-container">
                  <Icon name="cart" size={32} />
                </div>
                <div>
                  <div class="md-title-medium text-on-surface">
                    No lists yet
                  </div>
                  <div class="md-body-medium text-on-surface-variant mt-1">
                    Tap the + button to start your first shopping list.
                  </div>
                </div>
                <Button
                  variant="filled"
                  onClick={() => {
                    newOpen.value = true;
                  }}
                >
                  New list
                </Button>
              </div>
            )
            : (
              lists.value.map((list) => (
                <Card
                  key={list.id}
                  variant="filled"
                  radius={20}
                  onClick={() => {
                    globalThis.location.href = `/shopping/${list.id}`;
                  }}
                >
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center gap-3">
                      {/* Cart icon circle */}
                      <div class="w-[44px] h-[44px] rounded-full bg-tertiary-container text-on-tertiary-container grid place-items-center shrink-0">
                        <Icon name="cart" size={22} />
                      </div>
                      {/* Name + meta */}
                      <div class="flex-1 min-w-0">
                        <div class="md-title-medium text-on-surface truncate">
                          {list.name}
                        </div>
                        <div class="md-body-small text-on-surface-variant">
                          {list.done}/{list.total} done &middot;{" "}
                          {relativeTime(list.createdAt)}
                        </div>
                      </div>
                      {/* Count badge */}
                      <span class="md-label-large bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-full)] shrink-0 px-3 py-1">
                        {list.total}
                      </span>
                    </div>
                    <Progress value={list.done} total={list.total} />
                  </div>
                </Card>
              ))
            )}
        </div>
      )}

      {/* FAB — the only way to create a list */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="New list"
          aria-label="New list"
          onClick={() => {
            newOpen.value = true;
          }}
        />
      </div>

      {/* New list sheet */}
      <Sheet
        open={newOpen.value}
        onClose={() => {
          newOpen.value = false;
          newName.value = "";
        }}
        title="New list"
      >
        <div class="flex flex-col gap-4 pb-2">
          <input
            type="text"
            placeholder="List name"
            class="border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3 md-body-large text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            value={newName.value}
            onInput={(e) => {
              newName.value = e.currentTarget.value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") createList();
            }}
          />
          <Button
            variant="filled"
            full
            onClick={createList}
            disabled={loading.value}
          >
            Add
          </Button>
        </div>
      </Sheet>
    </>
  );
}
