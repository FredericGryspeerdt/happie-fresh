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
import { CategoryPickerList } from "@/components/md3/CategoryPickerList.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { appBarAction } from "@/utils/app-bar.ts";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface ItemsProps {
  listId: string;
  listName: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  {
    listId,
    listName,
    items: catalog,
    shoppingList,
    categories: initialCategories,
  }: ItemsProps,
) {
  // useMemo with [] ensures useShoppingList is called only once.
  // useShoppingList uses plain signal() (not useSignal), so calling it on every
  // re-render would recreate all signals from SSR props, discarding local state.
  const {
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    checkItem,
    uncheckItem,
    refresh,
    getItemName,
    groupedList,
    list,
    checkedItems,
    selectedCategoryId,
    listItemsMap,
    categories,
    items,
    lastSaved,
    flushListItem,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );

  // ── mode toggle ──────────────────────────────────────────────────────────
  const mode = useSignal<"plan" | "shop">("plan");

  // ── shop mode: pending check items (optimistic UI) ───────────────────────
  const pendingItemIds = useSignal<Set<string>>(new Set());

  // ── shop mode: check item wrapper ────────────────────────────────────────
  const handleCheckItem = async (id: string) => {
    pendingItemIds.value = new Set([...pendingItemIds.value, id]);
    try {
      await checkItem(id);
    } finally {
      const next = new Set(pendingItemIds.value);
      next.delete(id);
      pendingItemIds.value = next;
    }
  };

  // ── shop mode: "In cart" collapsible ─────────────────────────────────────
  const showDone = useSignal(false);

  // ── list management sheet ────────────────────────────────────────────────
  const mgmtOpen = useSignal(false);
  const renameValue = useSignal("");
  const snackData = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnack = (msg: string) => {
    snackData.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => {
      snackData.value = null;
    }, 3000);
  };

  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  // ── register the "list options" overflow into the shell's TopAppBar ───────
  // The top app bar is rendered by the shell (AppChrome), a separate island;
  // we hand it a trailing action via a shared module-scope signal.
  useEffect(() => {
    appBarAction.value = {
      icon: "dots",
      label: "List options",
      onClick: () => {
        renameValue.value = listName;
        mgmtOpen.value = true;
      },
    };
    return () => {
      appBarAction.value = null;
    };
  }, []);

  // ── sheet signals ────────────────────────────────────────────────────────
  const addOpen = useSignal(false);
  const editingId = useSignal<string | null>(null);
  // add-item + item-editor: searchable category picker mode (replaces the
  // respective sheet body while open)
  const catPicking = useSignal(false);
  const editCatPicking = useSignal(false);

  // ── item-editor: honest "Saved" indicator ───────────────────────────────
  // Driven directly by `lastSaved` (bumped only when a debounced list-item write
  // actually flushes to the API — see useShoppingList), read at the top level of
  // render so this island re-renders on each flush. We snapshot lastSaved when the
  // editor opens so the pill shows only for writes made this editing session, not
  // per keystroke. (A signal written from inside a useSignalEffect did NOT
  // re-render this island, so the pill is driven by this top-level read instead.)
  const savedBaseline = useRef(0);

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

  // ── add-item: category selection (compact button + searchable picker) ─────
  const selectedCatLabel =
    categories.value.find((c) => c.id === selectedCategoryId.value)?.label ??
      "Uncategorized";

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
  };

  // Top-level read → re-renders on each flush. Show the pill only for flushes
  // since the editor opened, and key it by savedTick so it re-animates each time.
  const savedTick = lastSaved.value;
  const showSaved = savedTick > savedBaseline.current;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-4 pb-24">
      {/* Mode toggle (Plan / Shop) — list options live in the top app bar */}
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
                            savedBaseline.current = lastSaved.value;
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

      {/* ── Shop mode ── */}
      {mode.value === "shop" && (() => {
        const done = checkedItems.value.length;
        const total = list.value.length + checkedItems.value.length;
        const allDone = done === total && total > 0;

        return (
          <div class="flex flex-col gap-3">
            {/* Progress card */}
            <Card variant="filled" pad={16}>
              <div class="flex items-baseline justify-between gap-2 mb-2.5">
                <span class="md-title-medium text-on-surface whitespace-nowrap">
                  {done} / {total} in cart
                </span>
                {/* NOTE: Wake Lock API is not implemented in this spike — this is a static label only */}
                <span class="inline-flex items-center gap-1 md-label-small text-on-surface-variant whitespace-nowrap shrink-0">
                  <Icon name="bolt" size={13} /> Screen awake
                </span>
              </div>
              <Progress value={done} total={total} height={8} />
            </Card>

            {/* All-done celebration */}
            {allDone && (
              <Card
                variant="filled"
                pad={20}
                class="bg-tertiary-container text-center"
              >
                <div class="text-[34px] leading-none mb-1">🎉</div>
                <div class="md-title-large text-on-tertiary-container mt-1">
                  All done — nice work!
                </div>
                <div class="md-body-medium text-on-tertiary-container opacity-85 mt-1">
                  Everything's in the cart.
                </div>
              </Card>
            )}

            {/* Remaining items grouped by aisle */}
            {!allDone && (
              <For each={groupedList}>
                {(group) => (
                  <div class="flex flex-col gap-2">
                    {/* Aisle header */}
                    <div class="flex items-center justify-between mx-1 mt-1">
                      <span class="md-title-small text-primary uppercase tracking-[0.05em]">
                        {group.category?.label ?? "Uncategorized"}
                      </span>
                      <span class="md-label-medium text-on-surface-variant whitespace-nowrap shrink-0">
                        {group.items.length} left
                      </span>
                    </div>

                    {/* Item rows */}
                    <div class="flex flex-col gap-2">
                      {group.items.map((li: ShoppingListItemInterface) => (
                        <Pressable
                          key={li.id}
                          as="div"
                          onClick={() => handleCheckItem(li.id!)}
                          class="flex items-center gap-4 bg-surface-chigh rounded-2xl px-4"
                          style={{
                            minHeight: 60,
                            paddingTop: 14,
                            paddingBottom: 14,
                          }}
                        >
                          <RoundCheck checked={false} />
                          <div class="flex-1 min-w-0">
                            <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
                              {getItemName(li.itemId)}
                            </div>
                            {li.note && (
                              <div class="md-body-small text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
                                📝 {li.note}
                              </div>
                            )}
                          </div>
                          {(li.quantity ?? 1) > 1 && (
                            <span class="md-label-large bg-secondary-container text-on-secondary-container rounded-full px-2.5 py-0.5 shrink-0">
                              ×{li.quantity}
                            </span>
                          )}
                        </Pressable>
                      ))}
                    </div>
                  </div>
                )}
              </For>
            )}

            {/* "In cart" collapsible */}
            {checkedItems.value.length > 0 && (
              <div class="flex flex-col gap-2">
                {/* Toggle header */}
                <Pressable
                  as="div"
                  onClick={() => {
                    showDone.value = !showDone.value;
                  }}
                  class="flex items-center gap-2.5 px-1 py-2 mt-1"
                >
                  <span class="md-title-small text-on-surface-variant">
                    In cart · {checkedItems.value.length}
                  </span>
                  <div class="flex-1 h-px bg-surface-chigh" />
                  <span
                    class="text-on-surface-variant shrink-0"
                    style={{
                      transform: showDone.value
                        ? "rotate(90deg)"
                        : "rotate(0deg)",
                      transition: "transform .15s",
                      display: "inline-flex",
                    }}
                  >
                    <Icon name="chevron" size={20} />
                  </span>
                </Pressable>

                {/* Checked items */}
                {showDone.value && checkedItems.value.map(
                  (li: ShoppingListItemInterface) => (
                    <Pressable
                      key={li.id}
                      as="div"
                      onClick={() => uncheckItem(li.id!)}
                      class="flex items-center gap-4 bg-surface rounded-2xl px-4 opacity-60"
                      style={{
                        minHeight: 60,
                        paddingTop: 14,
                        paddingBottom: 14,
                      }}
                    >
                      <RoundCheck checked />
                      <div class="flex-1 min-w-0">
                        <div class="md-body-large text-on-surface line-through overflow-hidden text-ellipsis whitespace-nowrap">
                          {getItemName(li.itemId)}
                        </div>
                      </div>
                    </Pressable>
                  ),
                )}
              </div>
            )}

            {total === 0 && (
              <p class="md-body-large text-on-surface-variant text-center py-8">
                Switch to Plan to add items.
              </p>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════ List-management sheet ══════════════════════ */}
      <Sheet
        open={mgmtOpen.value}
        onClose={() => {
          mgmtOpen.value = false;
        }}
        title="List options"
      >
        <div class="flex flex-col gap-1 pb-1">
          {/* Rename */}
          <div class="px-1 py-2">
            <div class="md-body-large text-on-surface mb-2">Rename list</div>
            <div class="flex gap-2">
              <input
                value={renameValue.value}
                onInput={(e) => {
                  renameValue.value = (e.target as HTMLInputElement).value;
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && renameValue.value.trim()) {
                    await api.shoppingLists.rename(
                      listId,
                      renameValue.value.trim(),
                    );
                    mgmtOpen.value = false;
                    // The route SSR renders the list name into the shell TopAppBar;
                    // reload to reflect the new name there.
                    globalThis.location.reload();
                  }
                }}
                placeholder="List name"
                class="flex-1 md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3 px-4 outline-none"
              />
              <Button
                variant="filled"
                onClick={async () => {
                  const name = renameValue.value.trim();
                  if (!name) return;
                  await api.shoppingLists.rename(listId, name);
                  mgmtOpen.value = false;
                  globalThis.location.reload();
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div class="h-px bg-surface-chigh mx-1 my-1" />

          {/* Share — coming soon */}
          <ListItem
            headline="Share list"
            supporting="Invite household members"
            leading={
              <span class="w-10 h-10 rounded-full bg-surface-chigh text-on-surface-variant grid place-items-center">
                <Icon name="share" size={20} />
              </span>
            }
            onClick={() => {
              showSnack("Sharing is coming soon");
            }}
          />

          {/* Clear checked */}
          <ListItem
            headline="Clear checked items"
            supporting={checkedItems.value.length
              ? `${checkedItems.value.length} checked off`
              : "Nothing checked yet"}
            leading={
              <span class="w-10 h-10 rounded-full bg-surface-chigh text-on-surface-variant grid place-items-center">
                <Icon name="check" size={20} />
              </span>
            }
            onClick={async () => {
              const ids = checkedItems.value.map((li) => li.id!).filter(
                Boolean,
              );
              mgmtOpen.value = false;
              for (const id of ids) {
                await removeListItem(id);
              }
            }}
          />

          <div class="h-px bg-surface-chigh mx-1 my-1" />

          {/* Delete list */}
          <ListItem
            headline={<span class="text-error">Delete list</span>}
            leading={
              <span class="w-10 h-10 rounded-full bg-error-container text-error grid place-items-center">
                <Icon name="trash" size={20} />
              </span>
            }
            onClick={async () => {
              mgmtOpen.value = false;
              await api.shoppingLists.delete(listId);
              globalThis.location.href = "/shopping";
            }}
          />
        </div>
      </Sheet>

      {/* ══════════════════════ Add-item sheet ══════════════════════ */}
      <Sheet
        open={addOpen.value}
        onClose={() => {
          addOpen.value = false;
          catPicking.value = false;
          reset();
        }}
        title={catPicking.value ? "Choose category" : "Add items"}
      >
        {catPicking.value && (
          <CategoryPickerList
            categories={categories.value}
            selectedId={selectedCategoryId.value}
            onSelect={(id) => {
              selectedCategoryId.value = id;
              catPicking.value = false;
            }}
          />
        )}
        {!catPicking.value && (
          <>
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
                ? items.value.some((i) =>
                  i.name?.toLowerCase() === q.toLowerCase()
                )
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

                  {/* Category — opens the searchable picker */}
                  <Pressable
                    onClick={() => {
                      catPicking.value = true;
                    }}
                    color="var(--md-on-primary-container)"
                    class="flex items-center justify-between gap-2 w-full rounded-[var(--md-shape-md)] border border-on-primary-container/40 px-3.5 py-2.5"
                  >
                    <span class="md-body-medium opacity-80">Category</span>
                    <span class="inline-flex items-center gap-1 md-label-large">
                      {selectedCatLabel} <Icon name="chevron" size={18} />
                    </span>
                  </Pressable>

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
          </>
        )}
      </Sheet>

      {/* ══════════════════════ Item-editor sheet ══════════════════════ */}
      <Sheet
        open={editingId.value !== null}
        onClose={() => {
          const id = editingId.value;
          if (id) flushListItem(id);
          editingId.value = null;
          editCatPicking.value = false;
        }}
        title={editCatPicking.value
          ? "Choose category"
          : (editingId.value ? getItemName(editingListItem()?.itemId) : "")}
      >
        {(() => {
          const li = editingListItem();
          if (!li) return null;

          // Find category currently on the catalog item
          const catalogItem = items.value.find((i) => i.id === li.itemId);
          const currentCategoryId = catalogItem?.categoryId ?? "";
          const currentCatLabel =
            categories.value.find((c) => c.id === currentCategoryId)?.label ??
              "Uncategorized";

          // Searchable category picker replaces the editor body while open
          if (editCatPicking.value) {
            return (
              <CategoryPickerList
                categories={categories.value}
                selectedId={currentCategoryId}
                onSelect={(id) => {
                  handleCategoryChange(id);
                  editCatPicking.value = false;
                }}
              />
            );
          }

          return (
            <div class="flex flex-col gap-1.5 pb-1">
              {
                /* Saved pill — reserves row height; CSS-fades in/out, keyed by
                  savedTick so it replays on each flush */
              }
              <div class="h-6 flex justify-end items-center px-1">
                {showSaved && (
                  <span
                    key={savedTick}
                    class="md-saved-flash inline-flex items-center gap-1 md-label-medium text-on-tertiary-container bg-tertiary-container rounded-full px-2.5 py-0.5 pointer-events-none"
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
                  onChange={(v) => updateListItem(li.id!, { quantity: v })}
                />
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Category — opens the searchable picker */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-2">Category</div>
                <Pressable
                  onClick={() => {
                    editCatPicking.value = true;
                  }}
                  class="flex items-center justify-between gap-2 w-full bg-surface-chigh rounded-[var(--md-shape-md)] px-4 py-3"
                >
                  <span class="md-body-large text-on-surface">
                    {currentCatLabel}
                  </span>
                  <Icon
                    name="chevron"
                    size={18}
                    class="text-on-surface-variant"
                  />
                </Pressable>
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Note */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-2">Note</div>
                <textarea
                  value={li.note ?? ""}
                  onInput={(e) =>
                    updateListItem(li.id!, {
                      note: (e.target as HTMLTextAreaElement).value,
                    })}
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
                  const id = editingId.value;
                  if (id) flushListItem(id);
                  editingId.value = null;
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
      {/* ══════════════════════ Snackbar ══════════════════════ */}
      <Snackbar data={snackData.value} />
    </div>
  );
}
