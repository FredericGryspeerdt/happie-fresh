import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { For } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import { api } from "@/services/api.ts";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { SearchBar } from "@/components/md3/SearchBar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface ItemsProps {
  listId: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  { listId, items: catalog, shoppingList, categories: initialCategories }:
    ItemsProps,
) {
  // useMemo with [] ensures useShoppingList is called only once.
  // useShoppingList uses plain signal() (not useSignal), so calling it on every
  // re-render would recreate all signals from SSR props, discarding local state.
  const {
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    refresh,
    getItemName,
    groupedList,
    selectedCategoryId,
    listItemsMap,
    categories,
    items,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );

  // ── mode toggle ──────────────────────────────────────────────────────────
  const mode = useSignal<"plan" | "shop">("plan");

  // ── sheet signals ────────────────────────────────────────────────────────
  const addOpen = useSignal(false);
  const editingId = useSignal<string | null>(null);

  // ── item-editor: "Saved" flash ───────────────────────────────────────────
  const savedAt = useSignal(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = () => {
    savedAt.value = Date.now();
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      savedAt.value = 0;
    }, 1400);
  };
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // ── search / filter for add-item sheet ──────────────────────────────────
  const filterFn = (searchString: string, item: ItemInterface) => {
    if (searchString.trim() === "") return false;
    return !!item?.name?.toLowerCase().includes(searchString.toLowerCase());
  };

  const { query, results, inputRef, reset } = useSearchBox(catalog, filterFn);

  // ── add-item handlers ────────────────────────────────────────────────────
  const handleAddToList = async (itemId: string) => {
    await addToList(itemId);
    // keep sheet open so multiple items can be added quickly
  };

  const handleCreateItem = async (searchString: string) => {
    await addToCatalog(searchString, selectedCategoryId.value || undefined);
    selectedCategoryId.value = "";
    reset();
  };

  // ── item-editor: get current list item being edited ──────────────────────
  const editingListItem = () =>
    editingId.value
      ? (groupedList.value.flatMap((g) => g.items).find((li) =>
        li.id === editingId.value
      ) ?? null)
      : null;

  // ── item-editor: category change ─────────────────────────────────────────
  // Category lives on the catalog item (item.categoryId), not on the list item.
  // To change it we must call api.items.update() then refresh() to pull the new
  // categoryId back into the items signal — updateListItem only patches list-level
  // fields (qty, note, checked) and does not touch catalog metadata.
  const handleCategoryChange = async (newCategoryId: string) => {
    const li = editingListItem();
    if (!li) return;
    const name = getItemName(li.itemId);
    await api.items.update(li.itemId!, name, newCategoryId);
    await refresh();
    flash();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-4 pb-24">
      {/* Mode toggle */}
      <Segmented
        options={[
          ["plan", "edit", "Plan"],
          ["shop", "cart", "Shop"],
        ]}
        value={mode.value}
        onChange={(m) => {
          mode.value = m as "plan" | "shop";
        }}
      />

      {/* ── Plan mode ── */}
      {mode.value === "plan" && (
        <div class="flex flex-col gap-4">
          {/* SearchBar opens the add-item sheet */}
          <SearchBar
            placeholder="Add item or search catalogue…"
            onClick={() => {
              addOpen.value = true;
            }}
            trailing={
              <span class="text-primary">
                <Icon name="plus" size={22} />
              </span>
            }
          />

          {/* Grouped list */}
          <For each={groupedList}>
            {(group) => (
              <div class="flex flex-col gap-2">
                {/* SubHeader */}
                <div class="md-title-small text-primary uppercase tracking-wide px-1">
                  {group.category?.label ?? "Uncategorized"}
                </div>

                {/* Card of rows */}
                <Card variant="filled" pad={0} radius={16}>
                  {group.items.map((
                    li: ShoppingListItemInterface,
                    idx: number,
                  ) => (
                    <div key={li.id}>
                      <div class="flex items-center gap-3 px-4 py-3">
                        {/* Pressable name/note area opens item-editor sheet */}
                        <Pressable
                          as="div"
                          onClick={() => {
                            editingId.value = li.id ?? null;
                          }}
                          class="flex-1 min-w-0 cursor-pointer"
                        >
                          <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
                            {getItemName(li.itemId)}
                          </div>
                          {li.note && (
                            <div class="md-body-small text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
                              📝 {li.note}
                            </div>
                          )}
                        </Pressable>

                        {/* Inline quantity stepper */}
                        <Stepper
                          value={li.quantity ?? 1}
                          onChange={(v) =>
                            updateListItem(li.id!, { quantity: v })}
                        />
                      </div>

                      {/* 1px divider between rows, not after last */}
                      {idx < group.items.length - 1 && (
                        <div
                          class="bg-surface-chigh mx-4"
                          style={{ height: 1 }}
                        />
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </For>

          {groupedList.value.length === 0 && (
            <p class="md-body-large text-on-surface-variant text-center py-8">
              Tap the search bar to add items.
            </p>
          )}
        </div>
      )}

      {/* ── Shop mode placeholder (next task fills this in) ── */}
      {mode.value === "shop" && (
        <p class="md-body-large text-on-surface-variant text-center py-16">
          Shop mode — built in the next step
        </p>
      )}

      {/* ══════════════════════ Add-item sheet ══════════════════════ */}
      <Sheet
        open={addOpen.value}
        onClose={() => {
          addOpen.value = false;
          reset();
        }}
        title="Add items"
      >
        {/* Search input */}
        <div class="relative mb-3">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
            <Icon name="search" size={20} />
          </span>
          <input
            ref={inputRef}
            value={query.value}
            onInput={(e) => {
              query.value = (e.target as HTMLInputElement).value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.value.trim()) {
                const q = query.value.trim();
                const exact = items.value.some((i) =>
                  i.name?.toLowerCase() === q.toLowerCase()
                );
                if (!exact) handleCreateItem(q);
              }
            }}
            placeholder="Search or add an item…"
            class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3.5 pl-11 pr-4 outline-none"
          />
        </div>

        {/* "Add '<query>'" card — shown when non-empty query and no exact match */}
        {(() => {
          const q = query.value.trim();
          const exact = q
            ? items.value.some((i) => i.name?.toLowerCase() === q.toLowerCase())
            : true;
          if (!q || exact) return null;
          return (
            <div class="bg-primary-container text-on-primary-container rounded-[var(--md-shape-lg)] p-3.5 mb-3 flex flex-col gap-3">
              <div class="flex items-center gap-3.5">
                <span class="w-9 h-9 rounded-full bg-on-primary-container text-primary-container grid place-items-center shrink-0">
                  <Icon name="plus" size={20} />
                </span>
                <div class="flex-1 min-w-0">
                  <div class="md-body-large">Add "{q}"</div>
                  <div class="md-body-small opacity-80">
                    New item — pick a category
                  </div>
                </div>
              </div>

              {/* Category chips */}
              <div class="flex gap-2 flex-wrap">
                <Chip
                  selected={!selectedCategoryId.value}
                  onClick={() => {
                    selectedCategoryId.value = "";
                  }}
                >
                  Uncategorized
                </Chip>
                <For each={categories}>
                  {(cat) => (
                    <Chip
                      selected={selectedCategoryId.value === cat.id}
                      onClick={() => {
                        selectedCategoryId.value = cat.id ?? "";
                      }}
                    >
                      {cat.label}
                    </Chip>
                  )}
                </For>
              </div>

              <Button
                variant="filled"
                full
                onClick={() => handleCreateItem(q)}
                style={{
                  background: "var(--md-on-primary-container)",
                  color: "var(--md-primary-container)",
                }}
              >
                Add to {categories.value.find((c) =>
                  c.id === selectedCategoryId.value
                )?.label ?? "Uncategorized"}
              </Button>
            </div>
          );
        })()}

        {/* Catalogue list */}
        <div class="flex flex-col">
          {!query.value.trim() && (
            <div class="md-label-medium text-on-surface-variant uppercase tracking-widest mb-1 px-1">
              From your catalogue
            </div>
          )}
          <For each={results}>
            {(item) => {
              const added = listItemsMap.value.has(item.id ?? "");
              return (
                <ListItem
                  key={item.id}
                  headline={item.name ?? ""}
                  supporting={categories.value.find((c) =>
                    c.id === item.categoryId
                  )?.label ?? ""}
                  onClick={added
                    ? undefined
                    : () => item.id && handleAddToList(item.id)}
                  trailing={added
                    ? (
                      <span class="inline-flex items-center gap-1 text-primary md-label-medium">
                        <Icon name="check" size={18} /> Added
                      </span>
                    )
                    : (
                      <span class="text-primary">
                        <Icon name="plus" size={22} />
                      </span>
                    )}
                />
              );
            }}
          </For>
          {query.value.trim() && results.value.length === 0 && (
            <p class="md-body-medium text-on-surface-variant px-1 py-3.5">
              No catalogue match — use "Add "{query.value.trim()}"" above to
              create it.
            </p>
          )}
        </div>
      </Sheet>

      {/* ══════════════════════ Item-editor sheet ══════════════════════ */}
      <Sheet
        open={editingId.value !== null}
        onClose={() => {
          editingId.value = null;
          savedAt.value = 0;
        }}
        title={editingId.value ? getItemName(editingListItem()?.itemId) : ""}
      >
        {(() => {
          const li = editingListItem();
          if (!li) return null;

          // Find category currently on the catalog item
          const catalogItem = items.value.find((i) => i.id === li.itemId);
          const currentCategoryId = catalogItem?.categoryId ?? "";

          return (
            <div class="flex flex-col gap-1.5 pb-1">
              {/* Saved pill — reserves row height, mounts only while flashing */}
              <div class="h-6 flex justify-end items-center px-1">
                {savedAt.value > 0 && (
                  <span
                    key={savedAt.value}
                    class="inline-flex items-center gap-1 md-label-medium text-on-tertiary-container bg-tertiary-container rounded-full px-2.5 py-0.5 pointer-events-none"
                  >
                    <Icon name="check" size={14} /> Saved
                  </span>
                )}
              </div>

              {/* Quantity */}
              <div class="flex items-center justify-between px-1 py-1.5">
                <span class="md-body-large text-on-surface">Quantity</span>
                <Stepper
                  value={li.quantity ?? 1}
                  onChange={(v) => {
                    updateListItem(li.id!, { quantity: v });
                    flash();
                  }}
                />
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Category */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-3">Category</div>
                <div class="flex gap-2 flex-wrap">
                  <Chip
                    selected={!currentCategoryId}
                    onClick={() => handleCategoryChange("")}
                  >
                    Uncategorized
                  </Chip>
                  <For each={categories}>
                    {(cat) => (
                      <Chip
                        selected={currentCategoryId === cat.id}
                        onClick={() => cat.id && handleCategoryChange(cat.id)}
                      >
                        {cat.label}
                      </Chip>
                    )}
                  </For>
                </div>
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Note */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-2">Note</div>
                <textarea
                  value={li.note ?? ""}
                  onInput={(e) => {
                    updateListItem(li.id!, {
                      note: (e.target as HTMLTextAreaElement).value,
                    });
                    flash();
                  }}
                  rows={2}
                  placeholder="e.g. the red ones, big pack, any brand…"
                  class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
                />
              </div>

              {/* Done button */}
              <Button
                variant="filled"
                full
                onClick={() => {
                  editingId.value = null;
                  savedAt.value = 0;
                }}
                class="mt-2.5"
              >
                Done
              </Button>

              {/* Remove from list */}
              <Button
                variant="error"
                full
                onClick={async () => {
                  const id = li.id!;
                  editingId.value = null;
                  savedAt.value = 0;
                  await removeListItem(id);
                }}
                class="mt-2"
              >
                Remove from list
              </Button>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
