import { useSignal } from "@preact/signals";
import { ShoppingListInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Card } from "@/components/md3/Card.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
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
  const pendingDelete = useSignal<{ id: string; name: string } | null>(null);
  const renaming = useSignal<{ id: string; name: string } | null>(null);
  const newOpen = useSignal(false);
  const mgmtTarget = useSignal<ShoppingListWithCounts | null>(null);
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

  const confirmRename = async (id: string) => {
    const name = renaming.value?.name.trim();
    if (!name) return;
    const updated = await api.shoppingLists.rename(id, name);
    if (updated) {
      lists.value = lists.value.map((l) =>
        l.id === id ? { ...l, ...updated } : l
      );
    }
    renaming.value = null;
    mgmtTarget.value = null;
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete.value) return;
    const { id } = pendingDelete.value;
    pendingDelete.value = null;
    await api.shoppingLists.delete(id);
    lists.value = lists.value.filter((l) => l.id !== id);
  };

  const openMgmt = (list: ShoppingListWithCounts) => {
    mgmtTarget.value = list;
    renaming.value = null;
  };

  return (
    <>
      {/* Segmented control */}
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
                      {/* Overflow button */}
                      <IconButton
                        name="dots"
                        aria-label={`Manage ${list.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMgmt(list);
                        }}
                      />
                    </div>
                    <Progress value={list.done} total={list.total} />
                  </div>
                </Card>
              ))
            )}

          {/* Dashed "New list" card */}
          {lists.value.length > 0 && (
            <Pressable
              as="div"
              onClick={() => {
                newOpen.value = true;
              }}
              class="flex items-center justify-center gap-2 text-on-surface-variant"
              style={{
                border: "2px dashed var(--md-outline-variant)",
                borderRadius: 20,
                height: 60,
              }}
            >
              <Icon name="plus" size={20} />
              <span class="md-label-large">New list</span>
            </Pressable>
          )}
        </div>
      )}

      {/* FAB */}
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

      {/* Management sheet (rename / delete) */}
      <Sheet
        open={mgmtTarget.value !== null}
        onClose={() => {
          mgmtTarget.value = null;
          renaming.value = null;
        }}
        title={mgmtTarget.value?.name ?? ""}
      >
        {mgmtTarget.value && (
          <div class="flex flex-col gap-2 pb-4">
            {/* Rename row */}
            {renaming.value
              ? (
                <div class="flex flex-col gap-3 mb-2">
                  <input
                    type="text"
                    class="border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3 md-body-large text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    value={renaming.value.name}
                    onInput={(e) => {
                      if (renaming.value) {
                        renaming.value = {
                          ...renaming.value,
                          name: e.currentTarget.value,
                        };
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && mgmtTarget.value) {
                        confirmRename(mgmtTarget.value.id);
                      }
                      if (e.key === "Escape") renaming.value = null;
                    }}
                  />
                  <div class="flex gap-2">
                    <Button
                      variant="filled"
                      full
                      onClick={() =>
                        mgmtTarget.value && confirmRename(mgmtTarget.value.id)}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outlined"
                      full
                      onClick={() => {
                        renaming.value = null;
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )
              : (
                <Pressable
                  as="div"
                  onClick={() => {
                    if (mgmtTarget.value) {
                      renaming.value = {
                        id: mgmtTarget.value.id,
                        name: mgmtTarget.value.name,
                      };
                    }
                  }}
                  class="flex items-center gap-4 py-4 text-on-surface md-body-large"
                >
                  <Icon name="edit" size={22} />
                  <span>Rename</span>
                </Pressable>
              )}

            {/* Delete row */}
            <Pressable
              as="div"
              onClick={() => {
                if (mgmtTarget.value) {
                  pendingDelete.value = {
                    id: mgmtTarget.value.id,
                    name: mgmtTarget.value.name,
                  };
                  mgmtTarget.value = null;
                  renaming.value = null;
                }
              }}
              class="flex items-center gap-4 py-4 text-error md-body-large"
            >
              <Icon name="trash" size={22} />
              <span>Delete</span>
            </Pressable>
          </div>
        )}
      </Sheet>

      {/* Delete confirm sheet */}
      <Sheet
        open={pendingDelete.value !== null}
        onClose={() => {
          pendingDelete.value = null;
        }}
        title="Delete list?"
      >
        {pendingDelete.value && (
          <div class="flex flex-col gap-3 pb-4">
            <p class="md-body-medium text-on-surface-variant">
              "{pendingDelete.value.name}" and all its items will be permanently
              deleted. This cannot be undone.
            </p>
            <Button
              variant="filled"
              full
              class="bg-error text-on-error"
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
            <Button
              variant="outlined"
              full
              onClick={() => {
                pendingDelete.value = null;
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
