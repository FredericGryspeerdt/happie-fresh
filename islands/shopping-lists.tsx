import { useSignal } from "@preact/signals";
import { ShoppingListInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Card } from "@/components/md3/Card.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { TextField } from "@/components/md3/TextField.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { navigateTo } from "@/utils/loading.ts";

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
  if (isNaN(ms)) return "onlangs";
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "net";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} u geleden`;
  if (hours < 48) return "gisteren";
  const days = Math.floor(hours / 24);
  return `${days} d geleden`;
}

const SEGMENTED_OPTIONS: [string, "cart" | "tag", string][] = [
  ["lists", "cart", "Lijsten"],
  ["catalogue", "tag", "Catalogus"],
];

export default function ShoppingLists({ initialLists }: ShoppingListsProps) {
  const lists = useSignal<ShoppingListWithCounts[]>(initialLists);
  const newName = useSignal("");
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

  const refresh = async () => {
    const fresh = await api.shoppingLists.getAll();
    const withCounts = await Promise.all(
      fresh.map(async (l) => {
        const items = await api.shoppingList.getItems(l.id);
        return {
          ...l,
          total: items.length,
          done: items.filter((i) => i.checked).length,
        };
      }),
    );
    lists.value = withCounts;
  };

  return (
    <PullToRefresh onRefresh={refresh} disabled={newOpen.value}>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
        <Segmented
          options={SEGMENTED_OPTIONS}
          value="lists"
          onChange={(k) => {
            if (k === "catalogue") navigateTo("/shopping/catalogue");
          }}
        />
      </div>

      {/* Lists tab */}
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
                  Nog geen lijsten
                </div>
                <div class="md-body-medium text-on-surface-variant mt-1">
                  Tik op de plusknop om je eerste boodschappenlijst te maken.
                </div>
              </div>
              <Button
                variant="filled"
                onClick={() => {
                  newOpen.value = true;
                }}
              >
                Nieuwe lijst
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
                  navigateTo(`/shopping/${list.id}`);
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
                        {list.done}/{list.total} afgevinkt ·{" "}
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

      {/* FAB — the only way to create a list */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="Nieuwe lijst"
          aria-label="Nieuwe lijst"
          onClick={() => {
            newOpen.value = true;
          }}
        />
      </div>

      {/* New list dialog */}
      <Dialog
        open={newOpen.value}
        onClose={() => {
          newOpen.value = false;
          newName.value = "";
        }}
        headline="Nieuwe lijst"
        actions={
          <>
            <Button
              variant="text"
              disabled={loading.value}
              onClick={() => {
                newOpen.value = false;
                newName.value = "";
              }}
            >
              Annuleren
            </Button>
            <Button
              variant="text"
              disabled={!newName.value.trim()}
              loading={loading.value}
              onClick={createList}
            >
              Toevoegen
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createList();
          }}
        >
          <TextField
            id="new-list-name"
            label="Naam van de lijst"
            disabled={loading.value}
            value={newName.value}
            onInput={(value) => {
              newName.value = value;
            }}
          />
          <button type="submit" class="hidden" tabindex={-1}>Toevoegen</button>
        </form>
      </Dialog>
    </PullToRefresh>
  );
}
